import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { CanteenHardeningService } from './canteen-hardening.service';
import {
  CanteenLowBalanceAlertDto,
  CanteenReasonDto,
} from './dto/canteen-hardening.dto';
import {
  CompleteCanteenPosSaleDto,
  CreateCanteenMealPlanDto,
  CreateCanteenMenuItemDto,
  CreateCanteenPosSaleDto,
  EnrollCanteenStudentDto,
  ServeCanteenMealDto,
  TopUpCanteenWalletDto,
  UpdateCanteenEnrollmentDto,
  UpdateCanteenMealPlanDto,
  UpdateCanteenMenuItemDto,
  UpdateCanteenStatusDto,
  UpsertCanteenSpendingControlDto,
} from './dto/canteen.dto';
import { CanteenService } from './canteen.service';

@Controller('canteen')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class CanteenController {
  constructor(
    private readonly canteenService: CanteenService,
    private readonly canteenHardeningService: CanteenHardeningService,
  ) {}

  @Post('menu-items')
  @Permissions('canteen:menu:create')
  createMenuItem(
    @Body() dto: CreateCanteenMenuItemDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.canteenService.createMenuItem(dto, auth);
  }

  @Get('menu-items')
  @Permissions('canteen:menu:read')
  listMenuItems(
    @CurrentAuth() auth: AuthContext,
    @Query('q') query?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.canteenService.listMenuItems(auth, {
      query,
      category,
      status,
      page,
      limit,
    });
  }

  @Patch('menu-items/:id')
  @Permissions('canteen:menu:update')
  updateMenuItem(
    @Param('id') id: string,
    @Body() dto: UpdateCanteenMenuItemDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.canteenService.updateMenuItem(id, dto, auth);
  }

  @Patch('menu-items/:id/status')
  @Permissions('canteen:menu:update')
  updateMenuItemStatus(
    @Param('id') id: string,
    @Body() dto: UpdateCanteenStatusDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.canteenService.updateMenuItemStatus(id, dto, auth);
  }

  @Post('meal-plans')
  @Permissions('canteen:plans:create')
  createMealPlan(
    @Body() dto: CreateCanteenMealPlanDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.canteenService.createMealPlan(dto, auth);
  }

  @Get('meal-plans')
  @Permissions('canteen:plans:read')
  listMealPlans(
    @CurrentAuth() auth: AuthContext,
    @Query('status') status?: string,
    @Query('mealType') mealType?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.canteenService.listMealPlans(auth, {
      status,
      mealType,
      page,
      limit,
    });
  }

  @Patch('meal-plans/:id')
  @Permissions('canteen:plans:update')
  updateMealPlan(
    @Param('id') id: string,
    @Body() dto: UpdateCanteenMealPlanDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.canteenService.updateMealPlan(id, dto, auth);
  }

  @Patch('meal-plans/:id/status')
  @Permissions('canteen:plans:update')
  updateMealPlanStatus(
    @Param('id') id: string,
    @Body() dto: UpdateCanteenStatusDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.canteenService.updateMealPlanStatus(id, dto, auth);
  }

  @Post('enrollments')
  @Permissions('canteen:enrollments:create')
  enrollStudent(
    @Body() dto: EnrollCanteenStudentDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.canteenService.enrollStudent(dto, auth);
  }

  @Get('enrollments')
  @Permissions('canteen:enrollments:read')
  listEnrollments(
    @CurrentAuth() auth: AuthContext,
    @Query('studentId') studentId?: string,
    @Query('mealPlanId') mealPlanId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.canteenService.listEnrollments(auth, {
      studentId,
      mealPlanId,
      status,
      page,
      limit,
    });
  }

  @Patch('enrollments/:id')
  @Permissions('canteen:enrollments:update')
  updateEnrollment(
    @Param('id') id: string,
    @Body() dto: UpdateCanteenEnrollmentDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.canteenService.updateEnrollment(id, dto, auth);
  }

  @Patch('enrollments/:id/cancel')
  @Permissions('canteen:enrollments:update')
  cancelEnrollment(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.canteenService.cancelEnrollment(id, auth);
  }

  @Patch('enrollments/:id/pause')
  @Permissions('canteen:enrollments:update')
  pauseEnrollment(
    @Param('id') id: string,
    @Body() dto: CanteenReasonDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.canteenHardeningService.pauseEnrollment(id, dto, auth);
  }

  @Patch('enrollments/:id/resume')
  @Permissions('canteen:enrollments:update')
  resumeEnrollment(
    @Param('id') id: string,
    @Body() dto: CanteenReasonDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.canteenHardeningService.resumeEnrollment(id, dto, auth);
  }

  @Patch('enrollments/:id/end')
  @Permissions('canteen:enrollments:update')
  endEnrollment(
    @Param('id') id: string,
    @Body() dto: CanteenReasonDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.canteenHardeningService.endEnrollment(id, dto, auth);
  }

  @Post('servings')
  @Permissions('canteen:serving:create')
  serveMeal(
    @Body() dto: ServeCanteenMealDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.canteenService.serveMeal(dto, auth);
  }

  @Get('servings')
  @Permissions('canteen:serving:read')
  listDailyServings(
    @CurrentAuth() auth: AuthContext,
    @Query('date') date?: string,
    @Query('mealType') mealType?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.canteenService.listDailyServings(auth, {
      date,
      mealType,
      page,
      limit,
    });
  }

  @Patch('servings/:id/cancel')
  @Permissions('canteen:serving:update')
  cancelServing(
    @Param('id') id: string,
    @Body() dto: CanteenReasonDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.canteenHardeningService.cancelServing(id, dto, auth);
  }

  @Patch('servings/:id/not-taken')
  @Permissions('canteen:serving:update')
  markServingNotTaken(
    @Param('id') id: string,
    @Body() dto: CanteenReasonDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.canteenHardeningService.markServingNotTaken(id, dto, auth);
  }

  @Post('wallets/student/:studentId')
  @Permissions('canteen:wallets:create')
  getOrCreateWallet(
    @Param('studentId') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.canteenService.getOrCreateWallet(studentId, auth);
  }

  @Get('wallets/student/:studentId/balance')
  @Permissions('canteen:wallets:read')
  walletBalance(
    @Param('studentId') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.canteenService.walletBalance(studentId, auth);
  }

  @Post('wallets/student/:studentId/top-up')
  @Permissions('canteen:wallets:update')
  topUpWallet(
    @Param('studentId') studentId: string,
    @Body() dto: TopUpCanteenWalletDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.canteenService.topUpWallet(studentId, dto, auth);
  }

  @Get('wallets/student/:studentId/transactions')
  @Permissions('canteen:wallets:read')
  transactionHistory(
    @Param('studentId') studentId: string,
    @CurrentAuth() auth: AuthContext,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.canteenService.transactionHistory(studentId, auth, {
      page,
      limit,
    });
  }

  @Post('wallets/low-balance-alerts')
  @Permissions('canteen:wallets:update')
  sendLowBalanceAlerts(
    @Body() dto: CanteenLowBalanceAlertDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.canteenHardeningService.sendLowBalanceAlerts(dto, auth);
  }

  @Post('pos-sales')
  @Permissions('canteen:pos:create')
  createPosSale(
    @Body() dto: CreateCanteenPosSaleDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.canteenService.createPosSale(dto, auth);
  }

  @Patch('pos-sales/:id/complete')
  @Permissions('canteen:pos:update')
  completePosSale(
    @Param('id') id: string,
    @Body() dto: CompleteCanteenPosSaleDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.canteenService.completePosSale(id, dto, auth);
  }

  @Patch('pos-sales/:id/cancel')
  @Permissions('canteen:pos:update')
  cancelPosSale(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.canteenService.cancelPosSale(id, auth);
  }

  @Get('pos-sales')
  @Permissions('canteen:pos:read')
  listPosSales(
    @CurrentAuth() auth: AuthContext,
    @Query('status') status?: string,
    @Query('studentId') studentId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.canteenService.listPosSales(auth, {
      status,
      studentId,
      from,
      to,
      page,
      limit,
    });
  }

  @Post('spending-controls')
  @Permissions('canteen:controls:create')
  upsertSpendingControl(
    @Body() dto: UpsertCanteenSpendingControlDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.canteenService.upsertSpendingControl(dto, auth);
  }

  @Get('spending-controls/student/:studentId')
  @Permissions('canteen:controls:read')
  getSpendingControl(
    @Param('studentId') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.canteenService.getSpendingControl(studentId, auth);
  }

  @Get('reports/daily-meal-count')
  @Permissions('canteen:reports:read')
  dailyMealCountReport(
    @CurrentAuth() auth: AuthContext,
    @Query('date') date?: string,
  ) {
    return this.canteenService.dailyMealCountReport(auth, date);
  }

  @Get('reports/daily-meal-count.csv')
  @Header('Content-Type', 'text/csv')
  @Header(
    'Content-Disposition',
    'attachment; filename="canteen-daily-meal-count.csv"',
  )
  @Permissions('canteen:reports:read')
  exportDailyMealCountCsv(
    @CurrentAuth() auth: AuthContext,
    @Query('date') date?: string,
  ) {
    return this.canteenHardeningService.exportDailyMealCountCsv(auth, date);
  }

  @Get('reports/item-wise-sales')
  @Permissions('canteen:reports:read')
  itemWiseSalesReport(
    @CurrentAuth() auth: AuthContext,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.canteenService.itemWiseSalesReport(auth, { from, to });
  }

  @Get('reports/item-wise-sales.csv')
  @Header('Content-Type', 'text/csv')
  @Header(
    'Content-Disposition',
    'attachment; filename="canteen-item-wise-sales.csv"',
  )
  @Permissions('canteen:reports:read')
  exportItemWiseSalesCsv(
    @CurrentAuth() auth: AuthContext,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.canteenHardeningService.exportItemWiseSalesCsv(auth, {
      from,
      to,
    });
  }

  @Get('reports/low-balance-wallets')
  @Permissions('canteen:reports:read')
  lowBalanceWalletList(@CurrentAuth() auth: AuthContext) {
    return this.canteenService.lowBalanceWalletList(auth);
  }

  @Get('reports/student-spending-summary')
  @Permissions('canteen:reports:read')
  studentSpendingSummary(
    @CurrentAuth() auth: AuthContext,
    @Query('studentId') studentId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.canteenService.studentSpendingSummary(auth, {
      studentId,
      from,
      to,
    });
  }
}
