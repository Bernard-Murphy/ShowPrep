import { Args, Mutation, Query, Resolver } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ProcessingService } from "./processing.service";
import { ProcessingJobEntity } from "./models/processing.model";

@Resolver(() => ProcessingJobEntity)
export class ProcessingResolver {
  constructor(private readonly processing: ProcessingService) {}

  @Mutation(() => ProcessingJobEntity)
  @UseGuards(JwtAuthGuard)
  startHarvest(
    @CurrentUser() user: { id: string },
    @Args("type", { type: () => String, nullable: true }) type?: string,
  ) {
    const normalizedType = type === "RECURRING" ? "RECURRING" : "INITIAL";
    return this.processing.enqueueVideoProcessing(user.id, normalizedType);
  }

  @Query(() => ProcessingJobEntity, { nullable: true })
  @UseGuards(JwtAuthGuard)
  processingJob(
    @CurrentUser() user: { id: string },
    @Args("jobId") jobId: string,
  ) {
    return this.processing.getJob(jobId, user.id);
  }

  @Query(() => ProcessingJobEntity, { nullable: true })
  @UseGuards(JwtAuthGuard)
  latestProcessingJob(@CurrentUser() user: { id: string }) {
    return this.processing.getLatestJob(user.id);
  }
}
