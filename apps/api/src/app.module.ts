import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { GraphQLModule } from "@nestjs/graphql";
import { ApolloDriver, ApolloDriverConfig } from "@nestjs/apollo";
import { join } from "path";
import type { Request, Response } from "express";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { YouTubeModule } from "./modules/youtube/youtube.module";
import { VeniceModule } from "./modules/venice/venice.module";
import { ElevenLabsModule } from "./modules/elevenlabs/elevenlabs.module";
import { VoicesModule } from "./modules/voices/voices.module";
import { StorageModule } from "./modules/storage/storage.module";
import { ContentModule } from "./modules/content/content.module";
import { FeedModule } from "./modules/feed/feed.module";
import { VotingModule } from "./modules/voting/voting.module";
import { CommentsModule } from "./modules/comments/comments.module";
import { SchedulerModule } from "./modules/scheduler/scheduler.module";
import { ProcessingModule } from "./modules/processing/processing.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), "src/schema.gql"),
      sortSchema: true,
      context: ({ req, res }: { req: Request; res: Response }) => ({
        req,
        res,
      }),
      playground: true,
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    YouTubeModule,
    VeniceModule,
    ElevenLabsModule,
    VoicesModule,
    StorageModule,
    ContentModule,
    FeedModule,
    VotingModule,
    CommentsModule,
    SchedulerModule,
    ProcessingModule,
  ],
})
export class AppModule {}
