import { ResourceOwnershipService } from './resource-ownership';
import { Global, Module } from '@nestjs/common';
import { AuthorizationService } from './authorization.service';

@Global()
@Module({
  providers: [AuthorizationService, ResourceOwnershipService],
  exports: [AuthorizationService, ResourceOwnershipService],
})
export class AuthorizationModule {}
