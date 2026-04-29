import {
  Controller,
  Get,
  Param,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
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
  @Permissions('receipts:read')
  async getReceiptPdf(
    @Param('receiptNumber') receiptNumber: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    const pdf = await this.financeService.getReceiptPdf(receiptNumber, auth);

    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `inline; filename="${safePdfFileName(`${receiptNumber}.pdf`)}"`,
    });
  }
}

function safePdfFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '-');
}
