import {
  Injectable,
  ForbiddenException,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Queue } from "bullmq";
import { PrismaService } from "../../prisma/prisma.service";
import { google } from "googleapis";
import { randomBytes } from "crypto";
import { StorageService } from "../storage/storage.service";

export interface HandleCallbackResult {
  userId: string;
  accessToken?: string;
}

export interface RecentVideo {
  youtubeVideoId: string;
  channelId: string;
  channelTitle: string;
  videoTitle: string;
  description: string | null;
  thumbnailUrl: string | null;
  publishedAt: Date;
}

type RecentVideoOptions = {
  lookbackDays: number;
  maxPerChannel: number;
  maxTotal: number;
  channelIds?: string[];
};

type ChannelMetadata = {
  channelTitle: string | null;
  channelThumbnailUrl: string | null;
  subscriberCount: number | null;
  lastUploadedAt: Date | null;
};

@Injectable()
export class YouTubeService {
  private static readonly MAX_SELECTED_CHANNELS = 40;
  private readonly logger = new Logger(YouTubeService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  /** Max duration (seconds) to treat as Shorts when using Data API duration; override via HARVEST_MAX_SHORT_DURATION_SECONDS. */
  private readonly harvestMaxShortDurationSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly storage: StorageService,
    @InjectQueue("transcript-prefetch")
    private readonly transcriptPrefetchQueue: Queue,
  ) {
    this.clientId = this.config.get<string>("YOUTUBE_CLIENT_ID", "");
    this.clientSecret = this.config.get<string>("YOUTUBE_CLIENT_SECRET", "");
    this.redirectUri = this.config.get<string>("YOUTUBE_REDIRECT_URI", "");
    const shortDur = Number(
      this.config.get<string>("HARVEST_MAX_SHORT_DURATION_SECONDS", "120"),
    );
    this.harvestMaxShortDurationSeconds =
      Number.isFinite(shortDur) && shortDur > 0 ? shortDur : 120;
  }

  /** Parse YouTube Data API ISO 8601 duration (e.g. PT1H2M3S) to seconds. */
  private parseIso8601DurationToSeconds(iso: string): number | null {
    const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(iso.trim());
    if (!m) return null;
    const h = Number(m[1] ?? 0);
    const min = Number(m[2] ?? 0);
    const s = Number(m[3] ?? 0);
    return h * 3600 + min * 60 + s;
  }

  private isLikelyShortHarvestVideo(
    title: string,
    description: string,
    durationSeconds: number | null,
  ): boolean {
    const hay = `${title}\n${description}`.toLowerCase();
    if (hay.includes("#shorts")) return true;
    if (
      durationSeconds !== null &&
      durationSeconds > 0 &&
      durationSeconds <= this.harvestMaxShortDurationSeconds
    ) {
      return true;
    }
    return false;
  }

  /**
   * Drops live/upcoming and Shorts heuristics (#shorts tag or short duration).
   * `contentDetails.caption` is observed for logging but is not a hard drop signal.
   */
  private async filterHarvestVideosWithDataApi(
    youtube: ReturnType<typeof google.youtube>,
    videos: RecentVideo[],
  ): Promise<RecentVideo[]> {
    if (videos.length === 0) return [];
    const uniqueIds = [...new Set(videos.map((v) => v.youtubeVideoId))];
    const allowedIds = new Set<string>();
    let droppedLiveOrUpcoming = 0;
    let captionFalseCount = 0;
    let droppedShorts = 0;
    let missingVideoId = 0;

    for (let i = 0; i < uniqueIds.length; i += 50) {
      const chunk = uniqueIds.slice(i, i + 50);
      const res = await youtube.videos.list({
        part: ["snippet", "contentDetails"],
        id: chunk,
      });
      for (const item of res.data.items ?? []) {
        const id = item.id;
        if (!id) {
          missingVideoId += 1;
          continue;
        }
        const live = item.snippet?.liveBroadcastContent;
        if (live === "live" || live === "upcoming") {
          droppedLiveOrUpcoming += 1;
          continue;
        }

        const caption = item.contentDetails?.caption;
        if (caption === "false") {
          captionFalseCount += 1;
        }

        const title = item.snippet?.title ?? "";
        const description = item.snippet?.description ?? "";
        const durationIso = item.contentDetails?.duration ?? "";
        const durationSec = durationIso
          ? this.parseIso8601DurationToSeconds(durationIso)
          : null;
        if (this.isLikelyShortHarvestVideo(title, description, durationSec)) {
          droppedShorts += 1;
          continue;
        }

        allowedIds.add(id);
      }
    }

    const kept = videos.filter((v) => allowedIds.has(v.youtubeVideoId));
    kept.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
    this.logger.log(
      `videos.list filter summary: input=${videos.length}, uniqueIds=${uniqueIds.length}, kept=${kept.length}, droppedLiveOrUpcoming=${droppedLiveOrUpcoming}, captionFalseCount=${captionFalseCount}, droppedShorts=${droppedShorts}, missingVideoId=${missingVideoId}`,
    );
    return kept;
  }

