import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import type { AuthContext } from '../auth/auth.types';
import { CashierCloseWindowDto } from './dto/cashier-close-window.dto';
import { CollectPaymentDto } from './dto/collect-payment.dto';
import { CreateCashierCloseDto } from './dto/create-cashier-close.dto';
import { CreatePaymentRefundDto } from './dto/create-payment-refund.dto';
import { ListCashierClosesDto } from './dto/list-cashier-closes.dto';
import { ReversePaymentDto } from './dto/reverse-payment.dto';
import { FinanceService } from './finance.service';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.fees')
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

  @Get('cashier-close/preview')
  @Permissions('payments:close')
  previewCashierClose(
    @Query() query: CashierCloseWindowDto,
    @CurrentAuth() auth: AuthContext,
  ): Promise<unknown> {
    return this.financeService.previewCashierClose(query, auth);
  }

  @Get('cashier-close')
  @Permissions('payments:close')
  listCashierCloses(
    @Query() query: ListCashierClosesDto,
    @CurrentAuth() auth: AuthContext,
  ): Promise<unknown> {
    return this.financeService.listCashierCloses(query, auth);
  }

  @Post('cashier-close')
  @Permissions('payments:close')
  finalizeCashierClose(
    @Body() dto: CreateCashierCloseDto,
    @CurrentAuth() auth: AuthContext,
  ): Promise<unknown> {
    return this.financeService.finalizeCashierClose(dto, auth);
  }

  @Post(':id/refund')
  @Permissions('payments:refund')
  refundPayment(
    @Param('id') paymentId: string,
    @Body() dto: CreatePaymentRefundDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.refundPayment(paymentId, dto, auth);
  }

  @Post(':id/reverse')
  @Permissions('payments:reverse')
  reversePayment(
    @Param('id') paymentId: string,
    @Body() dto: ReversePaymentDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.reversePayment(paymentId, dto, auth);
  }

  @Post('cashier-close/:id/reopen')
  @Permissions('payments:close')
  reopenCashierClose(
    @Param('id') closeId: string,
    @Body() dto: { reason: string },
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.reopenCashierClose(closeId, dto, auth);
  }
}
