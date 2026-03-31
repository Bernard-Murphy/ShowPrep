CREATE TABLE "ProcessingProgressEvent" (
    "id" TEXT NOT NULL,
    "processingJobId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "progress" INTEGER NOT NULL,
    "processedCount" INTEGER NOT NULL,
    "totalCount" INTEGER NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcessingProgressEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProcessingProgressEvent_processingJobId_createdAt_idx"
ON "ProcessingProgressEvent"("processingJobId", "createdAt");

ALTER TABLE "ProcessingProgressEvent"
ADD CONSTRAINT "ProcessingProgressEvent_processingJobId_fkey"
FOREIGN KEY ("processingJobId") REFERENCES "ProcessingJob"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProcessingProgressEvent"
ADD CONSTRAINT "ProcessingProgressEvent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
