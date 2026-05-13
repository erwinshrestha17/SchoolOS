import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  AuthMethod,
  CanteenMealPlanStatus,
  CanteenMealServingStatus,
  CanteenMenuItemStatus,
  CanteenPaymentMethod,
  CanteenPosSaleStatus,
  Prisma,
} from '@prisma/client';
import { CanteenService } from './canteen.service';

const actor = {
  tenantId: 'tenant-1',
  tenantSlug: 'default-school',
  userId: 'user-1',
  email: 'canteen@schoolos.test',
  authMethod: AuthMethod.PASSWORD,
  roles: ['admin'],
  permissions: [
    'canteen:menu:create',
    'canteen:plans:create',
    'canteen:enrollments:create',
    'canteen:serving:create',
    'canteen:wallets:update',
    'canteen:pos:create',
    'canteen:pos:update',
  ],
};

describe('CanteenService Phase 3C hardening', () => {
  it('creates tenant-scoped menu items', async () => {
    const { service, prisma } = buildService();

    const result = await service.createMenuItem(
      { name: 'Lunch Set', category: 'Lunch', unitPrice: 80 },
      actor,
    );

    expect(result).toEqual(expect.objectContaining({ id: 'item-1' }));
    expect(prisma.canteenMenuItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: actor.tenantId,
        name: 'Lunch Set',
        unitPrice: new Prisma.Decimal(80),
      }),
    });
  });

  it('prevents inactive meal plans from being assigned', async () => {
    const { service } = buildService({
      mealPlan: {
        id: 'plan-1',
        tenantId: actor.tenantId,
        status: CanteenMealPlanStatus.INACTIVE,
      },
    });

    await expect(
      service.enrollStudent(
        {
          studentId: 'student-1',
          mealPlanId: 'plan-1',
          startsOn: '2026-05-06',
        },
        actor,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('creates wallet top-up transactions inside a transaction', async () => {
    const { service, tx } = buildService();

    const result = await service.topUpWallet(
      'student-1',
      { amount: 500, note: 'cash counter' },
      actor,
    );

    expect(result.transaction).toEqual(
      expect.objectContaining({ id: 'txn-1' }),
    );
    expect(tx.canteenWallet.update).toHaveBeenCalledWith({
      where: { id: 'wallet-1' },
      data: expect.objectContaining({
        balance: { increment: new Prisma.Decimal(500) },
      }),
    });
    expect(tx.canteenWalletTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: actor.tenantId,
        walletId: 'wallet-1',
        studentId: 'student-1',
        amount: new Prisma.Decimal(500),
      }),
    });
  });

  it('prevents wallet balance from going negative when completing POS sale', async () => {
    const { service } = buildService({ walletDeductCount: 0 });

    await expect(
      service.completePosSale('sale-1', { note: 'complete' }, actor),
    ).rejects.toThrow(ConflictException);
  });

  it('prevents inactive menu items from being sold', async () => {
    const { service } = buildService({
      menuItem: {
        id: 'item-1',
        tenantId: actor.tenantId,
        name: 'Chips',
        category: 'Snacks',
        status: CanteenMenuItemStatus.INACTIVE,
        unitPrice: new Prisma.Decimal(50),
      },
    });

    await expect(
      service.createPosSale(
        {
          studentId: 'student-1',
          paymentMethod: CanteenPaymentMethod.WALLET,
          items: [{ menuItemId: 'item-1', quantity: 1 }],
        },
        actor,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('enforces daily spending limits', async () => {
    const { service } = buildService({
      spendingControl: {
        id: 'control-1',
        tenantId: actor.tenantId,
        studentId: 'student-1',
        isActive: true,
        blockedCategories: [],
        blockedMenuItemIds: [],
        dailySpendingLimit: new Prisma.Decimal(40),
      },
    });

    await expect(
      service.createPosSale(
        {
          studentId: 'student-1',
          paymentMethod: CanteenPaymentMethod.WALLET,
          items: [{ menuItemId: 'item-1', quantity: 1 }],
        },
        actor,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('prevents duplicate meal serving for the same student, meal, and date', async () => {
    const { service } = buildService({
      duplicateServing: {
        id: 'serving-existing',
        status: CanteenMealServingStatus.SERVED,
      },
    });

    await expect(
      service.serveMeal(
        { studentId: 'student-1', mealType: 'LUNCH', mealDate: '2026-05-06' },
        actor,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('prevents cross-tenant student access', async () => {
    const { service, prisma } = buildService({ student: null });

    await expect(
      service.getOrCreateWallet('student-cross-tenant', actor),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.student.findFirst).toHaveBeenCalledWith({
      where: { tenantId: actor.tenantId, id: 'student-cross-tenant' },
      select: { id: true },
    });
  });
});

function buildService(
  options: {
    student?: unknown;
    menuItem?: unknown;
    mealPlan?: unknown;
    spendingControl?: unknown;
    duplicateServing?: unknown;
    walletDeductCount?: number;
  } = {},
) {
  const student =
    options.student === undefined
      ? { id: 'student-1', tenantId: actor.tenantId }
      : options.student;
  const menuItem = options.menuItem ?? {
    id: 'item-1',
    tenantId: actor.tenantId,
    name: 'Lunch Set',
    category: 'Lunch',
    status: CanteenMenuItemStatus.ACTIVE,
    unitPrice: new Prisma.Decimal(80),
  };
  const mealPlan = options.mealPlan ?? {
    id: 'plan-1',
    tenantId: actor.tenantId,
    mealType: 'LUNCH',
    status: CanteenMealPlanStatus.ACTIVE,
    duplicateServingPrevention: true,
  };
  const wallet = {
    id: 'wallet-1',
    tenantId: actor.tenantId,
    studentId: 'student-1',
    balance: new Prisma.Decimal(1000),
    lowBalanceThreshold: new Prisma.Decimal(100),
  };
  const sale = {
    id: 'sale-1',
    tenantId: actor.tenantId,
    studentId: 'student-1',
    walletId: 'wallet-1',
    paymentMethod: CanteenPaymentMethod.WALLET,
    status: CanteenPosSaleStatus.DRAFT,
    totalAmount: new Prisma.Decimal(100),
  };

  const tx = {
    canteenMenuItem: {
      findFirst: jest.fn().mockResolvedValue(menuItem),
    },
    canteenMealServing: {
      findFirst: jest.fn().mockResolvedValue(options.duplicateServing ?? null),
      create: jest.fn().mockResolvedValue({ id: 'serving-1' }),
    },
    canteenStudentEnrollment: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'enrollment-1',
        mealPlanId: 'plan-1',
        status: CanteenMealPlanStatus.ACTIVE,
        mealPlan,
      }),
    },
    canteenWallet: {
      upsert: jest.fn().mockResolvedValue(wallet),
      update: jest.fn().mockResolvedValue({
        ...wallet,
        balance: new Prisma.Decimal(1500),
      }),
      updateMany: jest
        .fn()
        .mockResolvedValue({ count: options.walletDeductCount ?? 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        ...wallet,
        balance: new Prisma.Decimal(900),
      }),
    },
    canteenWalletTransaction: {
      create: jest.fn().mockResolvedValue({ id: 'txn-1' }),
    },
    canteenSpendingControl: {
      findFirst: jest.fn().mockResolvedValue(options.spendingControl ?? null),
    },
    canteenPosSale: {
      create: jest.fn().mockResolvedValue({ id: 'sale-1', items: [] }),
      findFirst: jest.fn().mockResolvedValue(sale),
      update: jest.fn().mockResolvedValue({
        ...sale,
        status: CanteenPosSaleStatus.COMPLETED,
        items: [],
      }),
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { totalAmount: new Prisma.Decimal(0) } }),
    },
    student: {
      findFirst: jest.fn().mockResolvedValue({
        severeAllergies: null,
        medicalConditions: null,
      }),
    },
  };

  const prisma = {
    student: {
      findFirst: jest.fn().mockResolvedValue(student),
    },
    canteenMenuItem: {
      create: jest.fn().mockResolvedValue({
        id: 'item-1',
        tenantId: actor.tenantId,
        name: 'Lunch Set',
      }),
    },
    canteenMealPlan: {
      findFirst: jest.fn().mockResolvedValue(mealPlan),
    },
    canteenStudentEnrollment: {
      create: jest.fn().mockResolvedValue({ id: 'enrollment-1' }),
    },
    $transaction: jest.fn().mockImplementation(async (input: unknown) => {
      if (Array.isArray(input)) {
        return Promise.all(input);
      }
      return (input as (transactionClient: typeof tx) => Promise<unknown>)(tx);
    }),
  };

  const auditService = {
    record: jest.fn().mockResolvedValue(undefined),
  };

  const accountingPostingService = {
    postCanteenTopUp: jest.fn().mockResolvedValue({ id: 'acc-topup' }),
    postCanteenSale: jest.fn().mockResolvedValue({ id: 'acc-sale' }),
    postCanteenReversal: jest.fn().mockResolvedValue({ id: 'acc-reversal' }),
  };

  const financeService = {
    // mock methods if needed
  };

  return {
    service: new CanteenService(
      prisma as never,
      auditService as never,
      accountingPostingService as never,
      financeService as never,
    ),
    prisma,
    tx,
    accountingPostingService,
    financeService,
  };
}
