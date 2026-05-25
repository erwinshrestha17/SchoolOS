import { Module, Global } from '@nestjs/common';
import { PlansService } from './plans.service';
import { EntitlementsService } from './entitlements.service';
import { MeController } from './me.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [MeController],
  providers: [PlansService, EntitlementsService],
  exports: [PlansService, EntitlementsService],
})
export class PlansModule {}
