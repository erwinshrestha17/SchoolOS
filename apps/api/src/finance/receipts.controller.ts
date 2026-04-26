import { Controller, Get, Header, Param, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import type { AuthContext } from '../auth/auth.types';
import { FinanceService } from './finance.service';

@Controller('receipts')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class ReceiptsController {
  constructor(private readonly financeService: FinanceService) {}

  @Get()
  @Permissions('receipts:read')
  listReceipts(@CurrentAuth() auth: AuthContext) {
    return this.financeService.listReceipts(auth);
  }

  @Get(':receiptNumber.pdf')
  @Header('Content-Type', 'application/pdf')
  @Permissions('receipts:read')
  getReceiptPdf(
    @Param('receiptNumber') receiptNumber: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.getReceiptPdf(receiptNumber, auth);
  }
}
