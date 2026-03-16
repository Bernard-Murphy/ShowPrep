import { Module } from "@nestjs/common";
import { CommentsService } from "./comments.service";
import { CommentsResolver } from "./comments.resolver";

@Module({
  providers: [CommentsService, CommentsResolver],
  exports: [CommentsService],
})
export class CommentsModule {}
