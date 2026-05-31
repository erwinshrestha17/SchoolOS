import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  AuthMethod,
  LibraryCopyStatus,
  LibraryIssueStatus,
  Prisma,
} from '@prisma/client';
import { LibraryService } from './library.service';

const actor = {
  tenantId: 'tenant-1',
  tenantSlug: 'default-school',
  userId: 'user-1',
  email: 'librarian@schoolos.test',
  authMethod: AuthMethod.PASSWORD,
  roles: ['librarian'],
  permissions: [
    'library:books:create',
    'library:books:read',
    'library:books:update',
    'library:copies:create',
    'library:copies:read',
    'library:copies:update',
    'library:issues:create',
    'library:issues:read',
    'library:issues:return',
    'library:reports:read',
  ],
};

describe('LibraryService Phase 3A foundation', () => {
  it('creates a tenant-scoped library book', async () => {
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
    expect(prisma.libraryBook.findUnique).toHaveBeenCalledWith({
      where: {
        tenantId_isbn: {
          tenantId: actor.tenantId,
          isbn: '978-0000000001',
        },
      },
    });
    expect(prisma.libraryBook.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: actor.tenantId,
        title: 'Mathematics Grade 5',
        author: 'Curriculum Team',
      }),
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: actor.tenantId,
        action: 'create',
        resource: 'library_book',
      }),
    );
  });

  it('creates a tenant-scoped copy with a per-tenant unique barcode', async () => {
    const { service, prisma } = buildService();

    const result = await service.createCopy(
      {
        bookId: 'book-1',
        barcode: 'LIB-0001',
        shelfLocation: 'A1',
      },
      actor,
    );

    expect(result).toEqual(expect.objectContaining({ id: 'copy-1' }));
    expect(prisma.libraryBook.findFirst).toHaveBeenCalledWith({
      where: { id: 'book-1', tenantId: actor.tenantId },
    });
    expect(prisma.libraryCopy.findUnique).toHaveBeenCalledWith({
      where: {
        tenantId_barcode: {
          tenantId: actor.tenantId,
          barcode: 'LIB-0001',
        },
      },
    });
    expect(prisma.libraryCopy.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: actor.tenantId,
        bookId: 'book-1',
        barcode: 'LIB-0001',
      }),
      include: { book: true },
    });
  });

  it('issues an available copy inside a transaction', async () => {
    const { service, tx, auditService } = buildService();

    const result = await service.issueCopy(
      {
        copyId: 'copy-1',
        borrowerStudentId: 'student-1',
        dueAt: '2026-05-30T00:00:00.000Z',
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
    expect(tx.libraryIssue.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: actor.tenantId,
        copyId: 'copy-1',
        borrowerStudentId: 'student-1',
      }),
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'issue', resource: 'library_issue' }),
    );
  });

  it('supports staff borrowers while preserving tenant-scoped borrower lookup', async () => {
    const { service, tx, prisma } = buildService({
      staff: { id: 'staff-1', tenantId: actor.tenantId },
    });

    await service.issueCopy(
      {
        copyId: 'copy-1',
        borrowerStaffId: 'staff-1',
        dueAt: '2026-05-30T00:00:00.000Z',
      },
      actor,
    );

    expect(prisma.staff.findFirst).toHaveBeenCalledWith({
      where: { id: 'staff-1', tenantId: actor.tenantId },
    });
    expect(tx.libraryIssue.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: actor.tenantId,
        borrowerStudentId: null,
        borrowerStaffId: 'staff-1',
      }),
    });
  });

  it('returns an active issued copy inside a transaction', async () => {
    const { service, tx } = buildService();

    const result = await service.returnCopy(
      'issue-1',
      {
        returnCondition: 'Good',
        fineAmount: 0,
      },
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
      data: expect.objectContaining({
        status: LibraryIssueStatus.RETURNED,
        fineAmount: new Prisma.Decimal(0),
      }),
    });
    expect(tx.libraryCopy.update).toHaveBeenCalledWith({
      where: { id: 'copy-1' },
      data: { status: LibraryCopyStatus.AVAILABLE },
    });
  });

  it('prevents double issue when the copy is no longer available', async () => {
    const { service } = buildService({ issueUpdateCount: 0 });

    await expect(
      service.issueCopy(
        {
          copyId: 'copy-1',
          borrowerStudentId: 'student-1',
          dueAt: '2026-05-30T00:00:00.000Z',
        },
        actor,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('prevents cross-tenant copy creation by requiring the book in the actor tenant', async () => {
    const { service, prisma } = buildService({ book: null });

    await expect(
      service.createCopy(
        {
          bookId: 'book-cross-tenant',
          barcode: 'LIB-0002',
        },
        actor,
      ),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.libraryBook.findFirst).toHaveBeenCalledWith({
      where: { id: 'book-cross-tenant', tenantId: actor.tenantId },
    });
    expect(prisma.libraryCopy.create).not.toHaveBeenCalled();
  });

  it('prevents marking an actively issued copy as lost or damaged directly', async () => {
    const { service, prisma } = buildService({
      activeIssue: { id: 'issue-1' },
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

    expect(prisma.libraryIssue.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        copyId: 'copy-1',
        status: LibraryIssueStatus.ISSUED,
      },
    });
    expect(prisma.libraryCopy.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: LibraryCopyStatus.DAMAGED },
      }),
    );
  });

  it('calculates fine and creates fine record during return', async () => {
    const { service, tx, prisma } = buildService();
    const issue = {
      id: 'issue-1',
      dueAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 60_000),
      copyId: 'copy-1',
      tenantId: actor.tenantId,
      status: LibraryIssueStatus.ISSUED,
      copy: { book: { title: 'Test' } },
    };
    prisma.libraryIssue.findFirst.mockResolvedValue(issue);

    await service.returnCopy('issue-1', { returnCondition: 'Good' }, actor);

    // 5 days * 5 (config) = 25
    expect(tx.libraryFine.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: new Prisma.Decimal(25),
          status: 'PENDING',
        }),
      }),
    );
  });

  it('posts student library fines through fees and accounting boundaries', async () => {
    const fine = buildLibraryFine();
    const { service, tx, accountingPostingService, auditService } =
      buildService({ fine });

    const result = await service.postFineToFees(
      actor,
      'fine-1',
      'Approved by librarian',
    );

    expect(tx.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: actor.tenantId,
          studentId: 'student-1',
          totalAmount: fine.amount,
        }),
      }),
    );
    expect(accountingPostingService.postInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: actor.tenantId,
        invoiceId: 'invoice-1',
        studentId: 'student-1',
        totalAmount: fine.amount,
      }),
      actor,
      tx,
    );
    expect(tx.libraryFine.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'fine-1' },
        data: expect.objectContaining({
          status: 'POSTED_TO_FEES',
          feeInvoiceId: 'invoice-1',
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'post_to_fees',
        resource: 'library_fine',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({ feeInvoiceId: 'invoice-1' }),
    );
  });

  it('uses purpose-limited Student QR resolution for library borrower lookup', async () => {
    const { service, studentQrService } = buildService();

    await service.resolveQrBorrower(actor, 'signed-token');

    expect(studentQrService.resolveQr).toHaveBeenCalledWith(
      actor.tenantId,
      'signed-token',
      'LIBRARY',
      actor,
    );
  });

  it('uses tenant settings for fine calculation if available', async () => {
    const { service, tx, prisma } = buildService();
    const issue = {
      id: 'issue-1',
      dueAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 60_000), // 5 days ago
      copyId: 'copy-1',
      tenantId: actor.tenantId,
      status: LibraryIssueStatus.ISSUED,
      copy: { book: { title: 'Test' } },
    };
    prisma.libraryIssue.findFirst.mockResolvedValue(issue);
    prisma.librarySetting.findUnique.mockResolvedValue({
      finePerDay: new Prisma.Decimal(10),
    });

    await service.returnCopy('issue-1', { returnCondition: 'Good' }, actor);

    expect(tx.libraryFine.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: new Prisma.Decimal(50),
          status: 'PENDING',
        }),
      }),
    );
  });

  it('uses caller-provided source ids for overdue reminder deduplication', async () => {
    const { service, communicationsService } = buildService();

    await service.sendOverdueReminders(
      actor,
      'library-overdue-tenant-1-2026-05-31',
    );

    expect(communicationsService.recordDeliveryRecords).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: 'library_overdue',
        sourceId: 'library-overdue-tenant-1-2026-05-31',
        studentIds: ['student-1'],
      }),
    );
  });
});

