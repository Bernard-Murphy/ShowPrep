import { Injectable } from "@nestjs/common";
import { EventEmitter } from "events";
import { PrismaService } from "../../prisma/prisma.service";

export type ProcessingProgressEvent = {
  jobId: string;
  userId: string;
  status: string;
  stage: string;
  message: string;
  progress: number;
  processedCount: number;
  totalCount: number;
  error?: string | null;
  createdAt: string;
};

@Injectable()
export class ProcessingProgressService {
  private readonly emitter = new EventEmitter();
  private readonly latestByJob = new Map<string, ProcessingProgressEvent>();

  constructor(private readonly prisma: PrismaService) {}

  async emit(event: ProcessingProgressEvent) {
    this.latestByJob.set(event.jobId, event);
    await this.prisma.processingProgressEvent.create({
      data: {
        processingJobId: event.jobId,
        userId: event.userId,
        status: event.status,
        stage: event.stage,
        message: event.message,
        progress: event.progress,
        processedCount: event.processedCount,
        totalCount: event.totalCount,
        error: event.error ?? null,
      },
    });
    this.emitter.emit(event.jobId, event);
  }

  subscribe(jobId: string, listener: (event: ProcessingProgressEvent) => void) {
    this.emitter.on(jobId, listener);
    return () => this.emitter.off(jobId, listener);
  }

  getLatest(jobId: string) {
    return this.latestByJob.get(jobId) ?? null;
  }

  async getRecent(jobId: string, limit = 100) {
    const rows = await this.prisma.processingProgressEvent.findMany({
      where: { processingJobId: jobId },
      orderBy: { createdAt: "asc" },
      take: Math.max(1, Math.min(limit, 500)),
    });
    return rows.map((row) => ({
      jobId: row.processingJobId,
      userId: row.userId,
      status: row.status,
      stage: row.stage,
      message: row.message,
      progress: row.progress,
      processedCount: row.processedCount,
      totalCount: row.totalCount,
      error: row.error,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
