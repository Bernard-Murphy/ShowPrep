import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class YouTubeAuthUrlResult {
  @Field()
  authUrl: string;
}
