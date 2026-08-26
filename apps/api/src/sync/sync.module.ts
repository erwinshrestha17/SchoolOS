import { Module } from '@nestjs/common';
import { SyncAuthorityController } from './sync-authority.controller';

@Module({
  controllers: [SyncAuthorityController],
})
export class SyncModule {}
