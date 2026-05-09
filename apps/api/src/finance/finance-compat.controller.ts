import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { CashierCloseWindowDto } from './dto/cashier-close-window.dto';
import { CollectPaymentDto } from './dto/collect-payment.dto';
import { CreateCashierCloseDto } from './dto/create-cashier-close.dto';
import { CreatePaymentRefundDto } from './dto/create-payment-refund.dto';
import { DuesQueryDto } from './dto/dues-query.dto';
import { ListCashierClosesDto } from './dto/list-cashier-closes.dto';
import { ReprintReceiptDto } from './dto/reprint-receipt.dto';
import { SendDefaulterRemindersDto } from './dto/send-defaulter-reminders.dto';
import { FinanceCompatService } from './finance-compat.service';
import { FinanceService } from './finance.service';

@Controller('finance')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class FinanceCompatController {
  constructor(
    private readonly financeService: FinanceService,
    private readonly financeCompatService: FinanceCompatService,
  ) {}

  @Get('dues')
  @Permissions('fees:manage')
  listDues(@Query() query: DuesQueryDto, @CurrentAuth() auth: AuthContext) {
    return this.financeService.getDuesTableReport(query, auth);
  }

  @Get('defaulters')
  @Permissions('fees:manage')
  listDefaulters(
    @CurrentAuth() auth: AuthContext,
    @Query('classId') classId?: string,
    @Query('feeHeadId') feeHeadId?: string,
  ) {
    return this.financeService.listDefaulters(auth, { classId, feeHeadId });
  }

  @Post('defaulters/reminders')
  @Permissions('fees:manage')
  sendDefaulterReminders(
    @Body() dto: SendDefaulterRemindersDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.sendDefaulterReminders(dto, auth);
  }

  @Get('reports/collections')
  @Permissions('fees:manage')
  getCollectionReport(@CurrentAuth() auth: AuthContext) {
    return this.financeService.getCollectionReport(auth);
  }

  @Get('reports/dues')
  @Permissions('fees:manage')
  getDuesReport(
    @Query() query: DuesQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.getDuesTableReport(query, auth);
  }

  @Get('reports/cashier-close/preview')
  @Permissions('payments:close')
  previewCashierClose(
    @Query() query: CashierCloseWindowDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.previewCashierClose(query, auth);
  }

  @Get('cashier-close')
  @Permissions('payments:close')
  listCashierCloses(
    @Query() query: ListCashierClosesDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.listCashierCloses(query, auth);
  }

  @Post('cashier-close')
  @Permissions('payments:close')
  finalizeCashierClose(
    @Body() dto: CreateCashierCloseDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.finalizeCashierClose(dto, auth);
  }

  @Post('payments')
  @Permissions('payments:collect')
  collectPayment(
    @Body() dto: CollectPaymentDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.collectPayment(dto, auth);
  }

  @Post('payments/:id/reverse')
  @Permissions('payments:refund')
  reversePayment(
    @Param('id') paymentId: string,
    @Body() dto: CreatePaymentRefundDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.refundPayment(paymentId, dto, auth);
  }

  @Post('payments/:id/correct')
  @Permissions('payments:refund')
  correctPayment(
    @Param('id') paymentId: string,
    @Body() dto: CreatePaymentRefundDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.refundPayment(paymentId, dto, auth);
  }

  @Get('receipts/:id/reprint-history')
  @Permissions('receipts:manage')
  getReceiptReprintHistory(
    @Param('id') receiptId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeCompatService.getReceiptReprintHistory(receiptId, auth);
  }

  @Post('receipts/:id/reprint')
  @Permissions('receipts:manage')
  async reprintReceipt(
    @Param('id') receiptId: string,
    @Body() dto: ReprintReceiptDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    const { pdf, fileName } = await this.financeService.reprintReceipt(
      receiptId,
      dto,
      auth,
    );

    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `attachment; filename="${safePdfFileName(fileName)}"`,
    });
  }

  @Get('students/:studentId/ledger/export.csv')
  @Permissions('fees:manage')
  @Header('Content-Type', 'text/csv')
  @Header(
    'Content-Disposition',
    'attachment; filename="student-fee-ledger.csv"',
  )
  exportStudentFeeLedger(
    @Param('studentId') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeCompatService.exportStudentFeeLedgerCsv(studentId, auth);
  }
}

function safePdfFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '-');
}
