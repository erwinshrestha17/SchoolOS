import {
  Controller,
  Get,
  Param,
  Post,
  StreamableFile,
  UseGuards,
  Body,
} from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import type { AuthContext } from '../auth/auth.types';
import { FinanceService } from './finance.service';
import { ReprintReceiptDto } from './dto/reprint-receipt.dto';

@Controller('receipts')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.fees')
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

  @Post(':id/reprint')
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
}

function safePdfFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '-');
}
