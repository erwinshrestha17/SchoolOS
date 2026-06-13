import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { CanteenOperationsService } from './canteen-operations.service';
import {
  CanteenDateRangeDto,
  CanteenSupplierPurchaseReportDto,
  CloseCanteenStockDateDto,
} from './dto/canteen-operations.dto';

@Controller('canteen')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.canteen')
export class CanteenOperationsController {
  constructor(
    private readonly canteenOperationsService: CanteenOperationsService,
  ) {}

  @Post('stock-close')
  @Permissions('canteen:inventory:update')
  closeStockDate(
    @Body() dto: CloseCanteenStockDateDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.canteenOperationsService.closeStockDate(dto, auth);
  }

  @Get('stock-close')
  @Permissions('canteen:inventory:read')
  listStockCloses(
    @CurrentAuth() auth: AuthContext,
    @Query() query: CanteenDateRangeDto,
  ) {
    return this.canteenOperationsService.listStockCloses(auth, query);
  }

  @Get('reports/wastage-summary')
  @Permissions('canteen:reports:read')
  wastageSummary(
    @CurrentAuth() auth: AuthContext,
    @Query() query: CanteenDateRangeDto,
  ) {
    return this.canteenOperationsService.wastageSummary(auth, query);
  }

  @Get('reports/low-stock-alerts')
  @Permissions('canteen:reports:read')
  lowStockAlerts(@CurrentAuth() auth: AuthContext) {
    return this.canteenOperationsService.lowStockAlerts(auth);
  }

  @Get('reports/supplier-purchases')
  @Permissions('canteen:reports:read')
  supplierPurchaseSummary(
    @CurrentAuth() auth: AuthContext,
    @Query() query: CanteenSupplierPurchaseReportDto,
  ) {
    return this.canteenOperationsService.supplierPurchaseSummary(auth, query);
  }

  @Get('purchase-bills/:id/detail')
  @Permissions('canteen:inventory:read')
  purchaseBillDetail(
    @Param('id') id: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.canteenOperationsService.purchaseBillDetail(id, auth);
  }

  @Get('purchase-bills/:id/edit-lock')
  @Permissions('canteen:inventory:read')
  purchaseBillEditLock(
    @Param('id') id: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.canteenOperationsService.purchaseBillEditLock(id, auth);
  }
}
