import {
  Body,
  Controller,
  ForbiddenException,
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
import { InitiateOnlinePaymentDto } from './dto/initiate-online-payment.dto';
import { CreateCashierCloseDto } from './dto/create-cashier-close.dto';
import { CreatePaymentRefundDto } from './dto/create-payment-refund.dto';
import { ListCashierClosesDto } from './dto/list-cashier-closes.dto';
import { ReversePaymentDto } from './dto/reverse-payment.dto';
import { CreateFinanceRequestDto } from './dto/create-finance-request.dto';
import { ReviewFinanceRequestDto } from './dto/review-finance-request.dto';
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

  @Post('online/initiate')
  @Permissions('payments:collect')
  initiateOnlinePayment(
    @Body() dto: InitiateOnlinePaymentDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.initiateOnlinePayment(dto, auth);
  }

  @Get('gateway-readiness')
  @Permissions('payments:collect')
  getPaymentGatewayReadiness(@CurrentAuth() auth: AuthContext) {
    return this.financeService.getPaymentGatewayReadiness(auth);
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

  @Post(':id/refund/request')
  @Permissions('payments:collect')
  requestRefund(
    @Param('id') paymentId: string,
    @Body() dto: CreateFinanceRequestDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.requestRefund(paymentId, dto, auth);
  }

  @Post(':id/reverse/request')
  @Permissions('payments:collect')
  requestReversal(
    @Param('id') paymentId: string,
    @Body() dto: CreateFinanceRequestDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.requestReversal(paymentId, dto, auth);
  }

  @Get('requests')
  listApprovalRequests(@CurrentAuth() auth: AuthContext) {
    const hasRefund = auth.permissions.includes('payments:refund');
    const hasReverse = auth.permissions.includes('payments:reverse');
    const isSuperAdmin = auth.roles.includes('platform_super_admin');
    if (!hasRefund && !hasReverse && !isSuperAdmin) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return this.financeService.listApprovalRequests(auth);
  }

  @Post('requests/:id/review')
  reviewApprovalRequest(
    @Param('id') requestId: string,
    @Body() dto: ReviewFinanceRequestDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    const hasRefund = auth.permissions.includes('payments:refund');
    const hasReverse = auth.permissions.includes('payments:reverse');
    const isSuperAdmin = auth.roles.includes('platform_super_admin');
    if (!hasRefund && !hasReverse && !isSuperAdmin) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return this.financeService.reviewApprovalRequest(requestId, dto, auth);
  }
}
