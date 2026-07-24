import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  AuthMethod,
  LibraryCopyStatus,
  LibraryFineStatus,
  LibraryIssueStatus,
  Prisma,
} from '@prisma/client';
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

const teacherActor: AuthContext = {
  tenantId: 'tenant-1',
  tenantSlug: 'school-one',
  userId: 'teacher-user-1',
  email: 'teacher@school.test',
  authMethod: AuthMethod.PASSWORD,
  roles: ['subject_teacher'],
  permissions: ['library:issues:read'],
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
    const fine = buildFine({
      feeInvoiceId: null,
      status: LibraryFineStatus.PENDING,
    });
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

  it('archives instead of deleting a copy with issue/history records', async () => {
    const { service, prisma, tx } = buildService({
      copy: buildCopy({ issueCount: 1, historyCount: 1 }),
    });

    const result = await service.deleteCopy(
      'copy-1',
      'Damaged beyond repair',
      actor,
    );

    expect(prisma.libraryCopy.delete).not.toHaveBeenCalled();
    expect(tx.libraryCopy.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'copy-1' },
        data: expect.objectContaining({
          status: LibraryCopyStatus.ARCHIVED,
          archiveReason: 'Damaged beyond repair',
        }),
      }),
    );
    expect(result).toEqual(expect.objectContaining({ id: 'copy-1' }));
  });

  it('registers issued-book CSV exports through File Registry', async () => {
    const fileRegistryService = {
      registerGeneratedFile: jest.fn().mockResolvedValue({ id: 'file-1' }),
    };
    const { service } = buildService({ fileRegistryService });

    const result = await service.exportIssuedBooksCsvFile(actor);

    expect(fileRegistryService.registerGeneratedFile).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: actor.tenantId,
        generatedByUserId: actor.userId,
        mimeType: 'text/csv',
        module: 'library',
      }),
    );
    expect(result).toEqual(expect.objectContaining({ fileAssetId: 'file-1' }));
  });
});

