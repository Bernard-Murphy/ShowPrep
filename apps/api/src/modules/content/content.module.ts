import { Module } from '@nestjs/common';
import { ArticlesService } from './articles/articles.service';
import { ArticlesResolver } from './articles/articles.resolver';
import { GencastsService } from './gencasts/gencasts.service';
import { GencastsResolver } from './gencasts/gencasts.resolver';

@Module({
  providers: [ArticlesService, ArticlesResolver, GencastsService, GencastsResolver],
  exports: [ArticlesService, GencastsService],
})
export class ContentModule {}
