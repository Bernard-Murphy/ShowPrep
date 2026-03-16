import { Resolver, Mutation, Query, Args } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { VotingService } from "./voting.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { OptionalAuthGuard } from "../../common/guards/optional-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";

@Resolver()
export class VotingResolver {
  constructor(private readonly voting: VotingService) {}

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  vote(
    @CurrentUser() user: { id: string },
    @Args("targetType") targetType: "ARTICLE" | "GENCAST" | "COMMENT",
    @Args("targetId") targetId: string,
    @Args("value") value: number,
  ) {
    return this.voting.vote(user.id, targetType, targetId, value);
  }

  @Query(() => Number, { nullable: true })
  @UseGuards(OptionalAuthGuard)
  userVote(
    @CurrentUser() user: { id: string } | null,
    @Args("targetType") targetType: "ARTICLE" | "GENCAST" | "COMMENT",
    @Args("targetId") targetId: string,
  ) {
    return this.voting.getUserVote(user?.id ?? null, targetType, targetId);
  }
}
