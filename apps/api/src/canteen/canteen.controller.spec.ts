import { StreamableFile } from '@nestjs/common';
import type { AuthContext } from '../auth/auth.types';
import { CanteenController } from './canteen.controller';

const actor: AuthContext = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  email: 'canteen@school.test',
  roles: ['admin'],
  permissions: [],
  authMethod: 'PASSWORD',
};

function createController() {
  const canteenService = {
    createMenuItem: jest.fn(),
    listMenuItems: jest.fn(),
    updateMenuItem: jest.fn(),
    updateMenuItemStatus: jest.fn(),
    createMealPlan: jest.fn(),
    listMealPlans: jest.fn(),
    updateMealPlan: jest.fn(),
    updateMealPlanStatus: jest.fn(),
    enrollStudent: jest.fn(),
    listEnrollments: jest.fn(),
    updateEnrollment: jest.fn(),
    cancelEnrollment: jest.fn(),
    serveMeal: jest.fn(),
    listDailyServings: jest.fn(),
    getOrCreateWallet: jest.fn(),
    walletBalance: jest.fn(),
    topUpWallet: jest.fn(),
    transactionHistory: jest.fn(),
    createPosSale: jest.fn(),
    completePosSale: jest.fn(),
    cancelPosSale: jest.fn(),
    getPosReceipt: jest.fn(),
    getPosReceiptPdf: jest.fn(),
    listPosSales: jest.fn(),
    upsertSpendingControl: jest.fn(),
    getSpendingControl: jest.fn(),
    dailyMealCountReport: jest.fn(),
    itemWiseSalesReport: jest.fn(),
    lowBalanceWalletList: jest.fn(),
    studentSpendingSummary: jest.fn(),
  };
  const canteenHardeningService = {
    pauseEnrollment: jest.fn(),
    resumeEnrollment: jest.fn(),
    endEnrollment: jest.fn(),
    cancelServing: jest.fn(),
    markServingNotTaken: jest.fn(),
    sendLowBalanceAlerts: jest.fn(),
    exportDailyMealCountCsv: jest.fn(),
    exportItemWiseSalesCsv: jest.fn(),
  };
  const studentQrService = {
    resolveQr: jest.fn(),
  };

  return {
    controller: new CanteenController(
      canteenService as never,
      canteenHardeningService as never,
      studentQrService as never,
    ),
    canteenService,
    canteenHardeningService,
    studentQrService,
  };
}

