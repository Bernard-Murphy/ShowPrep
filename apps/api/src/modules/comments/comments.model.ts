import { ObjectType, Field, Int } from "@nestjs/graphql";

@ObjectType()
export class CommentUser {
  @Field()
  id: string;

  @Field(() => String, { nullable: true })
  displayName?: string | null;

  @Field(() => String, { nullable: true })
  avatarUrl?: string | null;
}

@ObjectType()
export class CommentEntity {
  @Field()
  id: string;

  @Field()
  targetType: string;

  @Field(() => String, { nullable: true })
  articleId?: string | null;

  @Field(() => String, { nullable: true })
  gencastId?: string | null;

  @Field(() => String, { nullable: true })
  profileUserId?: string | null;

  @Field(() => String, { nullable: true })
  userId?: string | null;

  @Field(() => CommentUser, { nullable: true })
  user?: CommentUser | null;

  @Field()
  text: string;

  @Field(() => String, { nullable: true })
  repliesTo?: string | null;

  @Field(() => Int)
  karma: number;

  @Field(() => String, { nullable: true })
  anonId?: string | null;

  @Field(() => String, { nullable: true })
  anonTextColor?: string | null;

  @Field(() => String, { nullable: true })
  anonTextBackground?: string | null;

  @Field()
  removed: boolean;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => [CommentEntity], { nullable: true })
  replies?: CommentEntity[];
}