function buildService(
  options: {
    book?: unknown;
    copy?: unknown;
    issue?: unknown;
    activeIssue?: unknown;
    issueUpdateCount?: number;
    staff?: unknown;
    fine?: ReturnType<typeof buildLibraryFine>;
  } = {},
) {
  const book =
    options.book === undefined
      ? {
          id: 'book-1',
          tenantId: actor.tenantId,
          title: 'Mathematics Grade 5',
          author: 'Curriculum Team',
          isbn: '978-0000000001',
        }
      : options.book;

  const copy = options.copy ?? {
    id: 'copy-1',
    tenantId: actor.tenantId,
    bookId: 'book-1',
    barcode: 'LIB-0001',
    status: LibraryCopyStatus.AVAILABLE,
    book,
  };

  const issue = options.issue ?? {
    id: 'issue-1',
    tenantId: actor.tenantId,
    copyId: 'copy-1',
    borrowerStudentId: 'student-1',
    borrowerStaffId: null,
    dueAt: new Date('2099-05-30T00:00:00.000Z'),
    status: LibraryIssueStatus.ISSUED,
    notes: null,
    copy: {
      ...copy,
      book,
    },
    borrowerStudent: { id: 'student-1' },
  };

  const returnedIssue = {
    ...(issue as Record<string, unknown>),
    status: LibraryIssueStatus.RETURNED,
    returnedAt: new Date('2026-05-01T00:00:00.000Z'),
    fineAmount: new Prisma.Decimal(0),
  };

  const tx = {
    academicYear: {
      findFirst: jest.fn().mockResolvedValue({ id: 'ay-1' }),
    },
    feeHead: {
      upsert: jest.fn().mockResolvedValue({ id: 'fee-head-library-fine' }),
    },
    invoice: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: 'invoice-1' }),
    },
    libraryCopy: {
      updateMany: jest
        .fn()
        .mockResolvedValue({ count: options.issueUpdateCount ?? 1 }),
      update: jest.fn().mockResolvedValue({
        ...(copy as Record<string, unknown>),
        status: LibraryCopyStatus.AVAILABLE,
      }),
    },
    libraryIssue: {
      create: jest.fn().mockResolvedValue({
        id: 'issue-1',
        tenantId: actor.tenantId,
        copyId: 'copy-1',
        borrowerStudentId: 'student-1',
        borrowerStaffId: null,
        dueAt: new Date('2026-05-30T00:00:00.000Z'),
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockImplementation((args) =>
        Promise.resolve({
          ...(issue as Record<string, unknown>),
          ...args.data,
        }),
      ),
      findUniqueOrThrow: jest.fn().mockResolvedValue(returnedIssue),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    student: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'student-1',
        enrollments: [{ academicYearId: 'ay-1' }],
      }),
    },
    librarySetting: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest
        .fn()
        .mockImplementation((args) => Promise.resolve(args.create)),
    },
    libraryFine: {
      create: jest
        .fn()
        .mockImplementation((args) =>
          Promise.resolve({ id: 'fine-1', ...args.data }),
        ),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockImplementation((args) =>
        Promise.resolve({
          id: 'fine-1',
          issueId: 'issue-1',
          ...args.data,
          issue: options.fine?.issue ?? issue,
        }),
      ),
      findFirst: jest
        .fn()
        .mockResolvedValue(options.fine ? { ...options.fine } : null),
    },
  };

  const prisma = {
    libraryBook: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(book),
      findMany: jest.fn().mockResolvedValue(book ? [book] : []),
      count: jest.fn().mockResolvedValue(book ? 1 : 0),
      create: jest.fn().mockResolvedValue({
        ...(book as Record<string, unknown>),
        id: 'book-1',
        tenantId: actor.tenantId,
      }),
      update: jest.fn().mockResolvedValue(book),
    },
    libraryCopy: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(copy),
      findMany: jest.fn().mockResolvedValue(copy ? [copy] : []),
      count: jest.fn().mockResolvedValue(copy ? 1 : 0),
      create: jest.fn().mockResolvedValue({
        ...(copy as Record<string, unknown>),
        id: 'copy-1',
        tenantId: actor.tenantId,
      }),
      update: jest.fn().mockResolvedValue(copy),
    },
    libraryIssue: {
      findFirst: jest
        .fn()
        .mockImplementation(async (query: { where?: { status?: string } }) => {
          if (query.where?.status === LibraryIssueStatus.ISSUED) {
            return options.activeIssue ?? null;
          }

          return issue;
        }),
      findMany: jest.fn().mockResolvedValue(issue ? [issue] : []),
      count: jest.fn().mockResolvedValue(issue ? 1 : 0),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    libraryFine: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest
        .fn()
        .mockImplementation((args) =>
          Promise.resolve({ id: 'fine-1', ...args.data }),
        ),
      update: jest
        .fn()
        .mockImplementation((args) => Promise.resolve(args.data)),
      findFirst: jest
        .fn()
        .mockResolvedValue(options.fine ? { ...options.fine } : null),
    },
    librarySetting: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest
        .fn()
        .mockImplementation((args) => Promise.resolve(args.create)),
    },
    student: {
      findFirst: jest.fn().mockResolvedValue({ id: 'student-1' }),
    },
    staff: {
      findFirst: jest.fn().mockResolvedValue(options.staff ?? null),
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
  const communicationsService = {
    recordDeliveryRecords: jest.fn().mockResolvedValue({ count: 1 }),
  };
  const configService = {
    libraryFinePerDay: 5,
    libraryMaxBooksPerStudent: 3,
  };
  const accountingPostingService = {
    postInvoice: jest.fn().mockResolvedValue({ id: 'journal-1' }),
    postFeeWaiver: jest.fn().mockResolvedValue({ id: 'waiver-journal-1' }),
  };
  const studentQrService = {
    resolveQr: jest.fn().mockResolvedValue({ studentId: 'student-1' }),
  };

  return {
    service: new LibraryService(
      prisma as never,
      auditService as never,
      communicationsService as never,
      configService as never,
      accountingPostingService as never,
      studentQrService as never,
    ),
    prisma,
    tx,
    auditService,
    communicationsService,
    accountingPostingService,
    studentQrService,
  };
}

function buildLibraryFine() {
  const amount = new Prisma.Decimal(25);
  return {
    id: 'fine-1',
    tenantId: actor.tenantId,
    issueId: 'issue-1',
    amount,
    status: 'PENDING',
    feeInvoiceId: null,
    issue: {
      id: 'issue-1',
      tenantId: actor.tenantId,
      borrowerStudentId: 'student-1',
      invoiceId: null,
      copy: {
        id: 'copy-1',
        barcode: 'LIB-0001',
        book: { title: 'Test Book' },
      },
      borrowerStudent: { id: 'student-1' },
    },
  };
}