describe('CanteenController M8C contracts', () => {
  it('delegates menu item create/list/update/status with current actor', () => {
    const { controller, canteenService } = createController();
    const createDto = {
      name: 'Veg Momo',
      category: 'Snacks',
      unitPrice: 80,
      allergenTags: ['gluten'],
    };
    const updateDto = { unitPrice: 90 };
    const statusDto = { status: 'INACTIVE', reason: 'Out of stock' };
    canteenService.createMenuItem.mockReturnValue({ id: 'item-1' });
    canteenService.listMenuItems.mockReturnValue({ items: [] });
    canteenService.updateMenuItem.mockReturnValue({ id: 'item-1' });
    canteenService.updateMenuItemStatus.mockReturnValue({ status: 'INACTIVE' });

    expect(controller.createMenuItem(createDto as never, actor)).toEqual({
      id: 'item-1',
    });
    expect(
      controller.listMenuItems(actor, 'momo', 'Snacks', 'ACTIVE', '1', '20'),
    ).toEqual({ items: [] });
    expect(
      controller.updateMenuItem('item-1', updateDto as never, actor),
    ).toEqual({ id: 'item-1' });
    expect(controller.updateMenuItemStatus('item-1', statusDto, actor)).toEqual(
      { status: 'INACTIVE' },
    );
    expect(canteenService.createMenuItem).toHaveBeenCalledWith(
      createDto,
      actor,
    );
    expect(canteenService.listMenuItems).toHaveBeenCalledWith(actor, {
      query: 'momo',
      category: 'Snacks',
      status: 'ACTIVE',
      page: '1',
      limit: '20',
    });
    expect(canteenService.updateMenuItem).toHaveBeenCalledWith(
      'item-1',
      updateDto,
      actor,
    );
    expect(canteenService.updateMenuItemStatus).toHaveBeenCalledWith(
      'item-1',
      statusDto,
      actor,
    );
  });

  it('delegates meal plan create/list/update/status with current actor', () => {
    const { controller, canteenService } = createController();
    const createDto = {
      name: 'Lunch Plan',
      mealType: 'LUNCH',
      price: 2500,
      duplicateServingPrevention: true,
    };
    const updateDto = { price: 2700 };
    const statusDto = { status: 'ACTIVE', reason: 'Ready' };
    canteenService.createMealPlan.mockReturnValue({ id: 'plan-1' });
    canteenService.listMealPlans.mockReturnValue({ items: [] });
    canteenService.updateMealPlan.mockReturnValue({ id: 'plan-1' });
    canteenService.updateMealPlanStatus.mockReturnValue({ status: 'ACTIVE' });

    expect(controller.createMealPlan(createDto as never, actor)).toEqual({
      id: 'plan-1',
    });
    expect(
      controller.listMealPlans(actor, 'ACTIVE', 'LUNCH', '1', '20'),
    ).toEqual({ items: [] });
    expect(
      controller.updateMealPlan('plan-1', updateDto as never, actor),
    ).toEqual({ id: 'plan-1' });
    expect(controller.updateMealPlanStatus('plan-1', statusDto, actor)).toEqual(
      { status: 'ACTIVE' },
    );
    expect(canteenService.createMealPlan).toHaveBeenCalledWith(
      createDto,
      actor,
    );
    expect(canteenService.listMealPlans).toHaveBeenCalledWith(actor, {
      status: 'ACTIVE',
      mealType: 'LUNCH',
      page: '1',
      limit: '20',
    });
    expect(canteenService.updateMealPlan).toHaveBeenCalledWith(
      'plan-1',
      updateDto,
      actor,
    );
    expect(canteenService.updateMealPlanStatus).toHaveBeenCalledWith(
      'plan-1',
      statusDto,
      actor,
    );
  });

  it('delegates enrollment lifecycle including pause/resume/end hardening routes', () => {
    const { controller, canteenService, canteenHardeningService } =
      createController();
    const enrollDto = {
      studentId: 'student-1',
      mealPlanId: 'plan-1',
      startsOn: '2026-05-09',
    };
    const updateDto = { notes: 'Updated' };
    const reasonDto = { reason: 'Parent request' };
    canteenService.enrollStudent.mockReturnValue({ id: 'enrollment-1' });
    canteenService.listEnrollments.mockReturnValue({ items: [] });
    canteenService.updateEnrollment.mockReturnValue({ id: 'enrollment-1' });
    canteenService.cancelEnrollment.mockReturnValue({ status: 'CANCELLED' });
    canteenHardeningService.pauseEnrollment.mockReturnValue({
      status: 'PAUSED',
    });
    canteenHardeningService.resumeEnrollment.mockReturnValue({
      status: 'ACTIVE',
    });
    canteenHardeningService.endEnrollment.mockReturnValue({ status: 'ENDED' });

    expect(controller.enrollStudent(enrollDto as never, actor)).toEqual({
      id: 'enrollment-1',
    });
    expect(
      controller.listEnrollments(
        actor,
        'student-1',
        'plan-1',
        'ACTIVE',
        '1',
        '20',
      ),
    ).toEqual({ items: [] });
    expect(
      controller.updateEnrollment('enrollment-1', updateDto as never, actor),
    ).toEqual({ id: 'enrollment-1' });
    expect(controller.cancelEnrollment('enrollment-1', actor)).toEqual({
      status: 'CANCELLED',
    });
    expect(
      controller.pauseEnrollment('enrollment-1', reasonDto, actor),
    ).toEqual({ status: 'PAUSED' });
    expect(
      controller.resumeEnrollment('enrollment-1', reasonDto, actor),
    ).toEqual({ status: 'ACTIVE' });
    expect(controller.endEnrollment('enrollment-1', reasonDto, actor)).toEqual({
      status: 'ENDED',
    });
    expect(canteenService.enrollStudent).toHaveBeenCalledWith(enrollDto, actor);
    expect(canteenService.listEnrollments).toHaveBeenCalledWith(actor, {
      studentId: 'student-1',
      mealPlanId: 'plan-1',
      status: 'ACTIVE',
      page: '1',
      limit: '20',
    });
    expect(canteenHardeningService.pauseEnrollment).toHaveBeenCalledWith(
      'enrollment-1',
      reasonDto,
      actor,
    );
    expect(canteenHardeningService.resumeEnrollment).toHaveBeenCalledWith(
      'enrollment-1',
      reasonDto,
      actor,
    );
    expect(canteenHardeningService.endEnrollment).toHaveBeenCalledWith(
      'enrollment-1',
      reasonDto,
      actor,
    );
  });

  it('delegates serving and serving cancellation/not-taken routes', () => {
    const { controller, canteenService, canteenHardeningService } =
      createController();
    const serveDto = {
      studentId: 'student-1',
      mealPlanId: 'plan-1',
      mealType: 'LUNCH',
      mealDate: '2026-05-09',
    };
    const reasonDto = { reason: 'Duplicate scan correction' };
    canteenService.serveMeal.mockReturnValue({ id: 'serving-1' });
    canteenService.listDailyServings.mockReturnValue({ items: [] });
    canteenHardeningService.cancelServing.mockReturnValue({
      status: 'CANCELLED',
    });
    canteenHardeningService.markServingNotTaken.mockReturnValue({
      status: 'NOT_TAKEN',
    });

    expect(controller.serveMeal(serveDto as never, actor)).toEqual({
      id: 'serving-1',
    });
    expect(
      controller.listDailyServings(actor, '2026-05-09', 'LUNCH', '1', '20'),
    ).toEqual({ items: [] });
    expect(controller.cancelServing('serving-1', reasonDto, actor)).toEqual({
      status: 'CANCELLED',
    });
    expect(
      controller.markServingNotTaken('serving-1', reasonDto, actor),
    ).toEqual({ status: 'NOT_TAKEN' });
    expect(canteenService.serveMeal).toHaveBeenCalledWith(serveDto, actor);
    expect(canteenService.listDailyServings).toHaveBeenCalledWith(actor, {
      date: '2026-05-09',
      mealType: 'LUNCH',
      page: '1',
      limit: '20',
    });
  });

  it('delegates wallet top-up, transaction history, and low-balance alerts', () => {
    const { controller, canteenService, canteenHardeningService } =
      createController();
    const topUpDto = { amount: 1000, note: 'Cash top-up' };
    const alertDto = { windowKey: '2026-05-09' };
    canteenService.getOrCreateWallet.mockReturnValue({ id: 'wallet-1' });
    canteenService.walletBalance.mockReturnValue({ balance: '1000' });
    canteenService.topUpWallet.mockReturnValue({ wallet: { id: 'wallet-1' } });
    canteenService.transactionHistory.mockReturnValue({ items: [] });
    canteenHardeningService.sendLowBalanceAlerts.mockReturnValue({
      queued: 1,
      skipped: 0,
    });

    expect(controller.getOrCreateWallet('student-1', actor)).toEqual({
      id: 'wallet-1',
    });
    expect(controller.walletBalance('student-1', actor)).toEqual({
      balance: '1000',
    });
    expect(
      controller.topUpWallet('student-1', topUpDto as never, actor),
    ).toEqual({ wallet: { id: 'wallet-1' } });
    expect(
      controller.transactionHistory('student-1', actor, '1', '20'),
    ).toEqual({ items: [] });
    expect(controller.sendLowBalanceAlerts(alertDto, actor)).toEqual({
      queued: 1,
      skipped: 0,
    });
    expect(canteenService.topUpWallet).toHaveBeenCalledWith(
      'student-1',
      topUpDto,
      actor,
    );
    expect(canteenService.transactionHistory).toHaveBeenCalledWith(
      'student-1',
      actor,
      {
        page: '1',
        limit: '20',
      },
    );
    expect(canteenHardeningService.sendLowBalanceAlerts).toHaveBeenCalledWith(
      alertDto,
      actor,
    );
  });

  it('delegates POS sale lifecycle and spending controls', () => {
    const { controller, canteenService } = createController();
    const saleDto = {
      studentId: 'student-1',
      paymentMethod: 'WALLET',
      items: [{ menuItemId: 'item-1', quantity: 2 }],
    };
    const completeDto = { note: 'Paid by wallet' };
    const controlDto = {
      studentId: 'student-1',
      dailySpendingLimit: 200,
      blockedCategories: ['Soda'],
      blockedMenuItemIds: ['item-9'],
    };
    canteenService.createPosSale.mockReturnValue({ id: 'sale-1' });
    canteenService.completePosSale.mockReturnValue({ status: 'COMPLETED' });
    canteenService.cancelPosSale.mockReturnValue({ status: 'CANCELLED' });
    canteenService.getPosReceipt.mockReturnValue({
      receiptNumber: 'POS-2026-000001',
    });
    canteenService.listPosSales.mockReturnValue({ items: [] });
    canteenService.upsertSpendingControl.mockReturnValue({ id: 'control-1' });
    canteenService.getSpendingControl.mockReturnValue({ id: 'control-1' });

    expect(controller.createPosSale(saleDto as never, actor)).toEqual({
      id: 'sale-1',
    });
    expect(controller.completePosSale('sale-1', completeDto, actor)).toEqual({
      status: 'COMPLETED',
    });
    expect(controller.cancelPosSale('sale-1', actor)).toEqual({
      status: 'CANCELLED',
    });
    expect(controller.getPosReceipt('sale-1', actor)).toEqual({
      receiptNumber: 'POS-2026-000001',
    });
    expect(
      controller.listPosSales(
        actor,
        'COMPLETED',
        'student-1',
        '2026-05-01',
        '2026-05-09',
        '1',
        '20',
      ),
    ).toEqual({ items: [] });
    expect(
      controller.upsertSpendingControl(controlDto as never, actor),
    ).toEqual({ id: 'control-1' });
    expect(controller.getSpendingControl('student-1', actor)).toEqual({
      id: 'control-1',
    });
    expect(canteenService.createPosSale).toHaveBeenCalledWith(saleDto, actor);
    expect(canteenService.completePosSale).toHaveBeenCalledWith(
      'sale-1',
      completeDto,
      actor,
    );
    expect(canteenService.listPosSales).toHaveBeenCalledWith(actor, {
      status: 'COMPLETED',
      studentId: 'student-1',
      from: '2026-05-01',
      to: '2026-05-09',
      page: '1',
      limit: '20',
    });
    expect(canteenService.getPosReceipt).toHaveBeenCalledWith('sale-1', actor);
  });

  it('streams POS receipt PDFs from the service boundary', async () => {
    const { controller, canteenService } = createController();
    canteenService.getPosReceiptPdf.mockResolvedValue(
      Buffer.from('%PDF-1.4\n%%EOF'),
    );

    const result = await controller.getPosReceiptPdf('sale-1', actor);

    expect(result).toBeInstanceOf(StreamableFile);
    expect(canteenService.getPosReceiptPdf).toHaveBeenCalledWith(
      'sale-1',
      actor,
    );
  });

  it('delegates reports and CSV exports from backend service boundaries', () => {
    const { controller, canteenService, canteenHardeningService } =
      createController();
    canteenService.dailyMealCountReport.mockReturnValue([
      { mealType: 'LUNCH' },
    ]);
    canteenHardeningService.exportDailyMealCountCsv.mockReturnValue(
      'Meal Type,Status,Count\nLUNCH,SERVED,10',
    );
    canteenService.itemWiseSalesReport.mockReturnValue([
      { itemName: 'Veg Momo' },
    ]);
    canteenHardeningService.exportItemWiseSalesCsv.mockReturnValue(
      'Item Name,Sales Amount\nVeg Momo,800',
    );
    canteenService.lowBalanceWalletList.mockReturnValue([
      { studentId: 'student-1' },
    ]);
    canteenService.studentSpendingSummary.mockReturnValue([
      { studentId: 'student-1' },
    ]);

    expect(controller.dailyMealCountReport(actor, '2026-05-09')).toEqual([
      { mealType: 'LUNCH' },
    ]);
    expect(controller.exportDailyMealCountCsv(actor, '2026-05-09')).toBe(
      'Meal Type,Status,Count\nLUNCH,SERVED,10',
    );
    expect(
      controller.itemWiseSalesReport(actor, '2026-05-01', '2026-05-09'),
    ).toEqual([{ itemName: 'Veg Momo' }]);
    expect(
      controller.exportItemWiseSalesCsv(actor, '2026-05-01', '2026-05-09'),
    ).toBe('Item Name,Sales Amount\nVeg Momo,800');
    expect(controller.lowBalanceWalletList(actor)).toEqual([
      { studentId: 'student-1' },
    ]);
    expect(
      controller.studentSpendingSummary(
        actor,
        'student-1',
        '2026-05-01',
        '2026-05-09',
      ),
    ).toEqual([{ studentId: 'student-1' }]);
    expect(
      canteenHardeningService.exportDailyMealCountCsv,
    ).toHaveBeenCalledWith(actor, '2026-05-09');
    expect(canteenHardeningService.exportItemWiseSalesCsv).toHaveBeenCalledWith(
      actor,
      {
        from: '2026-05-01',
        to: '2026-05-09',
      },
    );
  });
});
