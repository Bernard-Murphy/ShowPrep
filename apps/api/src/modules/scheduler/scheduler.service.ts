import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../../prisma/prisma.service";
import { ConfigService } from "@nestjs/config";
import { YouTubeService } from "../youtube/youtube.service";

@Injectable()
export class SchedulerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SchedulerService.name);
  private readonly maxUsersPerRun: number;
  private readonly userSyncConcurrency: number;
  private refreshInProgress = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly youtube: YouTubeService,
  ) {
    this.maxUsersPerRun = Number(
      this.config.get<string>("MAX_METADATA_REFRESH_USERS_PER_RUN", "200"),
    );
    this.userSyncConcurrency = Math.max(
      1,
      Math.floor(
        Number(this.config.get<string>("YOUTUBE_USER_SYNC_CONCURRENCY", "3")),
      ),
    );
  }

  onApplicationBootstrap() {
    return;
    this.logger.log("Triggering startup YouTube metadata refresh");
    void this.runYouTubeRefresh("startup").catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Startup metadata refresh failed: ${message}`);
    });
  }

  private async runWithConcurrency<T>(
    items: T[],
    concurrency: number,
    worker: (item: T, index: number) => Promise<void>,
  ): Promise<void> {
    if (items.length === 0) return;
    const limit = Math.max(1, Math.floor(concurrency));
    let nextIndex = 0;
    const runWorker = async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        await worker(items[currentIndex], currentIndex);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(limit, items.length) }, () => runWorker()),
    );
  }

  private async runYouTubeRefresh(trigger: "startup" | "cron") {
    if (this.refreshInProgress) {
      this.logger.warn(
        `Skipping ${trigger} YouTube refresh because a previous run is still in progress`,
      );
      return;
    }
    this.refreshInProgress = true;
    const refreshStartedAt = Date.now();
    try {
      const connections = await this.prisma.youTubeConnection.findMany({
        select: { userId: true, lastSyncAt: true },
        orderBy: [{ lastSyncAt: { sort: "asc", nulls: "first" } }],
        take: this.maxUsersPerRun,
      });

      if (connections.length === 0) {
        this.logger.log(`No linked users found for ${trigger} YouTube refresh`);
        return;
      }

      this.logger.log(
        `Starting ${trigger} YouTube refresh phase 1/2 (membership sync) for ${connections.length} linked users`,
      );

      const phase1StartedAt = Date.now();
      let syncedUsers = 0;
      let failedUsers = 0;
      await this.runWithConcurrency(
        connections,
        this.userSyncConcurrency,
        async (connection) => {
          try {
            await this.youtube.syncSubscriptions(connection.userId);
            syncedUsers += 1;
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);
            failedUsers += 1;
            this.logger.warn(
              `Skipping membership sync for user ${connection.userId}: ${message}`,
            );
          }
        },
      );

      this.logger.log(
        `Completed phase 1/2 membership sync in ${Date.now() - phase1StartedAt}ms (success=${syncedUsers}, failed=${failedUsers})`,
      );

      const phase2StartedAt = Date.now();
      try {
        this.logger.log(
          `Starting ${trigger} YouTube refresh phase 2/2 deduplicated channel metadata refresh`,
        );
        const updatedRows = await this.youtube.refreshAllSubscriptionMetadata();
        this.logger.log(
          `Completed phase 2/2 deduplicated channel metadata refresh in ${Date.now() - phase2StartedAt}ms (rowsUpdated=${updatedRows})`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Phase 2/2 deduplicated metadata refresh failed: ${message}`,
        );
      }
    } finally {
      this.refreshInProgress = false;
      this.logger.log(
        `Finished ${trigger} YouTube refresh run in ${Date.now() - refreshStartedAt}ms`,
      );
    }
  }

  @Cron("0 * * * *")
  async recalculateHotScores() {
    const articles = await this.prisma.article.findMany({
      select: {
        id: true,
        views: true,
        karma: true,
        createdAt: true,
        _count: { select: { comments: true } },
      },
    });
    for (const a of articles) {
      const ageHours = (Date.now() - a.createdAt.getTime()) / 3_600_000;
      const score =
        (a._count.comments * 3 + a.karma * 2 + a.views) /
        Math.pow(ageHours + 2, 1.5);
      await this.prisma.article.update({
        where: { id: a.id },
        data: { hotScore: score },
      });
    }
    const gencasts = await this.prisma.gencast.findMany({
      select: {
        id: true,
        views: true,
        karma: true,
        createdAt: true,
        _count: { select: { comments: true } },
      },
    });
    for (const g of gencasts) {
      const ageHours = (Date.now() - g.createdAt.getTime()) / 3_600_000;
      const score =
        (g._count.comments * 3 + g.karma * 2 + g.views) /
        Math.pow(ageHours + 2, 1.5);
      await this.prisma.gencast.update({
        where: { id: g.id },
        data: { hotScore: score },
      });
    }
  }

  @Cron("5 * * * *")
  async refreshYouTubeChannelMetadata() {
    await this.runYouTubeRefresh("cron");
  }
}
