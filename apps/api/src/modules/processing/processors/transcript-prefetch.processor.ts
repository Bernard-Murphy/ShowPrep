import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { Logger } from "@nestjs/common";
import { YouTubeService } from "../../youtube/youtube.service";

@Processor("transcript-prefetch")
export class TranscriptPrefetchProcessor extends WorkerHost {
  private readonly logger = new Logger(TranscriptPrefetchProcessor.name);

  constructor(private readonly youtube: YouTubeService) {
    super();
  }

  async process(job: Job<{ userId: string }>): Promise<void> {
    const userId = job.data.userId;
    try {
      await this.youtube.prefetchTranscriptsForSelectedChannels(userId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Transcript prefetch failed for user=${userId}: ${message}`);
      throw error;
    }
  }
}
