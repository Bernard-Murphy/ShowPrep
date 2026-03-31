import { ObjectType, Field, Int } from "@nestjs/graphql";
import { VoiceEntity } from "@/modules/voices/models/voice.model";
import { UserSummary } from "@/modules/users/models/user.model";

@ObjectType()
export class GencastSourceEntity {
  @Field()
  id: string;

  @Field()
  processedVideoId: string;

  @Field()
  gencastId: string;
}

@ObjectType()
export class GencastEntity {
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
  scriptContent: string;

  @Field(() => String, { nullable: true })
  harvestOutline?: string | null;

  @Field(() => String, { nullable: true })
  audioUrl?: string | null;

  @Field(() => String, { nullable: true })
  headlineImageUrl?: string | null;

  @Field()
  voiceId: string;

  @Field(() => VoiceEntity, { nullable: true })
  voice?: VoiceEntity | null;

  @Field(() => Int, { nullable: true })
  duration?: number | null;

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
