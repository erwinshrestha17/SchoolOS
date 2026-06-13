import { AuthMethod, LibraryFineStatus, LibraryIssueStatus, Prisma } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { LibraryHardeningService } from './library-hardening.service';

const actor: AuthContext = {
  tenantId: 'tenant-1',
  tenantSlug: 'school-one',
  userId: 'user-1',
  email: 'librarian@school.test',
  authMethod: AuthMethod.PASSWORD,
  roles: ['librarian'],
  permissions: ['library:fines:post', 'library:issues:return'],
};

describe('LibraryHardeningService M8A workflows', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns an already posted fine without creating a duplicate fee invoice', async () => {
    const fine = buildFine({
      feeInvoiceId: 'invoice-1',
      status: LibraryFineStatus.POSTED_TO_FEES,
    });
    const { service, libraryService } = buildService({ fine });

    const result = await service.postFineToFeesIdempotent(
      actor,
      'fine-1',
      'Approved by librarian',
    );

    expect(result).toEqual(
      expect.objectContaining({
        feeInvoiceId: 'invoice-1',
        alreadyPosted: true,
      }),
    );
    expect(libraryService.postFineToFees).not.toHaveBeenCalled();
  });

  it('delegates fine posting only when the fine has not been posted before', async () => {
    const fine = buildFine({ feeInvoiceId: null, status: LibraryFineStatus.PENDING });
    const { service, libraryService } = buildService({ fine });

    await service.postFineToFeesIdempotent(
      actor,
      'fine-1',
      'Approved by librarian',
    );

    expect(libraryService.postFineToFees).toHaveBeenCalledWith(
      actor,
      'fine-1',
      'Approved by librarian',
    );
  });

  it('reconciles a posted library fine to PAID from successful fee payments', async () => {
    const fine = buildFine({
      feeInvoiceId: 'invoice-1',
      status: LibraryFineStatus.POSTED_TO_FEES,
    });
    const { service, prisma, auditService } = buildService({
      fine,
      payments: [{ amount: new Prisma.Decimal(25), paidAt: new Date() }],
    });

    const result = await service.reconcileFinePayment(actor, 'fine-1');

    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ invoiceId: 'invoice-1' }),
      }),
    );
    expect(prisma.libraryFine.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'fine-1' },
        data: { status: LibraryFineStatus.PAID },
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'reconcile_payment',
        resource: 'library_fine',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({ alreadyReconciled: false, paidAmount: '25' }),
    );
  });

  it('keeps payment reconciliation idempotent when the fine status already matches payments', async () => {
    const fine = buildFine({
      feeInvoiceId: 'invoice-1',
      status: LibraryFineStatus.PAID,
    });
    const { service, prisma, auditService } = buildService({
      fine,
      payments: [{ amount: new Prisma.Decimal(25), paidAt: new Date() }],
    });

    const result = await service.reconcileFinePayment(actor, 'fine-1');

    expect(prisma.libraryFine.update).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({ alreadyReconciled: true, paidAmount: '25' }),
    );
  });

  it('excludes non-working school calendar days from generated overdue fines', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-05T00:00:00.000Z'));
    const { service, tx, prisma } = buildService({
      issue: buildIssue({ dueAt: new Date('2026-06-01T00:00:00.000Z') }),
      settings: {
        finePerDay: new Prisma.Decimal(10),
        maxFineAmount: null,
        gracePeriodDays: 0,
        lostBookChargeMultiplier: new Prisma.Decimal(1),
        maxBooksPerStudent: 3,
        maxBooksPerStaff: 5,
        studentLoanDays: 14,
        staffLoanDays: 30,
        includeHolidaysInFine: false,
        reservationHoldDays: 3,
      },
      holidays: [
        { calendarDate: new Date('2026-06-02T00:00:00.000Z') },
        { calendarDate: new Date('2026-06-04T00:00:00.000Z') },
      ],
    });

    await service.returnCopy('issue-1', { returnCondition: 'Good' }, actor);

    expect(prisma.schoolCalendarDay.findMany).toHaveBeenCalled();
    expect(tx.libraryFine.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: new Prisma.Decimal(20),
          status: LibraryFineStatus.PENDING,
        }),
      }),
    );
  });
});

