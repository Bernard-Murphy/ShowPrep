import { Module } from '@nestjs/common';
import { FeedService } from './feed.service';
import { FeedResolver } from './feed.resolver';

@Module({
  providers: [FeedService, FeedResolver],
  exports: [FeedService],
})
export class FeedModule {}
