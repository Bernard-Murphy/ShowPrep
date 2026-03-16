import { Module } from '@nestjs/common';
import { VotingService } from './voting.service';
import { VotingResolver } from './voting.resolver';

@Module({
  providers: [VotingService, VotingResolver],
  exports: [VotingService],
})
export class VotingModule {}