function buildService(
  options: {
    fine?: ReturnType<typeof buildFine>;
    payments?: Array<{ amount: Prisma.Decimal; paidAt: Date }>;
    issue?: ReturnType<typeof buildIssue>;
    settings?: Record<string, unknown>;
    holidays?: Array<{ calendarDate: Date }>;
  } = {},
) {
  const issue = options.issue ?? buildIssue();
  const fine = options.fine ?? buildFine({ status: LibraryFineStatus.PENDING });

  const tx = {
    libraryFine: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'fine-1' }),
    },
    libraryIssue: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        ...issue,
        status: LibraryIssueStatus.RETURNED,
        fineAmount: new Prisma.Decimal(20),
        fines: [],
      }),
    },
    libraryCopy: {
      update: jest.fn().mockResolvedValue({ id: 'copy-1' }),
    },
    libraryCopyHistory: {
      create: jest.fn().mockResolvedValue({ id: 'history-1' }),
    },
  };

  const prisma = {
    libraryFine: {
      findFirst: jest.fn().mockResolvedValue(fine),
      update: jest.fn().mockImplementation((args) =>
        Promise.resolve({
          ...fine,
          ...args.data,
          issue: fine.issue,
        }),
      ),
    },
    payment: {
      findMany: jest.fn().mockResolvedValue(options.payments ?? []),
    },
    libraryIssue: {
      findFirst: jest.fn().mockResolvedValue(issue),
    },
    librarySetting: {
      findUnique: jest.fn().mockResolvedValue(options.settings ?? null),
    },
    schoolCalendarDay: {
      findMany: jest.fn().mockResolvedValue(options.holidays ?? []),
    },
    $transaction: jest.fn().mockImplementation(async (callback: unknown) => {
      return (callback as (transactionClient: typeof tx) => Promise<unknown>)(tx);
    }),
  };

  const auditService = { record: jest.fn().mockResolvedValue(undefined) };
  const libraryService = {
    postFineToFees: jest.fn().mockResolvedValue({
      id: 'fine-1',
      feeInvoiceId: 'invoice-1',
      alreadyPosted: false,
    }),
    sendOverdueReminders: jest.fn(),
  };

  return {
    service: new LibraryHardeningService(
      prisma as never,
      auditService as never,
      libraryService as never,
    ),
    prisma,
    tx,
    auditService,
    libraryService,
  };
}

function buildFine(
  overrides: Partial<{
    feeInvoiceId: string | null;
    status: LibraryFineStatus;
  }> = {},
) {
  return {
    id: 'fine-1',
    tenantId: actor.tenantId,
    issueId: 'issue-1',
    amount: new Prisma.Decimal(25),
    waivedAmount: new Prisma.Decimal(0),
    status: overrides.status ?? LibraryFineStatus.PENDING,
    feeInvoiceId: overrides.feeInvoiceId ?? null,
    feePostedAt: null,
    waiverReason: null,
    correctionReason: null,
    notes: null,
    issue: {
      id: 'issue-1',
      tenantId: actor.tenantId,
      borrowerStudentId: 'student-1',
      invoiceId: null,
    },
  };
}

function buildIssue(overrides: Partial<{ dueAt: Date }> = {}) {
  return {
    id: 'issue-1',
    tenantId: actor.tenantId,
    copyId: 'copy-1',
    borrowerStudentId: 'student-1',
    borrowerStaffId: null,
    dueAt: overrides.dueAt ?? new Date('2026-06-10T00:00:00.000Z'),
    status: LibraryIssueStatus.ISSUED,
    notes: null,
    copy: {
      id: 'copy-1',
      status: 'ISSUED',
      replacementCost: null,
      book: {
        title: 'Mathematics Grade 5',
        purchasePrice: null,
      },
    },
    borrowerStudent: { id: 'student-1' },
  };
}
