import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { ElevenLabsService } from "../elevenlabs/elevenlabs.service";
import { OpenAiService } from "../openai/openai.service";
import { StorageService } from "../storage/storage.service";

type ProcessedVideoInput = {
  id: string;
  channelTitle: string;
  videoTitle: string;
  transcript: string;
};

@Injectable()
export class ContentGenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openai: OpenAiService,
    private readonly elevenlabs: ElevenLabsService,
    private readonly storage: StorageService,
  ) {}

  private slugify(input: string) {
    const base = input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
    const suffix = Math.random().toString(36).slice(2, 8);
    return `${base || "item"}-${suffix}`;
  }

  async generateArticles(userId: string, videos: ProcessedVideoInput[]) {
    const summaries: string[] = [];
    for (const video of videos) {
      const content = await this.openai.generateArticleSummary(
        video.transcript,
        video.channelTitle,
        video.videoTitle,
      );
      summaries.push(content);
      const existing = await this.prisma.article.findUnique({
        where: { processedVideoId: video.id },
      });
      if (existing) continue;
      await this.prisma.article.create({
        data: {
          userId,
          processedVideoId: video.id,
          title: `${video.videoTitle} - Summary`,
          slug: this.slugify(video.videoTitle),
          content,
          sourceChannelTitle: video.channelTitle,
          sourceVideoTitle: video.videoTitle,
        },
      });
    }
    return summaries;
  }

  async generateGencastAndOutline(params: {
    userId: string;
    processedVideoIds: string[];
    articleSummaries: string[];
  }) {
    const { userId, processedVideoIds, articleSummaries } = params;
    if (articleSummaries.length === 0) return null;

    const scriptContent = await this.openai.generateGencastScript(articleSummaries);
    const outline = await this.openai.generateHarvestOutline(articleSummaries);

    const defaultVoiceId = process.env.ELEVENLABS_DEFAULT_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";
    const voice = await this.prisma.voice.upsert({
      where: {
        provider_providerVoiceId: {
          provider: "ELEVENLABS",
          providerVoiceId: defaultVoiceId,
        },
      },
      create: {
        name: "ElevenLabs Default",
        provider: "ELEVENLABS",
        providerVoiceId: defaultVoiceId,
        isDefault: true,
      },
      update: {
        isDefault: true,
      },
    });

    const audioBuffer = await this.elevenlabs.textToSpeech(scriptContent, voice.providerVoiceId);
    const audioUrl = await this.storage.uploadAudio(audioBuffer, `gencasts/${userId}`);

    const gencast = await this.prisma.gencast.create({
      data: {
        userId,
        title: `Daily Harvest - ${new Date().toISOString().slice(0, 10)}`,
        slug: this.slugify(`daily-harvest-${Date.now()}`),
        scriptContent,
        harvestOutline: outline,
        audioUrl,
        voiceId: voice.id,
        isPublic: false,
        sources: {
          create: processedVideoIds.map((processedVideoId) => ({ processedVideoId })),
        },
      },
    });
    return gencast;
  }
}
