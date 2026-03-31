import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { YouTubeService } from '../../youtube/youtube.service';
import { VideoHarvestService } from '../video-harvest.service';
import { TranscriptEmbeddingIndexerService } from '../transcript-embedding-indexer.service';
import { ContentGenerationService } from '../content-generation.service';
import { ProcessingProgressService } from '../processing-progress.service';

@Processor('video-processing')
export class VideoProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(VideoProcessingProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly youtube: YouTubeService,
    private readonly harvest: VideoHarvestService,
    private readonly indexer: TranscriptEmbeddingIndexerService,
    private readonly contentGeneration: ContentGenerationService,
    private readonly progress: ProcessingProgressService,
  ) {
    super();
  }

  private async updateJob(params: {
    processingJobId: string;
    userId: string;
    status?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    stage: string;
    message: string;
    progress: number;
    processedCount?: number;
    totalCount?: number;
    error?: string | null;
  }) {
    const {
      processingJobId,
      userId,
      status,
      stage,
      message,
      progress,
      processedCount,
      totalCount,
      error,
    } = params;
    await this.prisma.processingJob.update({
      where: { id: processingJobId },
      data: {
        ...(status ? { status } : {}),
        stage,
        message,
        progress,
        ...(processedCount !== undefined ? { processedCount } : {}),
        ...(totalCount !== undefined ? { totalCount } : {}),
        ...(error !== undefined ? { error } : {}),
      },
    });
    await this.progress.emit({
      jobId: processingJobId,
      userId,
      status: status ?? 'PROCESSING',
      stage,
      message,
      progress,
      processedCount: processedCount ?? 0,
      totalCount: totalCount ?? 0,
      error: error ?? null,
      createdAt: new Date().toISOString(),
    });
  }

  async process(
    job: Job<{ userId: string; type: 'INITIAL' | 'RECURRING'; processingJobId: string }>,
  ): Promise<void> {
    const { userId, processingJobId } = job.data;
    const startedAt = new Date();

    try {
      await this.prisma.processingJob.update({
        where: { id: processingJobId },
        data: { status: 'PROCESSING', startedAt, progress: 2 },
      });
      await this.updateJob({
        processingJobId,
        userId,
        status: 'PROCESSING',
        stage: 'sync_subscriptions',
        message: 'Syncing YouTube subscriptions',
        progress: 5,
      });
      await job.updateProgress(5);
      await this.youtube.syncSubscriptions(userId);

      await this.updateJob({
        processingJobId,
        userId,
        stage: 'select_candidates',
        message: 'Selecting recently published videos',
        progress: 15,
      });
      await job.updateProgress(15);
      const candidates = await this.harvest.collectHarvestCandidates(userId);
      const videos = candidates.videos;

      await this.updateJob({
        processingJobId,
        userId,
        stage: 'ingest_transcripts',
        message: `Processing ${videos.length} videos`,
        progress: 20,
        processedCount: 0,
        totalCount: videos.length,
      });
      await job.updateProgress(20);

      const processedVideoIds: string[] = [];
      const processedInputs: Array<{
        id: string;
        channelTitle: string;
        videoTitle: string;
        transcript: string;
      }> = [];

      for (let i = 0; i < videos.length; i += 1) {
        const candidate = videos[i];
        const transcript = await this.youtube.getTranscript(candidate.youtubeVideoId);
        const processed = await this.prisma.processedVideo.upsert({
          where: {
            userId_youtubeVideoId: {
              userId,
              youtubeVideoId: candidate.youtubeVideoId,
            },
          },
          create: {
            userId,
            youtubeVideoId: candidate.youtubeVideoId,
            channelId: candidate.channelId,
            channelTitle: candidate.channelTitle,
            videoTitle: candidate.videoTitle,
            description: candidate.description,
            thumbnailUrl: candidate.thumbnailUrl,
            publishedAt: candidate.publishedAt,
            transcript,
            processedAt: new Date(),
          },
          update: {
            channelId: candidate.channelId,
            channelTitle: candidate.channelTitle,
            videoTitle: candidate.videoTitle,
            description: candidate.description,
            thumbnailUrl: candidate.thumbnailUrl,
            publishedAt: candidate.publishedAt,
            transcript,
            processedAt: new Date(),
          },
        });
        processedVideoIds.push(processed.id);
        processedInputs.push({
          id: processed.id,
          channelTitle: processed.channelTitle,
          videoTitle: processed.videoTitle,
          transcript: processed.transcript,
        });

        await this.indexer.indexTranscript({
          userId,
          processedVideoId: processed.id,
          transcript,
        });

        await this.updateJob({
          processingJobId,
          userId,
          stage: 'embed_transcripts',
          message: `Embedded transcript ${i + 1} / ${videos.length}`,
          progress: Math.min(70, 20 + Math.floor(((i + 1) / Math.max(videos.length, 1)) * 50)),
          processedCount: i + 1,
          totalCount: videos.length,
        });
        await job.updateProgress(
          Math.min(70, 20 + Math.floor(((i + 1) / Math.max(videos.length, 1)) * 50)),
        );
      }

      await this.updateJob({
        processingJobId,
        userId,
        stage: 'generate_content',
        message: 'Generating summaries, gencast script, and outline',
        progress: 75,
        processedCount: videos.length,
        totalCount: videos.length,
      });
      await job.updateProgress(75);

      const articleSummaries = await this.contentGeneration.generateArticles(
        userId,
        processedInputs,
      );
      await this.contentGeneration.generateGencastAndOutline({
        userId,
        processedVideoIds,
        articleSummaries,
      });

      await this.prisma.processingJob.update({
        where: { id: processingJobId },
        data: {
          status: 'COMPLETED',
          stage: 'completed',
          message: 'Harvest completed',
          progress: 100,
          processedCount: videos.length,
          totalCount: videos.length,
          completedAt: new Date(),
          error: null,
        },
      });

      await this.progress.emit({
        jobId: processingJobId,
        userId,
        status: 'COMPLETED',
        stage: 'completed',
        message: 'Harvest completed',
        progress: 100,
        processedCount: videos.length,
        totalCount: videos.length,
        createdAt: new Date().toISOString(),
      });
      await job.updateProgress(100);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`video-processing failed: ${message}`);
      await this.prisma.processingJob.update({
        where: { id: processingJobId },
        data: {
          status: 'FAILED',
          stage: 'failed',
          message: 'Harvest failed',
          error: message,
          completedAt: new Date(),
        },
      });
      await this.progress.emit({
        jobId: processingJobId,
        userId,
        status: 'FAILED',
        stage: 'failed',
        message: 'Harvest failed',
        progress: 100,
        processedCount: 0,
        totalCount: 0,
        error: message,
        createdAt: new Date().toISOString(),
      });
      throw error;
    }
  }
}
