import { ObjectType, Field } from "@nestjs/graphql";

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

  @Field()
  active: boolean;
}
