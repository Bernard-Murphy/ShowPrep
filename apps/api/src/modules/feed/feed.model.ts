import { ObjectType, Field, createUnionType } from "@nestjs/graphql";
import { ArticleEntity } from "../content/articles/articles.model";
import { GencastEntity } from "../content/gencasts/gencasts.model";

export const FeedItemUnion = createUnionType({
  name: "FeedItem",
  types: () => [ArticleEntity, GencastEntity] as const,
  resolveType(value: { type?: string }) {
    if (value.type === "article") return ArticleEntity;
    if (value.type === "gencast") return GencastEntity;
    return ArticleEntity;
  },
});

@ObjectType()
export class FeedEdge {
  @Field(() => FeedItemUnion)
  node: unknown;

  @Field()
  cursor: string;
}

@ObjectType()
export class FeedConnection {
  @Field(() => [FeedEdge])
  edges: FeedEdge[];

  @Field(() => String, { nullable: true })
  nextCursor: string | null;
}
