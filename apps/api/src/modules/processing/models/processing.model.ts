import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class ProcessingJobEntity {
  @Field()
  id: string;

  @Field()
  userId: string;

  @Field()
  type: string;

  @Field()
  status: string;

  @Field(() => String, { nullable: true })
  stage?: string | null;

  @Field(() => String, { nullable: true })
  message?: string | null;

  @Field(() => Int)
  progress: number;

  @Field(() => Int)
  processedCount: number;

  @Field(() => Int)
  totalCount: number;

  @Field(() => String, { nullable: true })
  error?: string | null;

  @Field(() => Date, { nullable: true })
  startedAt?: Date | null;

  @Field(() => Date, { nullable: true })
  completedAt?: Date | null;

  @Field(() => Date)
  createdAt: Date;
}
