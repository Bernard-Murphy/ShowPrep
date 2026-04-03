import { Injectable, ForbiddenException, BadRequestException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { PrismaService } from "../../prisma/prisma.service";
import { ConfigService } from "@nestjs/config";
import {
  ProcessingProgressEvent,
  ProcessingProgressService,
} from "./processing-progress.service";

@Injectable()
export class ProcessingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly progress: ProcessingProgressService,
    @InjectQueue("video-processing") private readonly videoQueue: Queue,
    @InjectQueue("gencast-generation") private readonly gencastQueue: Queue,
  ) {}

  private getHarvestCooldownMinutes(): number {
    const configured = Number(this.config.get<string>("HARVEST_COOLDOWN_MINUTES", "60"));
    if (!Number.isFinite(configured) || configured < 0) return 60;
    return Math.floor(configured);
  }

  /** When true, time-based harvest cooldown is skipped (active-job guard still applies). */
  private isHarvestDevBypass(): boolean {
    const raw = this.config.get<string>("IS_DEV", "false") ?? "false";
    return raw.toLowerCase() === "true" || raw === "1";
  }

  async getHarvestEligibility(userId: string) {
    const cooldownMinutes = this.getHarvestCooldownMinutes();
    const activeJob = await this.prisma.processingJob.findFirst({
      where: {
        userId,
        status: { in: ["PENDING", "PROCESSING"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (activeJob) {
      return {
        canStart: false,
        isFirstRun: false,
        cooldownMinutes,
        nextAvailableAt: null,
        remainingSeconds: 0,
        reason: "A harvest job is already in progress.",
      };
    }

    const latestCompleted = await this.prisma.processingJob.findFirst({
      where: { userId, status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
    });
    const isFirstRun = !latestCompleted?.completedAt;

    if (this.isHarvestDevBypass()) {
      return {
        canStart: true,
        isFirstRun,
        cooldownMinutes,
        nextAvailableAt: null,
        remainingSeconds: 0,
        reason: null,
      };
    }

    if (isFirstRun) {
      return {
        canStart: true,
        isFirstRun: true,
        cooldownMinutes,
        nextAvailableAt: null,
        remainingSeconds: 0,
        reason: null,
      };
    }

    const nextAvailableAt = new Date(
      latestCompleted!.completedAt!.getTime() + cooldownMinutes * 60 * 1000,
    );
    const remainingMs = nextAvailableAt.getTime() - Date.now();
    const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));

    return {
      canStart: remainingSeconds === 0,
      isFirstRun: false,
      cooldownMinutes,
      nextAvailableAt,
      remainingSeconds,
      reason: null,
    };
  }

  async enqueueVideoProcessing(userId: string, type: "INITIAL" | "RECURRING") {
    const eligibility = await this.getHarvestEligibility(userId);
    if (!eligibility.canStart) {
      const fallback =
        eligibility.nextAvailableAt != null
          ? "Harvest cooldown active. Try again when the cooldown ends."
          : "Harvest is not available right now.";
      throw new BadRequestException(eligibility.reason ?? fallback);
    }

    const processingJob = await this.prisma.processingJob.create({
      data: {
        userId,
        type,
        status: "PENDING",
        stage: "queued",
        message: "Job queued",
      },
    });
    await this.videoQueue.add(
      "process",
      { userId, type, processingJobId: processingJob.id },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
      },
    );
    return processingJob;
  }

  async getJob(jobId: string, userId: string) {
    const job = await this.prisma.processingJob.findUnique({
      where: { id: jobId },
    });
    if (!job || job.userId !== userId) throw new ForbiddenException("Job not found");
    return job;
  }

  async getLatestJob(userId: string) {
    return this.prisma.processingJob.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  getLatestProgress(jobId: string) {
    return this.progress.getLatest(jobId);
  }

  async emitProgress(event: ProcessingProgressEvent) {
    await this.progress.emit(event);
  }
}
