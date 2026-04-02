import { Module } from "@nestjs/common";
import { SchedulerService } from "./scheduler.service";
import { YouTubeModule } from "../youtube/youtube.module";

@Module({
  imports: [YouTubeModule],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
