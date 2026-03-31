import { randomUUID } from "crypto";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { VoyageEmbeddingsService } from "../embeddings/voyage-embeddings.service";

@Injectable()
export class TranscriptEmbeddingIndexerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: VoyageEmbeddingsService,
  ) {}

  private vectorLiteral(values: number[]): string {
    return `[${values.join(",")}]`;
  }

  async indexTranscript(params: {
    userId: string;
    processedVideoId: string;
    transcript: string;
  }) {
    const { userId, processedVideoId, transcript } = params;
    const embedded = await this.embeddings.embedTranscript(transcript);
    await this.prisma.videoEmbeddingChunk.deleteMany({
      where: { processedVideoId },
    });
    for (const row of embedded) {
      const vector = this.vectorLiteral(row.embedding);
      await this.prisma.$executeRawUnsafe(
        `
          INSERT INTO "VideoEmbeddingChunk"
          ("id","userId","processedVideoId","chunkIndex","content","tokenCount","embedding","createdAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7::vector, NOW())
        `,
        randomUUID(),
        userId,
        processedVideoId,
        row.chunkIndex,
        row.content,
        row.tokenCount,
        vector,
      );
    }
    return embedded.length;
  }
}
