import { Resolver, Query, Mutation, Args } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { VoicesService } from "./voices.service";
import { VoiceEntity } from "./models/voice.model";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";

@Resolver(() => VoiceEntity)
export class VoicesResolver {
  constructor(private readonly voicesService: VoicesService) {}

  @Query(() => [VoiceEntity])
  voices(
    @Args("userId", { type: () => String, nullable: true })
    userId?: string | null,
  ) {
    return this.voicesService.listVoices(userId);
  }

  @Query(() => VoiceEntity, { nullable: true })
  voice(@Args("id") id: string) {
    return this.voicesService.getVoice(id);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  deleteVoice(@CurrentUser() user: { id: string }, @Args("id") id: string) {
    return this.voicesService.deleteVoice(id, user.id);
  }

  @Mutation(() => VoiceEntity)
  @UseGuards(JwtAuthGuard)
  async createCustomVoice(
    @CurrentUser() user: { id: string },
    @Args("name") name: string,
    @Args("sampleAudioBase64") sampleAudioBase64: string,
  ) {
    const audioBuffer = Buffer.from(sampleAudioBase64, "base64");
    return this.voicesService.createCustomVoice(user.id, name, audioBuffer);
  }
}
