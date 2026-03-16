import { Module } from '@nestjs/common';
import { VoicesService } from './voices.service';
import { VoicesResolver } from './voices.resolver';
import { VeniceModule } from '../venice/venice.module';
import { ElevenLabsModule } from '../elevenlabs/elevenlabs.module';

@Module({
  imports: [VeniceModule, ElevenLabsModule],
  providers: [VoicesService, VoicesResolver],
  exports: [VoicesService],
})
export class VoicesModule {}
