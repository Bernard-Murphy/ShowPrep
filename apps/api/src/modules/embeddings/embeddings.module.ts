import { Module } from "@nestjs/common";
import { VoyageEmbeddingsService } from "./voyage-embeddings.service";

@Module({
  providers: [VoyageEmbeddingsService],
  exports: [VoyageEmbeddingsService],
})
export class EmbeddingsModule {}
