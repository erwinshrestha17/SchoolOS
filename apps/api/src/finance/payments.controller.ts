import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import type { AuthContext } from '../auth/auth.types';
import { CollectPaymentDto } from './dto/collect-payment.dto';
import { FinanceService } from './finance.service';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class PaymentsController {
  constructor(private readonly financeService: FinanceService) {}

  @Get()
  @Permissions('payments:collect')
  listPayments(@CurrentAuth() auth: AuthContext) {
    return this.financeService.listPayments(auth);
  }

  @Post()
  @Permissions('payments:collect')
  collectPayment(
    @Body() dto: CollectPaymentDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.collectPayment(dto, auth);
  }
}
