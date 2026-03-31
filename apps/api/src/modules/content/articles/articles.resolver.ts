import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { ArticlesService } from './articles.service';
import { ArticleEntity } from './articles.model';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@Resolver(() => ArticleEntity)
export class ArticlesResolver {
  constructor(private readonly articles: ArticlesService) {}

  @Query(() => ArticleEntity, { nullable: true })
  article(@Args('slug') slug: string) {
    return this.articles.findBySlug(slug);
  }

  @Query(() => [ArticleEntity])
  userArticles(
    @Args('userId') userId: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ) {
    return this.articles.listByUser(userId, limit ?? 20);
  }

  @Mutation(() => Boolean)
  articleIncrementViews(@Args('slug') slug: string) {
    return this.articles.incrementViews(slug);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  articleSetPublic(
    @CurrentUser() user: { id: string },
    @Args('articleId') articleId: string,
    @Args('isPublic') isPublic: boolean,
  ) {
    return this.articles.setPublic(articleId, user.id, isPublic);
  }
}
