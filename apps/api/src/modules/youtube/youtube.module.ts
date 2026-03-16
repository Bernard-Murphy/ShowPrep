import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { YouTubeService } from './youtube.service';
import { YouTubeResolver } from './youtube.resolver';
import { YouTubeController } from './youtube.controller';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'showprep-jwt-secret-change-me'),
        signOptions: { expiresIn: '10m' },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [YouTubeService, YouTubeResolver],
  controllers: [YouTubeController],
  exports: [YouTubeService],
})
export class YouTubeModule {}
