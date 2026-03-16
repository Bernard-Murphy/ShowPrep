import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';

@Processor('video-processing')
export class VideoProcessingProcessor extends WorkerHost {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<{ userId: string; type: string }>): Promise<void> {
    const { userId, type } = job.data;
    await this.prisma.processingJob.create({
      data: { userId, type: type as 'INITIAL' | 'RECURRING', status: 'PROCESSING' },
    });
    // TODO: sync YouTube subs, fetch videos, transcripts, Venice article gen, images, gencast script, TTS, S3 upload
    await job.updateProgress(100);
  }
}
