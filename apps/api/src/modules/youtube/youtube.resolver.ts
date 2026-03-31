import { Resolver, Mutation, Query } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { YouTubeService } from "./youtube.service";
import {
  YouTubeAuthUrlResult,
  YouTubeSubscriptionEntity,
} from "./models/youtube.model";
import { Args } from "@nestjs/graphql";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";

@Resolver()
export class YouTubeResolver {
  constructor(private readonly youtube: YouTubeService) {}

  @Query(() => YouTubeAuthUrlResult)
  @Public()
  youtubeLoginAuthUrl() {
    return this.youtube.getAuthUrlForLogin();
  }

  @Query(() => YouTubeAuthUrlResult)
  @UseGuards(JwtAuthGuard)
  youtubeAuthUrl(@CurrentUser() user: { id: string }) {
    return this.youtube.getAuthUrl(user.id);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  unlinkYouTube(@CurrentUser() user: { id: string }) {
    return this.youtube.unlink(user.id);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async syncYouTubeSubscriptions(@CurrentUser() user: { id: string }) {
    await this.youtube.syncSubscriptions(user.id);
    return true;
  }

  @Query(() => [YouTubeSubscriptionEntity])
  @UseGuards(JwtAuthGuard)
  youtubeSubscriptions(@CurrentUser() user: { id: string }) {
    return this.youtube.listSubscriptions(user.id);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async setYouTubeSubscriptionSelection(
    @CurrentUser() user: { id: string },
    @Args("channelIds", { type: () => [String] }) channelIds: string[],
  ) {
    await this.youtube.setActiveSubscriptions(user.id, channelIds);
    return true;
  }
}
