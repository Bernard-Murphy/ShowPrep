import { ObjectType, Field, Int } from "@nestjs/graphql";

@ObjectType()
export class YouTubeAuthUrlResult {
  @Field()
  authUrl: string;
}

@ObjectType()
export class YouTubeSubscriptionEntity {
  @Field()
  id: string;

  @Field()
  channelId: string;

  @Field()
  channelTitle: string;

  @Field(() => String, { nullable: true })
  channelThumbnailUrl?: string | null;

  @Field(() => Int, { nullable: true })
  subscriberCount?: number | null;

  @Field(() => Date, { nullable: true })
  lastUploadedAt?: Date | null;

  @Field()
  active: boolean;
}
