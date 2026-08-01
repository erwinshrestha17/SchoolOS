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
import { OpenCashierCloseDto } from './dto/open-cashier-close.dto';
import { CountCashierCloseDto } from './dto/count-cashier-close.dto';
import {
  CashierCloseTransitionDto,
  DepositCashierCloseDto,
} from './dto/cashier-close-transition.dto';
import { CreatePaymentRefundDto } from './dto/create-payment-refund.dto';
import { ListCashierClosesDto } from './dto/list-cashier-closes.dto';
import { ReversePaymentDto } from './dto/reverse-payment.dto';
import { ReallocatePaymentDto } from './dto/reallocate-payment.dto';
import { CreateFinanceRequestDto } from './dto/create-finance-request.dto';
import { ReviewFinanceRequestDto } from './dto/review-finance-request.dto';
import { FinanceService } from './finance.service';
import {
  ListFinanceApprovalRequestsQueryDto,
  ListPaymentAllocationsQueryDto,
  ListPaymentsQueryDto,
} from './dto/list-finance-records.query.dto';
import {
  CashDepositTransitionDto,
  ListCashDepositsDto,
  PrepareCashDepositDto,
} from './dto/cash-deposit.dto';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.fees')
export class PaymentsController {
  constructor(private readonly financeService: FinanceService) {}

  @Get()
  @Permissions('payments:collect')
  listPayments(
    @Query() query: ListPaymentsQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.listPayments(query, auth);
  }

  @Get(':id/allocations')
  listPaymentAllocations(
    @Param('id') paymentId: string,
    @Query() query: ListPaymentAllocationsQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.listPaymentAllocations(paymentId, query, auth);
  }

  @Post(':id/allocations/reallocate')
  @Permissions('payments:collect')
  reallocatePayment(
    @Param('id') paymentId: string,
    @Body() dto: ReallocatePaymentDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.reallocatePayment(paymentId, dto, auth);
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

  @Get('cash-deposits')
  @Permissions('payments:close', 'accounting:reconciliation:manage')
  listCashDeposits(
    @Query() query: ListCashDepositsDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.listCashDeposits(query, auth);
  }

  @Post('cash-deposits')
  @Permissions('payments:close', 'accounting:reconciliation:manage')
  prepareCashDeposit(
    @Body() dto: PrepareCashDepositDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.prepareCashDeposit(dto, auth);
  }

  @Post('cash-deposits/:id/submit')
  @Permissions('payments:close', 'accounting:reconciliation:manage')
  submitCashDeposit(
    @Param('id') depositId: string,
    @Body() dto: CashDepositTransitionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.submitCashDeposit(depositId, dto, auth);
  }

  @Post('cash-deposits/:id/complete')
  @Permissions(
    'payments:close',
    'accounting:reconciliation:manage',
    'accounting:journals:post',
  )
  completeCashDeposit(
    @Param('id') depositId: string,
    @Body() dto: CashDepositTransitionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.completeCashDeposit(depositId, dto, auth);
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

  @Post('cashier-close/open')
  @Permissions('payments:close')
  openCashierClose(
    @Body() dto: OpenCashierCloseDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.openCashierClose(dto, auth);
  }

  @Post('cashier-close/:id/count')
  @Permissions('payments:close')
  countCashierClose(
    @Param('id') closeId: string,
    @Body() dto: CountCashierCloseDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.countCashierClose(closeId, dto, auth);
  }

  @Post('cashier-close/:id/submit')
  @Permissions('payments:close')
  submitCashierClose(
    @Param('id') closeId: string,
    @Body() dto: CashierCloseTransitionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.submitCashierClose(closeId, dto, auth);
  }

  @Post('cashier-close/:id/approve')
  @Permissions('payments:close')
  approveCashierClose(
    @Param('id') closeId: string,
    @Body() dto: CashierCloseTransitionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.approveCashierClose(closeId, dto, auth);
  }

  @Post('cashier-close/:id/close')
  @Permissions('payments:close')
  closeCashierClose(
    @Param('id') closeId: string,
    @Body() dto: CashierCloseTransitionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.closeCashierClose(closeId, dto, auth);
  }

  @Post('cashier-close/:id/deposit')
  @Permissions('payments:close')
  depositCashierClose(
    @Param('id') closeId: string,
    @Body() dto: DepositCashierCloseDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.depositCashierClose(closeId, dto, auth);
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
  listApprovalRequests(
    @Query() query: ListFinanceApprovalRequestsQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    const hasRefund = auth.permissions.includes('payments:refund');
    const hasReverse = auth.permissions.includes('payments:reverse');
    const isSuperAdmin = auth.roles.includes('platform_super_admin');
    if (!hasRefund && !hasReverse && !isSuperAdmin) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return this.financeService.listApprovalRequests(query, auth);
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
