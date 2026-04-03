import { Controller, Get, Logger, Param, Req, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import * as jwt from "jsonwebtoken";
import { PrismaService } from "../../prisma/prisma.service";
import { ProcessingProgressService } from "./processing-progress.service";
import { ProcessingService } from "./processing.service";

@Controller("api/processing")
export class ProcessingController {
  private readonly logger = new Logger(ProcessingController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly progress: ProcessingProgressService,
    private readonly processing: ProcessingService,
  ) {}

  private getCookieValue(req: Request, key: string): string | null {
    const raw = req.headers.cookie;
    if (!raw) return null;
    const parts = raw.split(";").map((part) => part.trim());
    for (const part of parts) {
      if (!part.startsWith(`${key}=`)) continue;
      return decodeURIComponent(part.slice(key.length + 1));
    }
    return null;
  }

  private async authenticate(req: Request): Promise<{ id: string } | null> {
    const authHeader = req.headers.authorization ?? "";
    const secret = this.config.get<string>(
      "JWT_SECRET",
      "showprep-jwt-secret-change-me",
    );
    const bearerToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : null;
    const cookieToken = this.getCookieValue(req, "showprep_token")?.trim() ?? null;
    const candidates: Array<{ source: "bearer" | "cookie"; token: string | null }> = [
      { source: "bearer", token: bearerToken },
      { source: "cookie", token: cookieToken },
    ];

    for (const candidate of candidates) {
      const token = candidate.token;
      if (!token) continue;
      try {
        const payload = jwt.verify(token, secret) as { sub?: string };
        if (!payload.sub) {
          this.logger.warn(`Stream auth ${candidate.source} token missing sub claim`);
          continue;
        }
        const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
        if (!user) {
          this.logger.warn(
            `Stream auth ${candidate.source} token user not found: ${payload.sub}`,
          );
          continue;
        }
        return { id: user.id };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Stream auth ${candidate.source} token rejected: ${message}`);
      }
    }

    return null;
  }

  @Get("jobs/:jobId/stream")
  async streamJobProgress(
    @Req() req: Request,
    @Res() res: Response,
    @Param("jobId") jobId: string,
  ) {
    const user = await this.authenticate(req);
    if (!user) {
      this.logger.warn(`Unauthorized progress stream request for jobId=${jobId}`);
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    let job;
    try {
      job = await this.processing.getJob(jobId, user.id);
    } catch {
      res.status(404).json({ message: "Job not found" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const push = (payload: unknown) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    push({
      jobId,
      status: job.status,
      stage: job.stage ?? "queued",
      message: job.message ?? "Connected",
      progress: job.progress,
      processedCount: job.processedCount,
      totalCount: job.totalCount,
      error: job.error,
      createdAt: new Date().toISOString(),
    });

    const history = await this.progress.getRecent(jobId, 200);
    for (const event of history) {
      push(event);
    }
    const latest = this.processing.getLatestProgress(jobId);
    if (latest) push(latest);

    const unsubscribe = this.progress.subscribe(jobId, (event) => {
      push(event);
    });

    const heartbeat = setInterval(() => {
      res.write(": keepalive\n\n");
    }, 15000);

    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
      res.end();
    });
  }
}
