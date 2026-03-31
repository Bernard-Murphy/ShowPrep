import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { GencastsService } from './gencasts.service';
import { GencastEntity } from './gencasts.model';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@Resolver(() => GencastEntity)
export class GencastsResolver {
  constructor(private readonly gencasts: GencastsService) {}

  @Query(() => GencastEntity, { nullable: true })
  gencast(@Args('slug') slug: string) {
    return this.gencasts.findBySlug(slug);
  }

  @Query(() => [GencastEntity])
  userGencasts(
    @Args('userId') userId: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ) {
    return this.gencasts.listByUser(userId, limit ?? 20);
  }

  @Mutation(() => Boolean)
  gencastIncrementViews(@Args('slug') slug: string) {
    return this.gencasts.incrementViews(slug);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  gencastSetPublic(
    @CurrentUser() user: { id: string },
    @Args('gencastId') gencastId: string,
    @Args('isPublic') isPublic: boolean,
  ) {
    return this.gencasts.setPublic(gencastId, user.id, isPublic);
  }
}