describe('LibraryHardeningService Teacher scoping (confirmed gap fix)', () => {
  it('scopes listIssuesScoped to the teacher own staff record', async () => {
    const { service, prisma } = buildService({
      staff: { id: 'staff-teacher-1' },
    });

    await service.listIssuesScoped(teacherActor, {});

    expect(prisma.staff.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: teacherActor.tenantId,
          userId: teacherActor.userId,
        }),
      }),
    );
    expect(prisma.libraryIssue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          borrowerStaffId: 'staff-teacher-1',
        }),
      }),
    );
  });

  it('denies a teacher requesting another staff member library issues', async () => {
    const { service } = buildService({ staff: { id: 'staff-teacher-1' } });

    await expect(
      service.listIssuesScoped(teacherActor, { staffId: 'staff-other' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('denies a teacher requesting a student library issue history', async () => {
    const { service } = buildService({ staff: { id: 'staff-teacher-1' } });

    await expect(
      service.listIssuesScoped(teacherActor, { studentId: 'student-1' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects a teacher-role actor with no active staff profile', async () => {
    const { service } = buildService({ staff: null });

    await expect(service.listIssuesScoped(teacherActor, {})).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('scopes listReservations to the teacher own staff record', async () => {
    const { service, prisma } = buildService({
      staff: { id: 'staff-teacher-1' },
    });

    await service.listReservations(teacherActor, {});

    expect(prisma.libraryReservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          borrowerStaffId: 'staff-teacher-1',
        }),
      }),
    );
  });

  it('leaves librarian/admin actors unrestricted', async () => {
    const { service, prisma } = buildService();

    await service.listIssuesScoped(actor, {});

    expect(prisma.staff.findFirst).not.toHaveBeenCalled();
    expect(prisma.libraryIssue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({
          borrowerStaffId: expect.anything(),
        }),
      }),
    );
  });
});

describe('LibraryHardeningService catalog + circulation core workflows', () => {
  it('creates a tenant-scoped library book and blocks a duplicate ISBN in the same tenant', async () => {
    const { service, prisma, auditService } = buildService();

    const result = await service.createBook(
      {
        title: 'Mathematics Grade 5',
        author: 'Curriculum Team',
        isbn: '978-0000000001',
      },
      actor,
    );

    expect(result).toEqual(expect.objectContaining({ id: 'book-1' }));
    expect(prisma.libraryBook.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: actor.tenantId,
          title: 'Mathematics Grade 5',
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'create', resource: 'library_book' }),
    );

    const { service: conflictService } = buildService({
      existingBookWithIsbn: { id: 'book-other', isbn: '978-0000000001' },
    });
    await expect(
      conflictService.createBook(
        { title: 'Duplicate', author: 'X', isbn: '978-0000000001' },
        actor,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('creates a tenant-scoped copy and blocks a cross-tenant book reference', async () => {
    const { service, prisma } = buildService();

    const result = await service.createCopy(
      { bookId: 'book-1', barcode: 'LIB-0001' },
      actor,
    );

    expect(result).toEqual(expect.objectContaining({ id: 'copy-1' }));
    expect(prisma.libraryCopy.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: actor.tenantId,
          bookId: 'book-1',
          barcode: 'LIB-0001',
        }),
      }),
    );

    const { service: crossTenantService } = buildService({ book: null });
    await expect(
      crossTenantService.createCopy(
        { bookId: 'book-cross-tenant', barcode: 'LIB-0002' },
        actor,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('creates a tenant-scoped copy and blocks a duplicate barcode in the same tenant', async () => {
    const { service } = buildService({
      existingCopyWithBarcode: { id: 'copy-other', barcode: 'LIB-0001' },
    });

    await expect(
      service.createCopy({ bookId: 'book-1', barcode: 'LIB-0001' }, actor),
    ).rejects.toThrow(ConflictException);
  });

  it('issues an available copy to a student inside a transaction', async () => {
    const { service, tx, auditService } = buildService();

    const result = await service.issueCopy(
      {
        copyId: 'copy-1',
        borrowerStudentId: 'student-1',
        dueAt: futureDueAt(),
      },
      actor,
    );

    expect(result).toEqual(expect.objectContaining({ id: 'issue-1' }));
    expect(tx.libraryCopy.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'copy-1',
        tenantId: actor.tenantId,
        status: LibraryCopyStatus.AVAILABLE,
      },
      data: { status: LibraryCopyStatus.ISSUED },
    });
    expect(tx.libraryIssue.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: actor.tenantId,
          copyId: 'copy-1',
          borrowerStudentId: 'student-1',
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'issue', resource: 'library_issue' }),
    );
  });

  it('issues an available copy to a staff borrower', async () => {
    const { service, tx, prisma } = buildService({
      staff: { id: 'staff-1' },
    });

    await service.issueCopy(
      { copyId: 'copy-1', borrowerStaffId: 'staff-1', dueAt: futureDueAt() },
      actor,
    );

    expect(prisma.staff.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'staff-1', tenantId: actor.tenantId },
      }),
    );
    expect(tx.libraryIssue.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ borrowerStaffId: 'staff-1' }),
      }),
    );
  });

  it('blocks issuing to a borrower outside the actor tenant', async () => {
    const { service, prisma } = buildService({ student: null });

    await expect(
      service.issueCopy(
        {
          copyId: 'copy-1',
          borrowerStudentId: 'student-cross-tenant',
          dueAt: futureDueAt(),
        },
        actor,
      ),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.student.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'student-cross-tenant', tenantId: actor.tenantId },
      }),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('prevents double issue when the copy is no longer available (race guard)', async () => {
    const { service } = buildService({ copyIssueUpdateCount: 0 });

    await expect(
      service.issueCopy(
        {
          copyId: 'copy-1',
          borrowerStudentId: 'student-1',
          dueAt: futureDueAt(),
        },
        actor,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('returns an active issued copy inside a transaction', async () => {
    const { service, tx } = buildService();

    const result = await service.returnCopy(
      'issue-1',
      { returnCondition: 'Good', fineAmount: 0 },
      actor,
    );

    expect(result).toEqual(
      expect.objectContaining({ status: LibraryIssueStatus.RETURNED }),
    );
    expect(tx.libraryIssue.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'issue-1',
        tenantId: actor.tenantId,
        status: LibraryIssueStatus.ISSUED,
      },
      data: expect.objectContaining({ status: LibraryIssueStatus.RETURNED }),
    });
  });

  it('blocks returning an issue outside the actor tenant', async () => {
    const { service, prisma } = buildService({ issue: null });

    await expect(
      service.returnCopy(
        'issue-cross-tenant',
        { returnCondition: 'Good' },
        actor,
      ),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.libraryIssue.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'issue-cross-tenant', tenantId: actor.tenantId },
      }),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('prevents marking an actively issued copy as lost or damaged directly', async () => {
    const { service, tx } = buildService({
      activeIssueForCopy: { id: 'issue-1' },
    });

    await expect(
      service.markCopyStatus(
        'copy-1',
        {
          status: LibraryCopyStatus.DAMAGED,
          reason: 'Reported damaged while borrowed',
        },
        actor,
      ),
    ).rejects.toThrow(ConflictException);

    expect(tx.libraryCopy.update).not.toHaveBeenCalled();
  });

  it('requires an audit reason when marking a copy lost or damaged', async () => {
    const { service, tx } = buildService();

    await expect(
      service.markCopyStatus(
        'copy-1',
        { status: LibraryCopyStatus.LOST },
        actor,
      ),
    ).rejects.toThrow(
      'Reason is required when marking a library copy lost or damaged',
    );

    expect(tx.libraryCopy.update).not.toHaveBeenCalled();
  });
});

