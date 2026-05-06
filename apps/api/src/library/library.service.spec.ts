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
    const { service, prisma } = buildService({ activeIssue: { id: 'issue-1' } });

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
});

function buildService(options: {
  book?: unknown;
  copy?: unknown;
  issue?: unknown;
  activeIssue?: unknown;
  issueUpdateCount?: number;
} = {}) {
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

  const copy =
    options.copy ??
    {
      id: 'copy-1',
      tenantId: actor.tenantId,
      bookId: 'book-1',
      barcode: 'LIB-0001',
      status: LibraryCopyStatus.AVAILABLE,
      book,
    };

  const issue =
    options.issue ??
    {
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
      findUniqueOrThrow: jest.fn().mockResolvedValue(returnedIssue),
    },
    student: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'student-1',
        enrollments: [{ academicYearId: 'ay-1' }],
      }),
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
    },
    student: {
      findFirst: jest.fn().mockResolvedValue({ id: 'student-1' }),
    },
    staff: {
      findFirst: jest.fn().mockResolvedValue(null),
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
  };

  return {
    service: new LibraryService(
      prisma as never,
      auditService as never,
      communicationsService as never,
      configService as never,
    ),
    prisma,
    tx,
    auditService,
    communicationsService,
  };
}
