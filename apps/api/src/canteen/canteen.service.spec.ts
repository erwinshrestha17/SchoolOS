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

  it('creates meal-plan fee invoices through the finance boundary', async () => {
    const { service, tx, financeService } = buildService();

    const result = await service.enrollStudent(
      {
        studentId: 'student-1',
        mealPlanId: 'plan-1',
        startsOn: '2026-05-06',
      },
      actor,
    );

    expect(financeService.createCanteenMealPlanInvoice).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        actor,
        studentId: 'student-1',
        mealPlanName: 'Lunch Plan',
        amount: new Prisma.Decimal(1200),
        sourceEnrollmentId: 'enrollment-1',
      }),
    );
    expect(tx.canteenStudentEnrollment.update).toHaveBeenCalledWith({
      where: { id: 'enrollment-1' },
      data: expect.objectContaining({
        feeInvoiceId: 'invoice-meal-1',
      }),
    });
    expect(result).toEqual(
      expect.objectContaining({ feeInvoiceId: 'invoice-meal-1' }),
    );
  });

  it('blocks duplicate overlapping meal-plan fee assignments', async () => {
    const { service, tx, financeService } = buildService({
      duplicateEnrollment: { id: 'enrollment-existing' },
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

    expect(tx.canteenStudentEnrollment.create).not.toHaveBeenCalled();
    expect(financeService.createCanteenMealPlanInvoice).not.toHaveBeenCalled();
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

  it('deduplicates wallet top-up requests by idempotency key', async () => {
    const { service, tx, accountingPostingService } = buildService({
      existingWalletTransaction: {
        id: 'txn-existing',
        tenantId: actor.tenantId,
        studentId: 'student-1',
        wallet: {
          id: 'wallet-1',
          tenantId: actor.tenantId,
          studentId: 'student-1',
          balance: new Prisma.Decimal(500),
        },
      },
    });

    const result = await service.topUpWallet(
      'student-1',
      { amount: 500, idempotencyKey: 'topup-1' },
      actor,
    );

    expect(result.transaction).toEqual(
      expect.objectContaining({ id: 'txn-existing' }),
    );
    expect(tx.canteenWallet.update).not.toHaveBeenCalled();
    expect(accountingPostingService.postCanteenTopUp).not.toHaveBeenCalled();
  });

  it('prevents wallet balance from going negative when completing POS sale', async () => {
    const { service } = buildService({ walletDeductCount: 0 });

    await expect(
      service.completePosSale('sale-1', { note: 'complete' }, actor),
    ).rejects.toThrow(ConflictException);
  });

  it('treats completed POS completion retries as idempotent', async () => {
    const { service, tx, accountingPostingService } = buildService({
      posSale: {
        id: 'sale-1',
        tenantId: actor.tenantId,
        studentId: 'student-1',
        walletId: 'wallet-1',
        paymentMethod: CanteenPaymentMethod.WALLET,
        status: CanteenPosSaleStatus.COMPLETED,
        totalAmount: new Prisma.Decimal(100),
      },
    });

    const result = await service.completePosSale(
      'sale-1',
      { note: 'retry' },
      actor,
    );

    expect(result).toEqual(expect.objectContaining({ id: 'sale-1' }));
    expect(tx.canteenWallet.updateMany).not.toHaveBeenCalled();
    expect(accountingPostingService.postCanteenSale).not.toHaveBeenCalled();
  });

  it('returns completed POS receipt data from tenant-scoped sale lookup', async () => {
    const { service, prisma } = buildService({
      receiptSale: buildReceiptSale(),
    });

    const receipt = await service.getPosReceipt('sale-1', actor);

    expect(prisma.canteenPosSale.findFirst).toHaveBeenCalledWith({
      where: { id: 'sale-1', tenantId: actor.tenantId },
      include: {
        tenant: true,
        items: true,
        student: true,
        staff: true,
        wallet: true,
        createdBy: true,
      },
    });
    expect(receipt).toEqual(
      expect.objectContaining({
        receiptNumber: 'POS-2026-000001',
        saleId: 'sale-1',
        totalAmount: new Prisma.Decimal(100),
      }),
    );
  });

  it('builds a PDF receipt and audits reprint access', async () => {
    const { service, auditService } = buildService({
      receiptSale: buildReceiptSale(),
    });

    const pdf = await service.getPosReceiptPdf('sale-1', actor);

    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'reprint_receipt',
        resource: 'canteen_pos_sale',
        resourceId: 'sale-1',
      }),
    );
  });

  it('rejects wallet reversals that would make balance negative', async () => {
    const { service, tx } = buildService({
      walletBalance: new Prisma.Decimal(50),
      walletTransaction: {
        id: 'txn-1',
        tenantId: actor.tenantId,
        walletId: 'wallet-1',
        studentId: 'student-1',
        amount: new Prisma.Decimal(100),
        source: 'MANUAL',
        reversalOfId: null,
        correctionOfId: null,
      },
    });

    await expect(
      service.reverseWalletTransaction(
        'txn-1',
        { reason: 'Incorrect top-up' },
        actor,
      ),
    ).rejects.toThrow(ConflictException);

    expect(tx.canteenWallet.update).not.toHaveBeenCalled();
  });

  it('posts purchase bills through accounting and records stock movement', async () => {
    const { service, tx, accountingPostingService } = buildService();

    const result = await service.createPurchaseBill(
      {
        supplierId: 'supplier-1',
        billNumber: 'PB-001',
        billDate: '2026-05-10',
        taxAmount: 10,
        discountAmount: 5,
        notes: 'restock',
        items: [{ inventoryItemId: 'stock-1', quantity: 4, unitCost: 25 }],
      },
      actor,
    );

    expect(result).toEqual(expect.objectContaining({ id: 'purchase-1' }));
    expect(accountingPostingService.postCanteenPurchase).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: actor.tenantId,
        purchaseBillId: 'purchase-1',
        supplierId: 'supplier-1',
        amount: new Prisma.Decimal(100),
        taxAmount: new Prisma.Decimal(10),
        discountAmount: new Prisma.Decimal(5),
        netAmount: new Prisma.Decimal(105),
      }),
      actor,
      tx,
    );
    expect(tx.canteenInventoryItem.update).toHaveBeenCalledWith({
      where: { id: 'stock-1' },
      data: {
        currentStock: { increment: new Prisma.Decimal(4) },
        unitCost: new Prisma.Decimal(25),
      },
    });
    expect(tx.canteenStockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: actor.tenantId,
        inventoryItemId: 'stock-1',
        type: 'IN',
        quantity: new Prisma.Decimal(4),
        balanceAfter: new Prisma.Decimal(14),
        referenceType: 'PURCHASE',
        referenceId: 'purchase-1',
      }),
    });
  });

  it('rejects purchase bills when the supplier is outside the active tenant scope', async () => {
    const { service, tx, accountingPostingService } = buildService({
      supplier: null,
    });

    await expect(
      service.createPurchaseBill(
        {
          supplierId: 'supplier-cross-tenant',
          billNumber: 'PB-002',
          billDate: '2026-05-10',
          items: [{ inventoryItemId: 'stock-1', quantity: 4, unitCost: 25 }],
        },
        actor,
      ),
    ).rejects.toThrow(NotFoundException);

    expect(tx.canteenPurchaseBill.create).not.toHaveBeenCalled();
    expect(accountingPostingService.postCanteenPurchase).not.toHaveBeenCalled();
  });

  it('prevents wastage and manual stock adjustments from making stock negative', async () => {
    const { service, tx } = buildService({
      inventoryItem: {
        id: 'stock-1',
        tenantId: actor.tenantId,
        currentStock: new Prisma.Decimal(2),
        unitCost: new Prisma.Decimal(25),
      },
      inventoryUpdateManyCount: 0,
    });

    await expect(
      service.recordWastage(
        {
          inventoryItemId: 'stock-1',
          quantity: 3,
          reason: 'Expired',
          wastageDate: '2026-05-12',
        },
        actor,
      ),
    ).rejects.toThrow(ConflictException);

    await expect(
      service.manualStockAdjustment(
        {
          inventoryItemId: 'stock-1',
          quantity: -3,
          reason: 'Audit correction',
        },
        actor,
      ),
    ).rejects.toThrow(ConflictException);

    expect(tx.canteenWastage.create).not.toHaveBeenCalled();
    expect(tx.canteenStockMovement.create).not.toHaveBeenCalled();
  });

  it('uses an atomic stock guard for negative manual adjustments', async () => {
    const { service, tx } = buildService({
      inventoryItem: {
        id: 'stock-1',
        tenantId: actor.tenantId,
        currentStock: new Prisma.Decimal(10),
        unitCost: new Prisma.Decimal(25),
      },
    });

    await service.manualStockAdjustment(
      {
        inventoryItemId: 'stock-1',
        quantity: -3,
        reason: 'Kitchen issue count',
      },
      actor,
    );

    expect(tx.canteenInventoryItem.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'stock-1',
        tenantId: actor.tenantId,
        currentStock: { gte: new Prisma.Decimal(3) },
      },
      data: { currentStock: { decrement: new Prisma.Decimal(3) } },
    });
    expect(tx.canteenStockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: actor.tenantId,
        inventoryItemId: 'stock-1',
        type: 'OUT',
        quantity: new Prisma.Decimal(3),
        referenceType: 'MANUAL',
        reason: 'Kitchen issue count',
      }),
    });
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
    existingWalletTransaction?: unknown;
    walletTransaction?: unknown;
    walletBalance?: Prisma.Decimal;
    posSale?: unknown;
    receiptSale?: unknown;
    duplicateEnrollment?: unknown;
    supplier?: unknown;
    inventoryItem?: unknown;
    inventoryUpdateManyCount?: number;
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
    name: 'Lunch Plan',
    mealType: 'LUNCH',
    price: new Prisma.Decimal(1200),
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
  const sale = options.posSale ?? {
    id: 'sale-1',
    tenantId: actor.tenantId,
    studentId: 'student-1',
    walletId: 'wallet-1',
    paymentMethod: CanteenPaymentMethod.WALLET,
    status: CanteenPosSaleStatus.DRAFT,
    totalAmount: new Prisma.Decimal(100),
  };
  const supplier =
    options.supplier === undefined
      ? { id: 'supplier-1', tenantId: actor.tenantId, isActive: true }
      : options.supplier;
  const inventoryItem =
    options.inventoryItem === undefined
      ? {
          id: 'stock-1',
          tenantId: actor.tenantId,
          currentStock: new Prisma.Decimal(10),
          unitCost: new Prisma.Decimal(20),
        }
      : options.inventoryItem;
  const purchaseBill = {
    id: 'purchase-1',
    tenantId: actor.tenantId,
    supplierId: 'supplier-1',
    billNumber: 'PB-001',
    billDate: new Date('2026-05-10T00:00:00.000Z'),
    totalAmount: new Prisma.Decimal(100),
    taxAmount: new Prisma.Decimal(10),
    discountAmount: new Prisma.Decimal(5),
    netAmount: new Prisma.Decimal(105),
    notes: 'restock',
    items: [],
  };

  const tx = {
    canteenMenuItem: {
      findFirst: jest.fn().mockResolvedValue(menuItem),
    },
    canteenMealServing: {
      findFirst: jest.fn().mockResolvedValue(options.duplicateServing ?? null),
      create: jest.fn().mockResolvedValue({ id: 'serving-1' }),
    },
    canteenPosSaleItem: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    canteenStudentEnrollment: {
      create: jest.fn().mockResolvedValue({ id: 'enrollment-1' }),
      findFirst: jest.fn().mockImplementation(
        async (query: {
          where?: {
            studentId?: string;
            mealPlanId?: string;
            status?: { in?: string[] };
          };
        }) => {
          if (
            query.where?.studentId &&
            query.where?.mealPlanId &&
            query.where?.status?.in
          ) {
            return options.duplicateEnrollment ?? null;
          }
          return {
            id: 'enrollment-1',
            mealPlanId: 'plan-1',
            status: CanteenMealPlanStatus.ACTIVE,
            mealPlan,
          };
        },
      ),
      update: jest.fn().mockResolvedValue({
        id: 'enrollment-1',
        feeInvoiceId: 'invoice-meal-1',
        feePostedAt: new Date('2026-05-06T00:00:00.000Z'),
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
        balance: options.walletBalance ?? new Prisma.Decimal(900),
      }),
    },
    canteenWalletTransaction: {
      findUnique: jest
        .fn()
        .mockResolvedValue(options.existingWalletTransaction ?? null),
      findFirst: jest
        .fn()
        .mockImplementation(
          async (query: { where?: { reversalOfId?: string } }) => {
            if (query.where?.reversalOfId) return null;
            return options.walletTransaction ?? null;
          },
        ),
      create: jest.fn().mockResolvedValue({ id: 'txn-1' }),
    },
    canteenSpendingControl: {
      findFirst: jest.fn().mockResolvedValue(options.spendingControl ?? null),
    },
    canteenPosSale: {
      create: jest.fn().mockResolvedValue({ id: 'sale-1', items: [] }),
      findFirst: jest.fn().mockResolvedValue(sale),
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        ...(sale as Record<string, unknown>),
        items: [],
      }),
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
    canteenSupplier: {
      findFirst: jest.fn().mockResolvedValue(supplier),
    },
    canteenInventoryItem: {
      findFirst: jest.fn().mockResolvedValue(inventoryItem),
      findFirstOrThrow: jest.fn().mockResolvedValue(inventoryItem),
      findUniqueOrThrow: jest.fn().mockResolvedValue(inventoryItem),
      update: jest.fn().mockResolvedValue({
        ...(inventoryItem as Record<string, unknown>),
        currentStock: new Prisma.Decimal(14),
      }),
      updateMany: jest
        .fn()
        .mockResolvedValue({ count: options.inventoryUpdateManyCount ?? 1 }),
    },
    canteenPurchaseBill: {
      create: jest.fn().mockResolvedValue(purchaseBill),
    },
    canteenWastage: {
      create: jest.fn().mockResolvedValue({ id: 'wastage-1' }),
    },
    canteenStockMovement: {
      create: jest.fn().mockResolvedValue({ id: 'movement-1' }),
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
    canteenPosSale: {
      findFirst: jest.fn().mockResolvedValue(options.receiptSale ?? sale),
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
    postCanteenPurchase: jest.fn().mockResolvedValue({ id: 'acc-purchase' }),
  };

  const financeService = {
    createCanteenMealPlanInvoice: jest.fn().mockResolvedValue({
      id: 'invoice-meal-1',
      invoiceNumber: 'INV-2026-00001',
      sourceEnrollmentId: 'enrollment-1',
    }),
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
    auditService,
    accountingPostingService,
    financeService,
  };
}

function buildReceiptSale() {
  return {
    id: 'sale-1',
    tenantId: actor.tenantId,
    receiptNumber: 'POS-2026-000001',
    saleDate: new Date('2026-05-17T08:00:00.000Z'),
    completedAt: new Date('2026-05-17T08:01:00.000Z'),
    paymentMethod: CanteenPaymentMethod.WALLET,
    status: CanteenPosSaleStatus.COMPLETED,
    subtotal: new Prisma.Decimal(100),
    totalAmount: new Prisma.Decimal(100),
    discountAmount: new Prisma.Decimal(0),
    tenant: {
      name: 'Demo School',
      panNumber: '123456789',
    },
    items: [
      {
        itemName: 'Lunch Set',
        category: 'Lunch',
        quantity: 1,
        unitPrice: new Prisma.Decimal(100),
        lineTotal: new Prisma.Decimal(100),
      },
    ],
    student: {
      id: 'student-1',
      admissionNo: 'S-001',
      firstNameEn: 'Asha',
      lastNameEn: 'Student',
    },
    staff: null,
    wallet: {
      balance: new Prisma.Decimal(900),
    },
    createdBy: {
      email: 'canteen@schoolos.test',
    },
  };
}
