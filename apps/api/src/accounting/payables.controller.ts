import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import {
  ApproveVendorBillDto,
  CreateVendorBillDto,
  CreateVendorDto,
  ListPayablesQueryDto,
  ListVendorBillsQueryDto,
  ListVendorsQueryDto,
  PayablesAgingQueryDto,
  ReasonDto,
  ReverseWithDateDto,
  SettlePayableDto,
  UpdateVendorBillDto,
  UpdateVendorDto,
} from './dto/payables.dto';
import { PayablesService } from './payables.service';

/**
 * Phase 7.11c — accounts payable. Vendor bills live at
 * `/accounting/vendor-bills`; the older `POST /accounting/expenses` route is a
 * direct expense journal kept for backward compatibility and is not part of
 * the payables domain.
 */
@ApiTags('Accounting Payables')
@ApiBearerAuth()
@ApiCookieAuth()
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.accounting')
@Controller('accounting')
export class PayablesController {
  constructor(private readonly payables: PayablesService) {}

  @Get('payables-setup')
  @ApiOperation({ summary: 'Payables account mappings and choices' })
  @Permissions('accounting:payables:read')
  getSetup(@CurrentAuth() auth: AuthContext) {
    return this.payables.getSetup(auth);
  }

  // Vendors
  @Get('vendors')
  @ApiOperation({ summary: 'List vendors' })
  @Permissions('accounting:vendors:read')
  listVendors(
    @CurrentAuth() auth: AuthContext,
    @Query() query: ListVendorsQueryDto,
  ) {
    return this.payables.listVendors(auth, query);
  }

  @Post('vendors')
  @ApiOperation({ summary: 'Create a vendor' })
  @Permissions('accounting:vendors:write')
  createVendor(@CurrentAuth() auth: AuthContext, @Body() dto: CreateVendorDto) {
    return this.payables.createVendor(auth, dto);
  }

  @Patch('vendors/:id')
  @ApiOperation({ summary: 'Update a vendor' })
  @Permissions('accounting:vendors:write')
  updateVendor(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Body() dto: UpdateVendorDto,
  ) {
    return this.payables.updateVendor(auth, id, dto);
  }

  @Post('vendors/:id/deactivate')
  @ApiOperation({ summary: 'Deactivate a vendor (vendors are never deleted)' })
  @Permissions('accounting:vendors:write')
  deactivateVendor(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Body() dto: ReasonDto,
  ) {
    return this.payables.deactivateVendor(auth, id, dto);
  }

  // Vendor bills
  @Get('vendor-bills')
  @ApiOperation({ summary: 'List vendor bills' })
  @Permissions('accounting:expenses:read')
  listBills(
    @CurrentAuth() auth: AuthContext,
    @Query() query: ListVendorBillsQueryDto,
  ) {
    return this.payables.listBills(auth, query);
  }

  @Post('vendor-bills')
  @ApiOperation({ summary: 'Record a draft vendor bill (idempotent)' })
  @Permissions('accounting:expenses:write')
  createBill(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: CreateVendorBillDto,
  ) {
    return this.payables.createBill(auth, dto);
  }

  @Get('vendor-bills/:id')
  @ApiOperation({ summary: 'Vendor bill detail with approval evidence' })
  @Permissions('accounting:expenses:read')
  getBill(@CurrentAuth() auth: AuthContext, @Param('id') id: string) {
    return this.payables.getBill(auth, id);
  }

  @Patch('vendor-bills/:id')
  @ApiOperation({ summary: 'Edit a draft vendor bill' })
  @Permissions('accounting:expenses:write')
  updateBill(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Body() dto: UpdateVendorBillDto,
  ) {
    return this.payables.updateBill(auth, id, dto);
  }

  @Post('vendor-bills/:id/submit')
  @ApiOperation({ summary: 'Submit a draft vendor bill for approval' })
  @Permissions('accounting:expenses:write')
  submitBill(@CurrentAuth() auth: AuthContext, @Param('id') id: string) {
    return this.payables.submitBill(auth, id);
  }

  @Post('vendor-bills/:id/approve')
  @ApiOperation({
    summary:
      'Approve a submitted bill and post it to Accounts Payable (independent approver)',
  })
  @Permissions('accounting:expenses:approve')
  approveBill(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Body() dto: ApproveVendorBillDto,
  ) {
    return this.payables.approveBill(auth, id, dto);
  }

  @Post('vendor-bills/:id/reject')
  @ApiOperation({ summary: 'Return a submitted bill to draft with a reason' })
  @Permissions('accounting:expenses:approve')
  rejectBill(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Body() dto: ReasonDto,
  ) {
    return this.payables.rejectBill(auth, id, dto);
  }

  @Post('vendor-bills/:id/reverse')
  @ApiOperation({ summary: 'Reverse a posted, unpaid vendor bill' })
  @Permissions('accounting:journals:reverse')
  reverseBill(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Body() dto: ReverseWithDateDto,
  ) {
    return this.payables.reverseBill(auth, id, dto);
  }

  // Payables
  @Get('payables')
  @ApiOperation({ summary: 'List payables' })
  @Permissions('accounting:payables:read')
  listPayables(
    @CurrentAuth() auth: AuthContext,
    @Query() query: ListPayablesQueryDto,
  ) {
    return this.payables.listPayables(auth, query);
  }

  @Get('payables/:id')
  @ApiOperation({ summary: 'Payable detail with payments' })
  @Permissions('accounting:payables:read')
  getPayable(@CurrentAuth() auth: AuthContext, @Param('id') id: string) {
    return this.payables.getPayable(auth, id);
  }

  @Post('payables/:id/settlements')
  @ApiOperation({
    summary: 'Pay a payable (independent payer, idempotent)',
  })
  @Permissions('accounting:payables:settle')
  settle(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Body() dto: SettlePayableDto,
  ) {
    return this.payables.settle(auth, id, dto);
  }

  @Post('payable-settlements/:id/reverse')
  @ApiOperation({ summary: 'Reverse a vendor payment' })
  @Permissions('accounting:journals:reverse')
  reverseSettlement(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Body() dto: ReverseWithDateDto,
  ) {
    return this.payables.reverseSettlement(auth, id, dto);
  }

  @Get('reports/payables-aging')
  @ApiOperation({
    summary: 'Payables aging as of a Nepal school day (Phase 7.11c)',
  })
  @Permissions('accounting:payables:read')
  getPayablesAging(
    @CurrentAuth() auth: AuthContext,
    @Query() query: PayablesAgingQueryDto,
  ) {
    return this.payables.getPayablesAging(auth, query);
  }
}
