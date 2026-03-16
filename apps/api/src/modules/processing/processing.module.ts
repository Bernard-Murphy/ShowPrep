import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ProcessingService } from "./processing.service";
import { VideoProcessingProcessor } from "./processors/video-processing.processor";
import { YouTubeModule } from "../youtube/youtube.module";
import { VeniceModule } from "../venice/venice.module";
import { VoicesModule } from "../voices/voices.module";
import { StorageModule } from "../storage/storage.module";

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const url = config.get("REDIS_URL", "redis://localhost:6379");
        try {
          const u = new URL(url);
          return {
            connection: {
              host: u.hostname,
              port: parseInt(u.port || "6379", 10),
              password: u.password || undefined,
            },
          };
        } catch {
          return { connection: { host: "localhost", port: 6379 } };
        }
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: "video-processing" },
      { name: "gencast-generation" },
    ),
    YouTubeModule,
    VeniceModule,
    VoicesModule,
    StorageModule,
  ],
  providers: [ProcessingService, VideoProcessingProcessor],
  exports: [ProcessingService],
})
export class ProcessingModule {}
