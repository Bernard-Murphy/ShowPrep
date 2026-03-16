import { ObjectType, Field } from "@nestjs/graphql";

@ObjectType()
export class VoiceEntity {
  @Field()
  id: string;

  @Field()
  name: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field()
  provider: string;

  @Field()
  providerVoiceId: string;

  @Field(() => String, { nullable: true })
  gender?: string | null;

  @Field(() => String, { nullable: true })
  language?: string | null;

  @Field(() => String, { nullable: true })
  sampleUrl?: string | null;

  @Field()
  isDefault: boolean;

  @Field(() => String, { nullable: true })
  userId?: string | null;
}
