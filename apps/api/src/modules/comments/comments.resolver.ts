import { Resolver, Mutation, Query, Args } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { CommentsService } from "./comments.service";
import { CommentEntity } from "./comments.model";
import { OptionalAuthGuard } from "../../common/guards/optional-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";

@Resolver(() => CommentEntity)
export class CommentsResolver {
  constructor(private readonly commentsService: CommentsService) {}

  @Mutation(() => CommentEntity)
  @UseGuards(OptionalAuthGuard)
  createComment(
    @CurrentUser() user: { id: string } | null,
    @Args("targetType") targetType: "ARTICLE" | "GENCAST" | "USER_PROFILE",
    @Args("targetId", { type: () => String, nullable: true })
    targetId: string | null,
    @Args("profileUserId", { type: () => String, nullable: true })
    profileUserId: string | null,
    @Args("text") text: string,
    @Args("repliesTo", { type: () => String, nullable: true })
    repliesTo: string | null,
    @Args("anonymous", { type: () => Boolean, nullable: true })
    anonymous?: boolean,
    @Args("anonId", { type: () => String, nullable: true })
    anonId?: string | null,
    @Args("anonTextColor", { type: () => String, nullable: true })
    anonTextColor?: string | null,
    @Args("anonTextBackground", { type: () => String, nullable: true })
    anonTextBackground?: string | null,
  ) {
    return this.commentsService.create(
      targetType,
      targetId,
      profileUserId,
      anonymous ? null : (user?.id ?? null),
      text,
      repliesTo,
      anonId ?? null,
      anonTextColor ?? null,
      anonTextBackground ?? null,
    );
  }

  @Query(() => [CommentEntity])
  comments(
    @Args("targetType") targetType: "ARTICLE" | "GENCAST" | "USER_PROFILE",
    @Args("targetId") targetId: string,
    @Args("profileUserId", { type: () => String, nullable: true })
    profileUserId: string | null,
  ) {
    return this.commentsService.findByTarget(
      targetType,
      targetId,
      profileUserId,
    );
  }
}
