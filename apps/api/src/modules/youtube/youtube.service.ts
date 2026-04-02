import {
  Injectable,
  ForbiddenException,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly storage: StorageService,
  ) {
    this.clientId = this.config.get<string>("YOUTUBE_CLIENT_ID", "");
    this.clientSecret = this.config.get<string>("YOUTUBE_CLIENT_SECRET", "");
    this.redirectUri = this.config.get<string>("YOUTUBE_REDIRECT_URI", "");
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

    const allVideos: RecentVideo[] = [];
    for (const playlistId of uploadsPlaylistIds) {
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
          allVideos.push({
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
          if (allVideos.length >= options.maxTotal) break;
        }
        pageToken = res.data.nextPageToken ?? undefined;
      } while (
        pageToken &&
        perChannelCount < options.maxPerChannel &&
        allVideos.length < options.maxTotal
      );
      if (allVideos.length >= options.maxTotal) break;
    }

    allVideos.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
    return allVideos.slice(0, options.maxTotal);
  }

  async getTranscript(youtubeVideoId: string): Promise<string> {
    const { YoutubeTranscript } = await import("youtube-transcript");
    const transcript = await YoutubeTranscript.fetchTranscript(youtubeVideoId);
    return transcript.map((t) => t.text).join(" ");
  }
}
