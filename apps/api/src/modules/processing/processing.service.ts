import { Injectable, ForbiddenException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { PrismaService } from "../../prisma/prisma.service";
import {
  ProcessingProgressEvent,
  ProcessingProgressService,
} from "./processing-progress.service";

@Injectable()
export class ProcessingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly progress: ProcessingProgressService,
    @InjectQueue("video-processing") private readonly videoQueue: Queue,
    @InjectQueue("gencast-generation") private readonly gencastQueue: Queue,
  ) {}

  async enqueueVideoProcessing(userId: string, type: "INITIAL" | "RECURRING") {
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
