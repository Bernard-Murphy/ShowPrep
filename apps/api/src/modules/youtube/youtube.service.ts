import { Injectable, ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../../prisma/prisma.service";
import { google } from "googleapis";
import { randomBytes } from "crypto";

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

@Injectable()
export class YouTubeService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
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
    let payload: { sub?: string; purpose?: string };
    try {
      payload = this.jwtService.verify(state) as {
        sub?: string;
        purpose?: string;
      };
    } catch {
      throw new ForbiddenException("Invalid or expired state");
    }

    const oauth2Client = this.buildOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    if (!tokens.access_token || !tokens.refresh_token) {
      throw new ForbiddenException("Missing tokens from YouTube");
    }

    const youtube = google.youtube({ version: "v3", auth: oauth2Client });
    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000);

    if (payload.purpose === "youtube-link" && payload.sub) {
      const userId = payload.sub;
      const channelRes = await youtube.channels.list({
        part: ["id"],
        mine: true,
      });
      const channelId = channelRes.data.items?.[0]?.id ?? "";
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

      if (!channelId) {
        throw new ForbiddenException("No YouTube channel found");
      }

      const existing = await this.prisma.youTubeConnection.findFirst({
        where: { channelId },
      });

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
            channelThumbnailUrl,
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
        await this.prisma.youTubeConnection.create({
          data: {
            userId,
            channelId,
            channelTitle,
            channelThumbnailUrl,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            tokenExpiresAt: expiresAt,
          },
        });
      }

      const accessToken = this.jwtService.sign(
        { sub: userId },
        { expiresIn: "7d" },
      );
      return { userId, accessToken };
    }

    throw new ForbiddenException("Invalid state");
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

  async syncSubscriptions(userId: string): Promise<number> {
    const oauth2Client = await this.getOAuth2Client(userId);
    if (!oauth2Client) throw new ForbiddenException("YouTube not linked");

    const youtube = google.youtube({ version: "v3", auth: oauth2Client });
    const connection = await this.prisma.youTubeConnection.findUnique({
      where: { userId },
    });
    if (!connection) return 0;

    let pageToken: string | undefined;
    let total = 0;
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
        const channelTitle = item.snippet?.title ?? "";
        const thumb = item.snippet?.thumbnails?.default?.url ?? null;
        await this.prisma.youTubeSubscription.upsert({
          where: {
            youtubeConnectionId_channelId: {
              youtubeConnectionId: connection.id,
              channelId,
            },
          },
          create: {
            youtubeConnectionId: connection.id,
            channelId,
            channelTitle,
            channelThumbnailUrl: thumb,
          },
          update: { channelTitle, channelThumbnailUrl: thumb, active: true },
        });
        total++;
      }
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);

    await this.prisma.youTubeConnection.update({
      where: { userId },
      data: { lastSyncAt: new Date() },
    });
    return total;
  }

  async getRecentVideosFromSubscriptions(
    userId: string,
    limit: number,
  ): Promise<RecentVideo[]> {
    const conn = await this.getConnection(userId);
    if (!conn || conn.subscriptions.length === 0) return [];

    const oauth2Client = await this.getOAuth2Client(userId);
    if (!oauth2Client) return [];

    const youtube = google.youtube({ version: "v3", auth: oauth2Client });

    const channelIds = conn.subscriptions
      .filter((s: { active: boolean }) => s.active)
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
      do {
        const res = await youtube.playlistItems.list({
          part: ["snippet"],
          playlistId,
          maxResults: Math.min(50, limit - allVideos.length),
          pageToken,
        });
        for (const item of res.data.items ?? []) {
          const vid = item.snippet;
          if (!vid?.resourceId?.videoId) continue;
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
            publishedAt: vid.publishedAt
              ? new Date(vid.publishedAt)
              : new Date(),
          });
        }
        pageToken = res.data.nextPageToken ?? undefined;
      } while (pageToken && allVideos.length < limit);
      if (allVideos.length >= limit) break;
    }

    allVideos.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
    return allVideos.slice(0, limit);
  }

  async getTranscript(youtubeVideoId: string): Promise<string> {
    const { YoutubeTranscript } = await import("youtube-transcript");
    const transcript = await YoutubeTranscript.fetchTranscript(youtubeVideoId);
    return transcript.map((t) => t.text).join(" ");
  }
}
