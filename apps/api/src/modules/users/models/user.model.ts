import { ObjectType, Field, Int } from "@nestjs/graphql";

@ObjectType()
export class UserSummary {
  @Field()
  id: string;

  @Field(() => String, { nullable: true })
  displayName?: string | null;

  @Field(() => String, { nullable: true })
  avatarUrl?: string | null;
}

@ObjectType()
export class UserCount {
  @Field(() => Int)
  articles: number;

  @Field(() => Int)
  gencasts: number;

  @Field(() => Int)
  subscribers: number;
}

@ObjectType()
export class UserEntity {
  @Field()
  id: string;

  @Field(() => String, { nullable: true })
  displayName?: string | null;

  @Field(() => String, { nullable: true })
  avatarUrl?: string | null;

  @Field(() => String, { nullable: true })
  bio?: string | null;

  @Field()
  createdAt: Date;

  @Field(() => UserCount, { nullable: true })
  _count?: UserCount | null;
}