function buildService(
  options: {
    fine?: ReturnType<typeof buildFine>;
    payments?: { amount: Prisma.Decimal; paidAt: Date }[];
    issue?: ReturnType<typeof buildIssue> | null;
    settings?: Record<string, unknown>;
    holidays?: { calendarDate: Date }[];
    copy?: ReturnType<typeof buildCopy>;
    fileRegistryService?: { registerGeneratedFile: jest.Mock };
    staff?: { id: string } | null;
    book?: { id: string; tenantId: string; archivedAt: null } | null;
    existingBookWithIsbn?: unknown;
    existingCopyWithBarcode?: unknown;
    student?: { id: string; tenantId: string } | null;
    activeIssueForCopy?: unknown;
    copyIssueUpdateCount?: number;
    existingReservationForBook?: unknown;
  } = {},
) {
  // Deliberately not `??`: `issue: null` (cross-tenant/not-found fixture) must
  // stay null, while an omitted key falls back to the default fixture.
  const issueForFindFirst =
    options.issue === undefined ? buildIssue() : options.issue;
  const issue = issueForFindFirst ?? buildIssue();
  const fine = options.fine ?? buildFine({ status: LibraryFineStatus.PENDING });
  const copy = options.copy ?? buildCopy();
  const book =
    options.book === undefined
      ? { id: 'book-1', tenantId: actor.tenantId, archivedAt: null }
      : options.book;
  const student =
    options.student === undefined
      ? { id: 'student-1', tenantId: actor.tenantId }
      : options.student;

  const tx = {
    libraryFine: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'fine-1' }),
    },
    libraryIssue: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue({
        id: 'issue-1',
        tenantId: actor.tenantId,
        copyId: copy.id,
        borrowerStudentId: 'student-1',
        borrowerStaffId: null,
        dueAt: new Date('2026-06-15T00:00:00.000Z'),
      }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        ...issue,
        status: LibraryIssueStatus.RETURNED,
        fineAmount: new Prisma.Decimal(20),
        fines: [],
      }),
    },
    libraryCopy: {
      update: jest.fn().mockResolvedValue({
        ...copy,
        status: LibraryCopyStatus.ARCHIVED,
        archivedAt: new Date(),
        archiveReason: 'Damaged beyond repair',
      }),
      updateMany: jest
        .fn()
        .mockResolvedValue({ count: options.copyIssueUpdateCount ?? 1 }),
    },
    libraryReservation: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    libraryCopyHistory: {
      create: jest.fn().mockResolvedValue({ id: 'history-1' }),
    },
  };

  const prisma = {
    libraryBook: {
      findUnique: jest
        .fn()
        .mockResolvedValue(options.existingBookWithIsbn ?? null),
      findFirst: jest.fn().mockResolvedValue(book),
      create: jest
        .fn()
        .mockImplementation((args) =>
          Promise.resolve({ id: 'book-1', ...args.data }),
        ),
    },
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
      findFirst: jest
        .fn()
        .mockImplementation(
          async (query: { where?: { status?: string; id?: string } }) => {
            if (
              query?.where?.status === LibraryIssueStatus.ISSUED &&
              !query.where.id
            ) {
              return options.activeIssueForCopy ?? null;
            }
            return issueForFindFirst;
          },
        ),
      findMany: jest.fn().mockResolvedValue([
        {
          ...issue,
          copy: {
            ...issue.copy,
            barcode: 'BC-1',
          },
          borrowerStaff: null,
        },
      ]),
      count: jest.fn().mockResolvedValue(1),
    },
    libraryCopy: {
      findFirst: jest.fn().mockResolvedValue(copy),
      findUnique: jest
        .fn()
        .mockResolvedValue(options.existingCopyWithBarcode ?? null),
      create: jest
        .fn()
        .mockImplementation((args) =>
          Promise.resolve({ id: 'copy-1', ...args.data }),
        ),
      delete: jest.fn().mockResolvedValue(copy),
    },
    librarySetting: {
      findUnique: jest.fn().mockResolvedValue(options.settings ?? null),
    },
    schoolCalendarDay: {
      findMany: jest.fn().mockResolvedValue(options.holidays ?? []),
    },
    staff: {
      findFirst: jest.fn().mockResolvedValue(options.staff ?? null),
    },
    student: {
      findFirst: jest.fn().mockResolvedValue(student),
    },
    libraryReservation: {
      findFirst: jest
        .fn()
        .mockResolvedValue(options.existingReservationForBook ?? null),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    $transaction: jest.fn().mockImplementation(async (callback: unknown) => {
      if (Array.isArray(callback)) {
        return Promise.all(callback);
      }
      return (callback as (transactionClient: typeof tx) => Promise<unknown>)(
        tx,
      );
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
      options.fileRegistryService as never,
    ),
    prisma,
    tx,
    auditService,
    libraryService,
  };
}

function buildCopy(
  overrides: Partial<{ issueCount: number; historyCount: number }> = {},
) {
  return {
    id: 'copy-1',
    tenantId: actor.tenantId,
    bookId: 'book-1',
    barcode: 'BC-1',
    qrCode: 'BC-1',
    archivedAt: null,
    status: LibraryCopyStatus.AVAILABLE,
    _count: {
      issues: overrides.issueCount ?? 0,
      history: overrides.historyCount ?? 0,
    },
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
    issuedAt: new Date('2026-06-01T00:00:00.000Z'),
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

function futureDueAt() {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
}