  private async selectVideosWithTranscriptAvailability(
    videos: RecentVideo[],
    maxTotal: number,
  ): Promise<RecentVideo[]> {
    const selected: RecentVideo[] = [];
    const dropReasonCounts = new Map<string, number>();

    const countDrop = (reason: string) => {
      dropReasonCounts.set(reason, (dropReasonCounts.get(reason) ?? 0) + 1);
    };

    for (const video of videos) {
      const transcriptResult = await this.getOrFetchTranscript(video.youtubeVideoId);
      if (!transcriptResult.transcript?.trim()) {
        const reason = transcriptResult.reason;
        countDrop(reason);
        this.logger.warn(
          `Dropped video due to missing transcript: videoId=${video.youtubeVideoId}, channelId=${video.channelId}, source=${transcriptResult.source}, reason=${reason}`,
        );
        continue;
      }
      selected.push(video);
      if (selected.length >= maxTotal) break;
    }

    const reasonSummary = [...dropReasonCounts.entries()]
      .map(([reason, count]) => `${reason}:${count}`)
      .join(", ");
    this.logger.log(
      `transcript availability selector summary: input=${videos.length}, selected=${selected.length}, droppedNoTranscript=${videos.length - selected.length}, dropReasons=${reasonSummary || "none"}`,
    );
    return selected;
  }

