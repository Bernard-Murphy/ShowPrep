import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { OpenAiService } from "../openai/openai.service";
import { RecentVideo, YouTubeService } from "../youtube/youtube.service";

type HarvestResult = {
  videos: RecentVideo[];
  skippedAsDuplicate: number;
  skippedAsNonInformational: number;
};

@Injectable()
export class VideoHarvestService {
  private readonly lookbackDays: number;
  private readonly maxPerChannel: number;
  private readonly maxPerUser: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly youtube: YouTubeService,
    private readonly openai: OpenAiService,
  ) {
    this.lookbackDays = Number(
      this.config.get<string>("MAX_HARVEST_LOOKBACK_DAYS", "14"),
    );
    this.maxPerChannel = Number(
      this.config.get<string>("MAX_HARVEST_PER_CHANNEL", "10"),
    );
    this.maxPerUser = Number(this.config.get<string>("MAX_HARVEST_PER_USER", "50"));
  }

  private heuristicDecision(video: RecentVideo): {
    known: boolean;
    isInformational: boolean;
    confidence: number;
    reason: string;
  } {
    const text = `${video.videoTitle} ${video.description ?? ""}`.toLowerCase();
    const nonInfoPatterns = [
      /\bmusic\b/,
      /\blyrics?\b/,
      /\bgame(play|ing)?\b/,
      /\blet'?s play\b/,
      /\bwalkthrough\b/,
      /\bclip\b/,
      /\bshorts?\b/,
      /\blive stream\b/,
      /\bfortnite\b/,
      /\bminecraft\b/,
      /\broblox\b/,
    ];
    if (nonInfoPatterns.some((pattern) => pattern.test(text))) {
      return {
        known: true,
        isInformational: false,
        confidence: 0.92,
        reason: "Heuristic matched entertainment keywords",
      };
    }

    const infoPatterns = [
      /\bexplained?\b/,
      /\banalysis\b/,
      /\bnews\b/,
      /\bupdate\b/,
      /\bbriefing\b/,
      /\breview\b/,
      /\btutorial\b/,
      /\binterview\b/,
      /\bpodcast\b/,
      /\bdeep dive\b/,
    ];
    if (infoPatterns.some((pattern) => pattern.test(text))) {
      return {
        known: true,
        isInformational: true,
        confidence: 0.84,
        reason: "Heuristic matched informational keywords",
      };
    }

    return {
      known: false,
      isInformational: true,
      confidence: 0.5,
      reason: "Heuristic uncertain",
    };
  }

  async collectHarvestCandidates(
    userId: string,
    selectedChannelIds?: string[],
  ): Promise<HarvestResult> {
    const candidates = await this.youtube.getRecentVideosForHarvest(userId, {
      lookbackDays: this.lookbackDays,
      maxPerChannel: this.maxPerChannel,
      maxTotal: this.maxPerUser,
      channelIds: selectedChannelIds,
    });

    if (candidates.length === 0) {
      return { videos: [], skippedAsDuplicate: 0, skippedAsNonInformational: 0 };
    }

    const existing = await this.prisma.processedVideo.findMany({
      where: {
        userId,
        youtubeVideoId: { in: candidates.map((video) => video.youtubeVideoId) },
      },
      select: { youtubeVideoId: true },
    });
    const existingIds = new Set(existing.map((row) => row.youtubeVideoId));

    let skippedAsDuplicate = 0;
    let skippedAsNonInformational = 0;
    const accepted: RecentVideo[] = [];

    for (const video of candidates) {
      if (existingIds.has(video.youtubeVideoId)) {
        skippedAsDuplicate += 1;
        continue;
      }

      const heuristic = this.heuristicDecision(video);
      let isInformational = heuristic.isInformational;
      let confidence = heuristic.confidence;
      let reason = heuristic.reason;
      let source = "heuristic";

      if (!heuristic.known) {
        const aiDecision = await this.openai.classifyVideoInformational({
          title: video.videoTitle,
          description: video.description,
          channelTitle: video.channelTitle,
        });
        isInformational = aiDecision.isInformational;
        confidence = aiDecision.confidence;
        reason = aiDecision.reason;
        source = "openai";
      }

      await this.prisma.videoFilterDecision.upsert({
        where: {
          userId_youtubeVideoId: {
            userId,
            youtubeVideoId: video.youtubeVideoId,
          },
        },
        create: {
          userId,
          youtubeVideoId: video.youtubeVideoId,
          videoTitle: video.videoTitle,
          channelTitle: video.channelTitle,
          isInformational,
          confidence,
          reason,
          source,
        },
        update: {
          isInformational,
          confidence,
          reason,
          source,
        },
      });

      if (!isInformational) {
        skippedAsNonInformational += 1;
        continue;
      }

      accepted.push(video);
      if (accepted.length >= this.maxPerUser) break;
    }

    return {
      videos: accepted,
      skippedAsDuplicate,
      skippedAsNonInformational,
    };
  }
}
