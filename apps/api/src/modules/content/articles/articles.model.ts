import { ObjectType, Field, Int } from "@nestjs/graphql";
import { UserSummary } from "@/modules/users/models/user.model";

@ObjectType()
export class ArticleEntity {
  @Field()
  id: string;

  @Field()
  userId: string;

  @Field(() => UserSummary, { nullable: true })
  user?: UserSummary | null;

  @Field()
  title: string;

  @Field()
  slug: string;

  @Field()
  content: string;

  @Field(() => String, { nullable: true })
  headlineImageUrl?: string | null;

  @Field()
  sourceChannelTitle: string;

  @Field()
  sourceVideoTitle: string;

  @Field(() => Int)
  views: number;

  @Field(() => Int)
  karma: number;

  @Field()
  hotScore: number;

  @Field()
  isPublic: boolean;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