  private buildOAuth2Client() {
    return new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
      this.redirectUri,
    );
  }

  private getScopes() {
    return [
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ];
  }

  getAuthUrl(userId: string): { authUrl: string } {
    const state = this.jwtService.sign(
      { sub: userId, purpose: "youtube-link" },
      { expiresIn: "10m" },
    );
    const oauth2Client = this.buildOAuth2Client();
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: this.getScopes(),
      state,
    });
    return { authUrl };
  }

  getAuthUrlForLogin(): { authUrl: string } {
    const nonce = randomBytes(16).toString("hex");
    const state = this.jwtService.sign(
      { purpose: "youtube-login", nonce },
      { expiresIn: "10m" },
    );
    const oauth2Client = this.buildOAuth2Client();
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: this.getScopes(),
      state,
    });
    return { authUrl };
  }

  async handleCallback(
    code: string,
    state: string,
  ): Promise<HandleCallbackResult> {
    this.logger.log("handleCallback start");
    let payload: { sub?: string; purpose?: string };
    try {
      payload = this.jwtService.verify(state) as {
        sub?: string;
        purpose?: string;
      };
    } catch {
      this.logger.error("State verification failed");
      throw new ForbiddenException("Invalid or expired state");
    }
    this.logger.log(`State verified with purpose=${payload.purpose ?? "unknown"}`);

    const oauth2Client = this.buildOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    this.logger.log(
      `Token exchange succeeded. access_token=${!!tokens.access_token}, refresh_token=${!!tokens.refresh_token}`,
    );
    if (!tokens.access_token || !tokens.refresh_token) {
      this.logger.error("Token exchange did not include both access and refresh tokens");
      throw new ForbiddenException("Missing tokens from YouTube");
    }

    const youtube = google.youtube({ version: "v3", auth: oauth2Client });
    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000);

    if (payload.purpose === "youtube-link" && payload.sub) {
      this.logger.log(`Handling youtube-link flow for userId=${payload.sub}`);
      const userId = payload.sub;
      const channelRes = await youtube.channels.list({
        part: ["id"],
        mine: true,
      });
      const channelId = channelRes.data.items?.[0]?.id ?? "";
      this.logger.log(
        `youtube-link channels.list returned channelId=${channelId || "none"}`,
      );
      await this.prisma.youTubeConnection.upsert({
        where: { userId },
        create: {
          userId,
          channelId,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiresAt: expiresAt,
        },
        update: {
          channelId,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiresAt: expiresAt,
        },
      });
      return { userId };
    }

    if (payload.purpose === "youtube-login") {
      this.logger.log("Handling youtube-login flow");
      const channelRes = await youtube.channels.list({
        part: ["id", "snippet"],
        mine: true,
      });
      const item = channelRes.data.items?.[0];
      const channelId = item?.id ?? "";
      const channelTitle = item?.snippet?.title ?? null;
      const channelThumbnailUrl =
        item?.snippet?.thumbnails?.default?.url ??
        item?.snippet?.thumbnails?.medium?.url ??
        null;
      const cachedThumbnailUrl = await this.cacheAvatarThumbnail(
        channelId,
        channelThumbnailUrl,
      );
      const avatarUrl = cachedThumbnailUrl ?? channelThumbnailUrl;
      this.logger.log(
        `youtube-login channels.list returned channelId=${channelId || "none"}, channelTitle=${channelTitle || "none"}`,
      );

      if (!channelId) {
        this.logger.error("youtube-login flow found no YouTube channel");
        throw new ForbiddenException("No YouTube channel found");
      }

      const existing = await this.prisma.youTubeConnection.findFirst({
        where: { channelId },
      });
      this.logger.log(
        existing
          ? `Found existing YouTubeConnection for channelId=${channelId}, userId=${existing.userId}`
          : `No existing connection for channelId=${channelId}; creating new user`,
      );

      let userId: string;
      if (existing) {
        userId = existing.userId;
        await this.prisma.youTubeConnection.update({
          where: { id: existing.id },
          data: {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            tokenExpiresAt: expiresAt,
            channelTitle,
            channelThumbnailUrl: avatarUrl,
          },
        });
      } else {
        const user = await this.prisma.user.create({
          data: {
            youtubeChannelId: channelId,
            displayName: channelTitle,
          },
        });
        userId = user.id;
        this.logger.log(`Created user userId=${userId} for channelId=${channelId}`);
        await this.prisma.youTubeConnection.create({
          data: {
            userId,
            channelId,
            channelTitle,
            channelThumbnailUrl: avatarUrl,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            tokenExpiresAt: expiresAt,
          },
        });
      }

      try {
        await this.syncSubscriptions(userId);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Initial subscription sync failed for userId=${userId}: ${message}`,
        );
      }

      const accessToken = this.jwtService.sign(
        { sub: userId },
        { expiresIn: "7d" },
      );
      this.logger.log(`youtube-login success for userId=${userId}`);
      return { userId, accessToken };
    }

    this.logger.error(`Invalid OAuth state purpose: ${payload.purpose ?? "undefined"}`);
    throw new ForbiddenException("Invalid state");
  }

  private async cacheAvatarThumbnail(
    channelId: string,
    thumbnailUrl: string | null,
  ): Promise<string | null> {
    if (!thumbnailUrl || !channelId) return null;
    try {
      const res = await fetch(thumbnailUrl);
      if (!res.ok) {
        this.logger.warn(
          `Avatar fetch failed for channelId=${channelId}, status=${res.status}`,
        );
        return null;
      }
      const contentType = res.headers.get("content-type") || "image/jpeg";
      const bytes = await res.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const ext =
        contentType.includes("png")
          ? "png"
          : contentType.includes("webp")
            ? "webp"
            : "jpg";
      const key = `avatars/youtube/${channelId}.${ext}`;
      const storedUrl = await this.storage.uploadBuffer(key, buffer, contentType);
      this.logger.log(`Cached avatar for channelId=${channelId}`);
      return storedUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Avatar caching failed for channelId=${channelId}: ${message}`,
      );
      return null;
    }
  }

  async unlink(userId: string): Promise<boolean> {
    await this.prisma.youTubeConnection.deleteMany({ where: { userId } });
    return true;
  }

  async getConnection(userId: string) {
    const conn = await this.prisma.youTubeConnection.findUnique({
      where: { userId },
      include: { subscriptions: true },
    });
    return conn;
  }

  private async getOAuth2Client(userId: string) {
    const conn = await this.prisma.youTubeConnection.findUnique({
      where: { userId },
    });
    if (!conn) return null;
    const oauth2Client = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
      this.redirectUri,
    );
    oauth2Client.setCredentials({
      access_token: conn.accessToken,
      refresh_token: conn.refreshToken,
      expiry_date: conn.tokenExpiresAt.getTime(),
    });
    oauth2Client.on("tokens", async (tokens) => {
      if (tokens.refresh_token) {
        await this.prisma.youTubeConnection.update({
          where: { userId },
          data: {
            accessToken: tokens.access_token!,
            refreshToken: tokens.refresh_token,
            tokenExpiresAt: tokens.expiry_date
              ? new Date(tokens.expiry_date)
              : new Date(Date.now() + 3600 * 1000),
          },
        });
      }
    });
    return oauth2Client;
  }

  private getMetadataBatchSize(): number {
    const configured = Number(
      this.config.get<string>("YOUTUBE_METADATA_CHANNEL_BATCH_SIZE", "50"),
    );
    if (!Number.isFinite(configured) || configured <= 0) return 50;
    return Math.min(50, Math.floor(configured));
  }

  private getMembershipUpsertConcurrency(): number {
    const configured = Number(
      this.config.get<string>("YOUTUBE_MEMBERSHIP_UPSERT_CONCURRENCY", "10"),
    );
    if (!Number.isFinite(configured) || configured <= 0) return 10;
    return Math.min(50, Math.floor(configured));
  }

  private getMetadataFetchConcurrency(): number {
    const configured = Number(
      this.config.get<string>("YOUTUBE_METADATA_FETCH_CONCURRENCY", "8"),
    );
    if (!Number.isFinite(configured) || configured <= 0) return 8;
    return Math.min(20, Math.floor(configured));
  }

  private getPlaylistLookupConcurrency(): number {
    const configured = Number(
      this.config.get<string>("YOUTUBE_PLAYLIST_LOOKUP_CONCURRENCY", "10"),
    );
    if (!Number.isFinite(configured) || configured <= 0) return 10;
    return Math.min(25, Math.floor(configured));
  }

  private getMetadataUpdateConcurrency(): number {
    const configured = Number(
      this.config.get<string>("YOUTUBE_METADATA_UPDATE_CONCURRENCY", "15"),
    );
    if (!Number.isFinite(configured) || configured <= 0) return 15;
    return Math.min(50, Math.floor(configured));
  }

  private getHarvestPlaylistFetchConcurrency(): number {
    const configured = Number(
      this.config.get<string>("YOUTUBE_HARVEST_PLAYLIST_FETCH_CONCURRENCY", "8"),
    );
    if (!Number.isFinite(configured) || configured <= 0) return 8;
    return Math.min(25, Math.floor(configured));
  }

  private async runWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    worker: (item: T, index: number) => Promise<R>,
  ): Promise<R[]> {
    if (items.length === 0) return [];
    const limit = Math.max(1, Math.floor(concurrency));
    const results: R[] = new Array(items.length) as R[];
    let nextIndex = 0;

    const runWorker = async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await worker(items[currentIndex], currentIndex);
      }
    };

    const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
      runWorker(),
    );
    await Promise.all(workers);
    return results;
  }

  private chunkBySize<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
      chunks.push(items.slice(i, i + size));
    }
    return chunks;
  }

  private async fetchChannelMetadataByIds(
    youtube: ReturnType<typeof google.youtube>,
    channelIds: string[],
  ): Promise<Map<string, ChannelMetadata>> {
    const uniqueChannelIds = [...new Set(channelIds)].filter(Boolean);
    const metadataByChannelId = new Map<string, ChannelMetadata>();
    const uploadsPlaylistByChannelId = new Map<string, string>();
    const batchSize = this.getMetadataBatchSize();

    const channelBatches = this.chunkBySize(uniqueChannelIds, batchSize);
    const metadataFetchStartedAt = Date.now();
    const channelBatchResults = await this.runWithConcurrency(
      channelBatches,
      this.getMetadataFetchConcurrency(),
      async (batch) => {
        const channelRes = await youtube.channels.list({
          part: ["snippet", "statistics", "contentDetails"],
          id: batch,
        });
        return channelRes.data.items ?? [];
      },
    );
    for (const batchItems of channelBatchResults) {
      for (const channel of batchItems) {
        const channelId = channel.id ?? "";
        if (!channelId) continue;
        const rawSubscriberCount = channel.statistics?.subscriberCount;
        const subscriberCount =
          rawSubscriberCount && Number.isFinite(Number(rawSubscriberCount))
            ? Number(rawSubscriberCount)
            : null;
        const channelTitle = channel.snippet?.title ?? null;
        const channelThumbnailUrl =
          channel.snippet?.thumbnails?.default?.url ??
          channel.snippet?.thumbnails?.medium?.url ??
          null;
        metadataByChannelId.set(channelId, {
          channelTitle,
          channelThumbnailUrl,
          subscriberCount,
          lastUploadedAt: null,
        });
        const uploads = channel.contentDetails?.relatedPlaylists?.uploads;
        if (uploads) uploadsPlaylistByChannelId.set(channelId, uploads);
      }
    }
    this.logger.log(
      `Fetched metadata batches for ${uniqueChannelIds.length} channels in ${Date.now() - metadataFetchStartedAt}ms`,
    );

    const playlistLookups = [...uploadsPlaylistByChannelId.entries()];
    const playlistLookupStartedAt = Date.now();
    await this.runWithConcurrency(
      playlistLookups,
      this.getPlaylistLookupConcurrency(),
      async ([channelId, uploadsPlaylistId]) => {
        try {
          const playlistRes = await youtube.playlistItems.list({
            part: ["snippet"],
            playlistId: uploadsPlaylistId,
            maxResults: 1,
          });
          const publishedAtRaw = playlistRes.data.items?.[0]?.snippet?.publishedAt;
          const existing = metadataByChannelId.get(channelId);
          if (!existing) return;
          metadataByChannelId.set(channelId, {
            ...existing,
            lastUploadedAt: publishedAtRaw ? new Date(publishedAtRaw) : null,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.warn(
            `Failed to load latest upload for channel ${channelId}: ${message}`,
          );
        }
      },
    );
    this.logger.log(
      `Fetched latest upload timestamps for ${playlistLookups.length} channels in ${Date.now() - playlistLookupStartedAt}ms`,
    );

    return metadataByChannelId;
  }

  async syncSubscriptions(userId: string): Promise<number> {
    const oauth2Client = await this.getOAuth2Client(userId);
    if (!oauth2Client) throw new ForbiddenException("YouTube not linked");

    const youtube = google.youtube({ version: "v3", auth: oauth2Client });
    const connection = await this.prisma.youTubeConnection.findUnique({
      where: { userId },
    });
    if (!connection) return 0;

    const subscriptions: Array<{
      channelId: string;
      channelTitle: string;
      channelThumbnailUrl: string | null;
    }> = [];
    let pageToken: string | undefined;
    do {
      const res = await youtube.subscriptions.list({
        part: ["snippet"],
        mine: true,
        maxResults: 50,
        pageToken,
      });
      const items = res.data.items ?? [];
      for (const item of items) {
        const channelId = item.snippet?.resourceId?.channelId ?? "";
        if (!channelId) continue;
        const channelTitle = item.snippet?.title ?? "";
        const thumb = item.snippet?.thumbnails?.default?.url ?? null;
        subscriptions.push({
          channelId,
          channelTitle,
          channelThumbnailUrl: thumb,
        });
      }
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);

    const upsertStartedAt = Date.now();
    await this.runWithConcurrency(
      subscriptions,
      this.getMembershipUpsertConcurrency(),
      async (subscription) => {
        await this.prisma.youTubeSubscription.upsert({
          where: {
            youtubeConnectionId_channelId: {
              youtubeConnectionId: connection.id,
              channelId: subscription.channelId,
            },
          },
          create: {
            youtubeConnectionId: connection.id,
            channelId: subscription.channelId,
            channelTitle: subscription.channelTitle,
            channelThumbnailUrl: subscription.channelThumbnailUrl,
            active: false,
          },
          update: {
            channelTitle: subscription.channelTitle,
            channelThumbnailUrl: subscription.channelThumbnailUrl,
          },
        });
      },
    );
    this.logger.log(
      `Upserted ${subscriptions.length} user subscriptions for user=${userId} in ${Date.now() - upsertStartedAt}ms`,
    );

    await this.prisma.youTubeConnection.update({
      where: { userId },
      data: { lastSyncAt: new Date() },
    });
    return subscriptions.length;
  }

  async refreshAllSubscriptionMetadata(): Promise<number> {
    const distinctChannels = await this.prisma.youTubeSubscription.findMany({
      distinct: ["channelId"],
      select: { channelId: true },
    });
    const channelIds = distinctChannels
      .map((channel) => channel.channelId)
      .filter(Boolean);
    if (channelIds.length === 0) return 0;

    const connections = await this.prisma.youTubeConnection.findMany({
      select: { userId: true, lastSyncAt: true },
      orderBy: [{ lastSyncAt: { sort: "desc", nulls: "last" } }],
    });
    if (connections.length === 0) {
      this.logger.warn("No YouTube connections found for metadata refresh");
      return 0;
    }

    let youtubeClient: ReturnType<typeof google.youtube> | null = null;
    for (const connection of connections) {
      try {
        const oauth2Client = await this.getOAuth2Client(connection.userId);
        if (!oauth2Client) continue;
        youtubeClient = google.youtube({ version: "v3", auth: oauth2Client });
        break;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Unable to build OAuth client for metadata refresh with user ${connection.userId}: ${message}`,
        );
      }
    }

    if (!youtubeClient) {
      this.logger.warn("Could not initialize YouTube client for metadata refresh");
      return 0;
    }

    const metadataByChannelId = await this.fetchChannelMetadataByIds(
      youtubeClient,
      channelIds,
    );
    let updatedCount = 0;
    let failedUpdates = 0;
    const updateStartedAt = Date.now();

    await this.runWithConcurrency(
      [...metadataByChannelId.entries()],
      this.getMetadataUpdateConcurrency(),
      async ([channelId, metadata]) => {
        try {
          const result = await this.prisma.youTubeSubscription.updateMany({
            where: { channelId },
            data: {
              channelTitle: metadata.channelTitle ?? undefined,
              channelThumbnailUrl: metadata.channelThumbnailUrl,
              subscriberCount: metadata.subscriberCount,
              lastUploadedAt: metadata.lastUploadedAt,
            },
          });
          updatedCount += result.count;
        } catch (error) {
          failedUpdates += 1;
          const message = error instanceof Error ? error.message : String(error);
          this.logger.warn(
            `Failed to update metadata rows for channel ${channelId}: ${message}`,
          );
        }
      },
    );
    this.logger.log(
      `Updated metadata for ${metadataByChannelId.size} unique channels in ${Date.now() - updateStartedAt}ms (rowsUpdated=${updatedCount}, failedChannels=${failedUpdates})`,
    );

    return updatedCount;
  }

  async listSubscriptions(userId: string) {
    const conn = await this.prisma.youTubeConnection.findUnique({
      where: { userId },
      include: {
        subscriptions: {
          orderBy: [
            { active: "desc" },
            { lastUploadedAt: { sort: "desc", nulls: "last" } },
            { channelTitle: "asc" },
          ],
        },
      },
    });
    if (!conn) return [];
    return conn.subscriptions;
  }

  async setActiveSubscriptions(userId: string, channelIds: string[]): Promise<number> {
    const connection = await this.prisma.youTubeConnection.findUnique({
      where: { userId },
    });
    if (!connection) throw new ForbiddenException("YouTube not linked");

    const uniqueChannelIds = [...new Set(channelIds)];
    if (uniqueChannelIds.length > YouTubeService.MAX_SELECTED_CHANNELS) {
      throw new BadRequestException(
        `You can select up to ${YouTubeService.MAX_SELECTED_CHANNELS} channels`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.youTubeSubscription.updateMany({
        where: { youtubeConnectionId: connection.id },
        data: { active: false },
      }),
      this.prisma.youTubeSubscription.updateMany({
        where: {
          youtubeConnectionId: connection.id,
          channelId: {
            in: uniqueChannelIds.length ? uniqueChannelIds : ["__none__"],
          },
        },
        data: { active: true },
      }),
    ]);
    this.transcriptPrefetchQueue
      .add(
        "prefetch-selected",
        { userId },
        {
          jobId: `prefetch-selected-${userId}`,
          removeOnComplete: true,
          removeOnFail: 25,
          attempts: 2,
          backoff: { type: "exponential", delay: 2000 },
        },
      )
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Failed to enqueue transcript prefetch for user=${userId}: ${message}`,
        );
      });
    return uniqueChannelIds.length;
  }

  async getRecentVideosFromSubscriptions(userId: string, limit: number): Promise<RecentVideo[]> {
    return this.getRecentVideosForHarvest(userId, {
      lookbackDays: 30,
      maxPerChannel: limit,
      maxTotal: limit,
    });
  }

  async getRecentVideosForHarvest(
    userId: string,
    options: RecentVideoOptions,
  ): Promise<RecentVideo[]> {
    const conn = await this.getConnection(userId);
    if (!conn || conn.subscriptions.length === 0) return [];

    const oauth2Client = await this.getOAuth2Client(userId);
    if (!oauth2Client) return [];

    const youtube = google.youtube({ version: "v3", auth: oauth2Client });

    const lookbackThreshold = new Date(
      Date.now() - options.lookbackDays * 24 * 60 * 60 * 1000,
    );
    const selectedSet = new Set(options.channelIds ?? []);
    const channelIds = conn.subscriptions
      .filter(
        (s: { active: boolean; channelId: string }) =>
          s.active &&
          (selectedSet.size === 0 || selectedSet.has(s.channelId)),
      )
      .map((s: { channelId: string }) => s.channelId);
    this.logger.log(
      `Harvest recent videos start: user=${userId}, activeSubscriptions=${conn.subscriptions.filter((s) => s.active).length}, selectedSet=${selectedSet.size}, candidateChannels=${channelIds.length}, lookbackDays=${options.lookbackDays}, maxPerChannel=${options.maxPerChannel}, maxTotal=${options.maxTotal}`,
    );
    const uploadsPlaylistIds: string[] = [];

    for (let i = 0; i < channelIds.length; i += 50) {
      const batch = channelIds.slice(i, i + 50);
      const res = await youtube.channels.list({
        part: ["contentDetails"],
        id: batch,
      });
      for (const ch of res.data.items ?? []) {
        const uploads = ch.contentDetails?.relatedPlaylists?.uploads;
        if (uploads) uploadsPlaylistIds.push(uploads);
      }
    }
    this.logger.log(
      `Resolved upload playlists for user=${userId}: channelIds=${channelIds.length}, uploadsPlaylists=${uploadsPlaylistIds.length}`,
    );

    const perPlaylistVideos = await this.runWithConcurrency(
      uploadsPlaylistIds,
      this.getHarvestPlaylistFetchConcurrency(),
      async (playlistId) => {
        const channelVideos: RecentVideo[] = [];
        let pageToken: string | undefined;
        let perChannelCount = 0;
        do {
          const res = await youtube.playlistItems.list({
            part: ["snippet"],
            playlistId,
            maxResults: Math.min(50, options.maxPerChannel - perChannelCount),
            pageToken,
          });
          for (const item of res.data.items ?? []) {
            const vid = item.snippet;
            if (!vid?.resourceId?.videoId) continue;
            const publishedAt = vid.publishedAt
              ? new Date(vid.publishedAt)
              : new Date();
            if (publishedAt < lookbackThreshold) continue;
            channelVideos.push({
              youtubeVideoId: vid.resourceId.videoId,
              channelId: vid.channelId ?? "",
              channelTitle: vid.channelTitle ?? "",
              videoTitle: vid.title ?? "",
              description: vid.description ?? null,
              thumbnailUrl:
                vid.thumbnails?.medium?.url ??
                vid.thumbnails?.default?.url ??
                null,
              publishedAt,
            });
            perChannelCount += 1;
            if (perChannelCount >= options.maxPerChannel) break;
          }
          pageToken = res.data.nextPageToken ?? undefined;
        } while (pageToken && perChannelCount < options.maxPerChannel);
        return channelVideos;
      },
    );
    const allVideos = perPlaylistVideos.flat();
    this.logger.log(
      `Playlist scan summary for user=${userId}: rawVideos=${allVideos.length}, uploadsPlaylists=${uploadsPlaylistIds.length}`,
    );
    this.logger.log(
      `Initial pulled videos before dedupe/filter user=${userId}: ${JSON.stringify(
        allVideos.map((video) => ({
          youtubeVideoId: video.youtubeVideoId,
          channelId: video.channelId,
        })),
      )}`,
    );

    const byId = new Map<string, RecentVideo>();
    for (const v of allVideos) {
      const prev = byId.get(v.youtubeVideoId);
      if (!prev || v.publishedAt.getTime() > prev.publishedAt.getTime()) {
        byId.set(v.youtubeVideoId, v);
      }
    }
    const deduped = [...byId.values()];
    deduped.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
    this.logger.log(
      `Dedup summary for user=${userId}: deduped=${deduped.length}`,
    );

    const apiFiltered = await this.filterHarvestVideosWithDataApi(
      youtube,
      deduped,
    );
    apiFiltered.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
    const finalVideos = await this.selectVideosWithTranscriptAvailability(
      apiFiltered,
      options.maxTotal,
    );
    this.logger.log(
      `Harvest recent videos end: user=${userId}, apiFiltered=${apiFiltered.length}, returned=${finalVideos.length}, sampleIds=${finalVideos
        .slice(0, 5)
        .map((v) => v.youtubeVideoId)
        .join(",")}`,
    );
    return finalVideos;
  }

  private getTranscriptFailedRetryMinutes(): number {
    const configured = Number(
      this.config.get<string>("TRANSCRIPT_CACHE_FAILED_RETRY_MINUTES", "60"),
    );
    if (!Number.isFinite(configured) || configured <= 0) return 60;
    return Math.floor(configured);
  }

  private getTranscriptUnavailableRetryHours(): number {
    const configured = Number(
      this.config.get<string>("TRANSCRIPT_CACHE_UNAVAILABLE_RETRY_HOURS", "24"),
    );
    if (!Number.isFinite(configured) || configured <= 0) return 24;
    return Math.floor(configured);
  }

  private classifyTranscriptError(message: string): "UNAVAILABLE" | "FAILED" {
    const normalized = message.toLowerCase();
    if (
      normalized.includes("transcript is disabled") ||
      normalized.includes("transcript disabled") ||
      normalized.includes("no transcripts") ||
      normalized.includes("could not retrieve") ||
      normalized.includes("not available")
    ) {
      return "UNAVAILABLE";
    }
    return "FAILED";
  }

  private shouldRetryTranscriptFetch(cache: {
    status: "READY" | "UNAVAILABLE" | "FAILED";
    lastAttemptAt: Date | null;
  }): boolean {
    if (cache.status === "READY") return false;
    const now = Date.now();
    const lastAttempt = cache.lastAttemptAt?.getTime() ?? 0;
    if (cache.status === "FAILED") {
      return now - lastAttempt >= this.getTranscriptFailedRetryMinutes() * 60 * 1000;
    }
    return now - lastAttempt >= this.getTranscriptUnavailableRetryHours() * 60 * 60 * 1000;
  }

  private async fetchAndStoreTranscript(youtubeVideoId: string): Promise<{
    transcript: string | null;
    status: "READY" | "UNAVAILABLE" | "FAILED";
    reason: string;
  }> {
    try {
      const { YoutubeTranscript } = await import("youtube-transcript");
      const transcript = await YoutubeTranscript.fetchTranscript(youtubeVideoId);
      const text = transcript.map((t) => t.text).join(" ").trim();
      if (!text) {
        await this.prisma.videoTranscriptCache.upsert({
          where: { youtubeVideoId },
          create: {
            youtubeVideoId,
            transcript: null,
            status: "UNAVAILABLE",
            source: "youtube-transcript",
            error: "Empty transcript payload",
            lastAttemptAt: new Date(),
          },
          update: {
            transcript: null,
            status: "UNAVAILABLE",
            source: "youtube-transcript",
            error: "Empty transcript payload",
            lastAttemptAt: new Date(),
          },
        });
        this.logger.warn(`Transcript fetch empty payload for video=${youtubeVideoId}`);
        return {
          transcript: null,
          status: "UNAVAILABLE",
          reason: "fetch_empty_payload",
        };
      }
      await this.prisma.videoTranscriptCache.upsert({
        where: { youtubeVideoId },
        create: {
          youtubeVideoId,
          transcript: text,
          status: "READY",
          source: "youtube-transcript",
          error: null,
          lastAttemptAt: new Date(),
        },
        update: {
          transcript: text,
          status: "READY",
          source: "youtube-transcript",
          error: null,
          lastAttemptAt: new Date(),
        },
      });
      this.logger.log(
        `Transcript fetched and cached for video=${youtubeVideoId}, length=${text.length}`,
      );
      return { transcript: text, status: "READY", reason: "fetched_ok" };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = this.classifyTranscriptError(message);
      await this.prisma.videoTranscriptCache.upsert({
        where: { youtubeVideoId },
        create: {
          youtubeVideoId,
          transcript: null,
          status,
          source: "youtube-transcript",
          error: message.slice(0, 500),
          lastAttemptAt: new Date(),
        },
        update: {
          transcript: null,
          status,
          source: "youtube-transcript",
          error: message.slice(0, 500),
          lastAttemptAt: new Date(),
        },
      });
      this.logger.warn(`Transcript unavailable for ${youtubeVideoId}: ${message}`);
      return {
        transcript: null,
        status,
        reason: `fetch_exception:${message.slice(0, 180)}`,
      };
    }
  }

  private async getOrFetchTranscript(
    youtubeVideoId: string,
  ): Promise<{
    transcript: string | null;
    source: "cache" | "fetched" | "cooldown_skip";
    reason: string;
  }> {
    const cached = await this.prisma.videoTranscriptCache.findUnique({
      where: { youtubeVideoId },
      select: { transcript: true, status: true, lastAttemptAt: true },
    });
    if (cached?.status === "READY" && cached.transcript?.trim()) {
      this.logger.log(
        `Transcript cache hit for video=${youtubeVideoId}, length=${cached.transcript.length}`,
      );
      return {
        transcript: cached.transcript,
        source: "cache",
        reason: "cache_ready",
      };
    }
    if (cached && !this.shouldRetryTranscriptFetch(cached)) {
      this.logger.log(
        `Transcript cache cooldown skip for video=${youtubeVideoId}, status=${cached.status}, lastAttemptAt=${cached.lastAttemptAt?.toISOString() ?? "null"}`,
      );
      return {
        transcript: null,
        source: "cooldown_skip",
        reason:
          cached.status === "UNAVAILABLE"
            ? "cache_cooldown_unavailable"
            : "cache_cooldown_failed",
      };
    }
    if (cached) {
      this.logger.log(
        `Transcript cache retry allowed for video=${youtubeVideoId}, previousStatus=${cached.status}, lastAttemptAt=${cached.lastAttemptAt?.toISOString() ?? "null"}`,
      );
    } else {
      this.logger.log(`Transcript cache miss for video=${youtubeVideoId}`);
    }
    const fetched = await this.fetchAndStoreTranscript(youtubeVideoId);
    return {
      transcript: fetched.transcript,
      source: "fetched",
      reason: fetched.reason,
    };
  }

  async prefetchTranscriptsForSelectedChannels(userId: string): Promise<void> {
    const lookbackDays = Number(this.config.get<string>("MAX_HARVEST_LOOKBACK_DAYS", "14"));
    const maxPerChannel = Number(this.config.get<string>("MAX_HARVEST_PER_CHANNEL", "10"));
    const maxTotal = Number(this.config.get<string>("MAX_HARVEST_PER_USER", "50"));
    const videos = await this.getRecentVideosForHarvest(userId, {
      lookbackDays: Number.isFinite(lookbackDays) && lookbackDays > 0 ? lookbackDays : 14,
      maxPerChannel:
        Number.isFinite(maxPerChannel) && maxPerChannel > 0 ? maxPerChannel : 10,
      maxTotal: Number.isFinite(maxTotal) && maxTotal > 0 ? maxTotal : 50,
    });

    let cacheHits = 0;
    let fetched = 0;
    let unavailable = 0;
    let failed = 0;
    let cooldownSkipped = 0;

    for (const video of videos) {
      const existing = await this.prisma.videoTranscriptCache.findUnique({
        where: { youtubeVideoId: video.youtubeVideoId },
        select: { status: true, transcript: true },
      });
      if (existing?.status === "READY" && existing.transcript?.trim()) {
        cacheHits += 1;
        continue;
      }
      const result = await this.getOrFetchTranscript(video.youtubeVideoId);
      if (result.source === "cooldown_skip") {
        cooldownSkipped += 1;
        continue;
      }
      if (result.source === "fetched") fetched += 1;
      if (!result.transcript) {
        const status = await this.prisma.videoTranscriptCache.findUnique({
          where: { youtubeVideoId: video.youtubeVideoId },
          select: { status: true },
        });
        if (status?.status === "UNAVAILABLE") unavailable += 1;
        else failed += 1;
      }
    }

    this.logger.log(
      `Transcript prefetch completed for user=${userId}: scanned=${videos.length}, cacheHits=${cacheHits}, fetched=${fetched}, cooldownSkipped=${cooldownSkipped}, unavailable=${unavailable}, failed=${failed}`,
    );
  }

  async getTranscript(youtubeVideoId: string): Promise<string | null> {
    const result = await this.getOrFetchTranscript(youtubeVideoId);
    if (!result.transcript) {
      this.logger.warn(
        `Transcript not available for video=${youtubeVideoId}, source=${result.source}, reason=${result.reason}`,
      );
    }
    return result.transcript;
  }
}
