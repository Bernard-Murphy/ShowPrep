CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "ProcessingJob"
ADD COLUMN "stage" TEXT,
ADD COLUMN "message" TEXT,
ADD COLUMN "progress" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Gencast"
ADD COLUMN "harvestOutline" TEXT;

CREATE TABLE "VideoEmbeddingChunk" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "processedVideoId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "tokenCount" INTEGER NOT NULL,
    "embedding" vector(512) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VideoEmbeddingChunk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VideoFilterDecision" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "youtubeVideoId" TEXT NOT NULL,
    "videoTitle" TEXT NOT NULL,
    "channelTitle" TEXT NOT NULL,
    "isInformational" BOOLEAN NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VideoFilterDecision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VideoEmbeddingChunk_processedVideoId_chunkIndex_idx"
ON "VideoEmbeddingChunk"("processedVideoId", "chunkIndex");

CREATE INDEX "VideoEmbeddingChunk_embedding_hnsw_idx"
ON "VideoEmbeddingChunk"
USING hnsw ("embedding" vector_cosine_ops);

CREATE UNIQUE INDEX "VideoFilterDecision_userId_youtubeVideoId_key"
ON "VideoFilterDecision"("userId", "youtubeVideoId");

ALTER TABLE "VideoEmbeddingChunk"
ADD CONSTRAINT "VideoEmbeddingChunk_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VideoEmbeddingChunk"
ADD CONSTRAINT "VideoEmbeddingChunk_processedVideoId_fkey"
FOREIGN KEY ("processedVideoId") REFERENCES "ProcessedVideo"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VideoFilterDecision"
ADD CONSTRAINT "VideoFilterDecision_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
