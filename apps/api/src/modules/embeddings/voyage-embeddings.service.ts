import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

type ChunkPayload = {
  chunkIndex: number;
  content: string;
  tokenCount: number;
};

@Injectable()
export class VoyageEmbeddingsService {
  private readonly logger = new Logger(VoyageEmbeddingsService.name);
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly maxInputTokens: number;
  private readonly targetChunkTokens: number;
  private readonly overlapTokens: number;
  private readonly batchSize: number;
  private readonly batchTokenBudget: number;
  private readonly concurrency: number;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>("VOYAGE_API_KEY", "");
    this.model = this.config.get<string>("VOYAGE_EMBED_MODEL", "voyage-3-lite");
    this.baseUrl = this.config.get<string>(
      "VOYAGE_BASE_URL",
      "https://api.voyageai.com/v1",
    );
    this.maxInputTokens = Number(
      this.config.get<string>("RAG_EMBED_MAX_INPUT_TOKENS", "7000"),
    );
    this.targetChunkTokens = Number(
      this.config.get<string>("RAG_CHUNK_TARGET_TOKENS", "512"),
    );
    this.overlapTokens = Number(
      this.config.get<string>("RAG_CHUNK_OVERLAP_TOKENS", "64"),
    );
    this.batchSize = Number(this.config.get<string>("RAG_EMBED_BATCH_SIZE", "48"));
    this.batchTokenBudget = Number(
      this.config.get<string>("RAG_EMBED_BATCH_TOKEN_BUDGET", "6000"),
    );
    this.concurrency = Number(
      this.config.get<string>("RAG_EMBED_CONCURRENCY", "6"),
    );
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  chunkTranscript(transcript: string): ChunkPayload[] {
    const words = transcript.split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];

    const chunks: ChunkPayload[] = [];
    const step = Math.max(1, this.targetChunkTokens - this.overlapTokens);
    let chunkIndex = 0;
    for (let start = 0; start < words.length; start += step) {
      const slice = words.slice(start, start + this.targetChunkTokens);
      if (slice.length === 0) break;
      const content = slice.join(" ").trim();
      if (!content) continue;
      chunks.push({
        chunkIndex,
        content,
        tokenCount: this.estimateTokens(content),
      });
      chunkIndex += 1;
    }
    return this.enforceMaxChunkTokens(chunks, this.maxInputTokens);
  }

  private enforceMaxChunkTokens(
    chunks: ChunkPayload[],
    maxTokens: number,
  ): ChunkPayload[] {
    const results: ChunkPayload[] = [];
    for (const chunk of chunks) {
      if (chunk.tokenCount <= maxTokens) {
        results.push(chunk);
        continue;
      }
      const words = chunk.content.split(/\s+/).filter(Boolean);
      const pieceWordSize = Math.max(64, Math.floor((words.length * maxTokens) / chunk.tokenCount));
      for (let i = 0; i < words.length; i += pieceWordSize) {
        const content = words.slice(i, i + pieceWordSize).join(" ").trim();
        if (!content) continue;
        results.push({
          chunkIndex: results.length,
          content,
          tokenCount: this.estimateTokens(content),
        });
      }
    }
    return results;
  }

  private buildBatches(chunks: ChunkPayload[]): ChunkPayload[][] {
    const batches: ChunkPayload[][] = [];
    let current: ChunkPayload[] = [];
    let currentTokens = 0;

    for (const chunk of chunks) {
      const wouldExceedCount = current.length >= this.batchSize;
      const wouldExceedTokens =
        current.length > 0 &&
        currentTokens + chunk.tokenCount > this.batchTokenBudget;
      if (wouldExceedCount || wouldExceedTokens) {
        batches.push(current);
        current = [];
        currentTokens = 0;
      }
      current.push(chunk);
      currentTokens += chunk.tokenCount;
    }
    if (current.length > 0) batches.push(current);
    return batches;
  }

  private async embedTexts(texts: string[]): Promise<number[][]> {
    let attempt = 0;
    let waitMs = 500;
    while (attempt < 4) {
      attempt += 1;
      const res = await fetch(`${this.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          input_type: "document",
          input: texts,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          data?: Array<{ embedding?: number[] }>;
        };
        return (data.data ?? []).map((d) => d.embedding ?? []);
      }

      const body = await res.text();
      if (res.status === 429 || res.status >= 500) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        waitMs *= 2;
        continue;
      }
      throw new Error(`Voyage embeddings failed (${res.status}): ${body}`);
    }
    throw new Error("Voyage embeddings failed after retries");
  }

  private async embedBatchOrSplit(batch: ChunkPayload[]): Promise<number[][]> {
    try {
      return await this.embedTexts(batch.map((b) => b.content));
    } catch (error) {
      if (batch.length <= 1) {
        const fallbackMaxTokens = Math.max(512, Math.floor(this.maxInputTokens / 2));
        const normalized = this.enforceMaxChunkTokens(batch, fallbackMaxTokens);
        if (normalized.length <= 1) throw error;
        const rows: number[][] = [];
        for (const one of normalized) {
          const embedded = await this.embedTexts([one.content]);
          rows.push(embedded[0] ?? []);
        }
        return rows;
      }
      const mid = Math.floor(batch.length / 2);
      const [left, right] = await Promise.all([
        this.embedBatchOrSplit(batch.slice(0, mid)),
        this.embedBatchOrSplit(batch.slice(mid)),
      ]);
      return [...left, ...right];
    }
  }

  async embedTranscript(transcript: string): Promise<Array<ChunkPayload & { embedding: number[] }>> {
    const chunks = this.chunkTranscript(transcript);
    if (chunks.length === 0) return [];
    const batches = this.buildBatches(chunks);
    const embeddedRows: Array<ChunkPayload & { embedding: number[] }> = [];

    let cursor = 0;
    const workers = Array.from({ length: Math.min(this.concurrency, batches.length) }).map(
      async () => {
        while (cursor < batches.length) {
          const index = cursor++;
          const batch = batches[index];
          if (!batch) continue;
          const vectors = await this.embedBatchOrSplit(batch);
          for (let i = 0; i < batch.length; i += 1) {
            embeddedRows.push({
              ...batch[i],
              embedding: vectors[i] ?? [],
            });
          }
        }
      },
    );
    await Promise.all(workers);
    this.logger.log(`Embedded transcript chunks=${embeddedRows.length}`);
    return embeddedRows.sort((a, b) => a.chunkIndex - b.chunkIndex);
  }
}
