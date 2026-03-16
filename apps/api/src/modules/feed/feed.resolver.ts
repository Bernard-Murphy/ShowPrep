import { Resolver, Query, Args, Int } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { FeedService } from "./feed.service";
import { OptionalAuthGuard } from "../../common/guards/optional-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { FeedConnection, FeedEdge, FeedItemUnion } from "./feed.model";
import { ArticleEntity } from "../content/articles/articles.model";
import { GencastEntity } from "../content/gencasts/gencasts.model";

@Resolver()
export class FeedResolver {
  constructor(private readonly feedService: FeedService) {}

  @Query(() => FeedConnection)
  @UseGuards(OptionalAuthGuard)
  async feed(
    @CurrentUser() user: { id: string } | null,
    @Args("filter", { type: () => String, nullable: true }) filter?: string,
    @Args("sort", { type: () => String, nullable: true }) sort?: string,
    @Args("search", { type: () => String, nullable: true }) search?: string,
    @Args("limit", { type: () => Int, nullable: true }) limit?: number,
    @Args("cursor", { type: () => String, nullable: true }) cursor?: string,
  ) {
    const { items, nextCursor } = await this.feedService.getFeed(
      user?.id ?? null,
      {
        filter: (filter as "all" | "articles" | "gencasts") || "all",
        sort: (sort as "hot" | "newest" | "oldest" | "popular") || "hot",
        search: search ?? undefined,
        limit: limit ?? 20,
        cursor: cursor ?? undefined,
      },
    );
    return {
      edges: items.map((item) => ({ node: item, cursor: item.id })),
      nextCursor,
    };
  }

  @Query(() => [ArticleEntity])
  hotArticles(
    @Args("limit", { type: () => Int, nullable: true }) limit?: number,
  ) {
    return this.feedService.getHotArticles(limit ?? 12);
  }

  @Query(() => [GencastEntity])
  hotGencasts(
    @Args("limit", { type: () => Int, nullable: true }) limit?: number,
  ) {
    return this.feedService.getHotGencasts(limit ?? 12);
  }
}
