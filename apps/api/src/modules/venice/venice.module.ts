import { Module } from '@nestjs/common';
import { VeniceService } from './venice.service';

@Module({
  providers: [VeniceService],
  exports: [VeniceService],
})
export class VeniceModule {}
