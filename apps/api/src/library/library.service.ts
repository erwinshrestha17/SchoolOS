import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AudienceType,
  ConsentType,
  FeeFrequency,
  InvoiceStatus,
  LibraryCopyStatus,
  LibraryIssueStatus,
  NotificationChannel,
  Prisma,
  ChartAccountType,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AccountingPostingService } from '../accounting/accounting-posting.service';
import type { AuthContext } from '../auth/auth.types';
import { CommunicationsService } from '../communications/communications.service';
import { ConfigService } from '../config/config.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLibraryBookDto } from './dto/create-library-book.dto';
import { CreateLibraryCopyDto } from './dto/create-library-copy.dto';
import { IssueLibraryCopyDto } from './dto/issue-library-copy.dto';
import { MarkLibraryCopyStatusDto } from './dto/mark-library-copy-status.dto';
import { ReturnLibraryCopyDto } from './dto/return-library-copy.dto';
import { UpdateLibraryBookDto } from './dto/update-library-book.dto';
import { UpdateLibraryCopyDto } from './dto/update-library-copy.dto';

interface PaginationQuery {
  page?: string;
  limit?: string;
}

interface ListBooksQuery extends PaginationQuery {
  query?: string;
}

interface ListCopiesQuery extends PaginationQuery {
  bookId?: string;
  status?: string;
  barcode?: string;
}

interface ListIssuesQuery extends PaginationQuery {
  status?: string;
  studentId?: string;
  staffId?: string;
}

@Injectable()
export class LibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly communicationsService: CommunicationsService,
    private readonly configService: ConfigService,
    private readonly accountingPostingService: AccountingPostingService,
  ) {}

  async listBooks(actor: AuthContext, options: ListBooksQuery = {}) {
    const { skip, take, page } = this.pagination(options);
    const where: Prisma.LibraryBookWhereInput = {
      tenantId: actor.tenantId,
      ...(options.query
        ? {
            OR: [
              { title: { contains: options.query, mode: 'insensitive' } },
              { author: { contains: options.query, mode: 'insensitive' } },
              { isbn: { contains: options.query, mode: 'insensitive' } },
              {
                subjectCategory: {
                  contains: options.query,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
      archivedAt: null,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.libraryBook.findMany({
        where,
        include: { copies: true },
        orderBy: [{ title: 'asc' }],
        skip,
        take,
      }),
      this.prisma.libraryBook.count({ where }),
    ]);

    return { items, meta: { page, limit: take, total } };
  }

  async createBook(dto: CreateLibraryBookDto, actor: AuthContext) {
    if (dto.isbn) {
      await this.ensureUniqueIsbn(actor.tenantId, dto.isbn);
    }

    const book = await this.prisma.libraryBook.create({
      data: {
        tenantId: actor.tenantId,
        title: dto.title,
        author: dto.author,
        isbn: dto.isbn ?? null,
        publisher: dto.publisher ?? null,
        publishedYear: dto.publishedYear ?? null,
        subjectCategory: dto.subjectCategory ?? null,
        classLevel: dto.classLevel ?? null,
        purchasePrice:
          dto.purchasePrice === undefined
            ? null
            : new Prisma.Decimal(dto.purchasePrice),
      },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'library_book',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: book.id,
      after: { title: book.title, author: book.author, isbn: book.isbn },
    });

    return book;
  }

  async updateBook(
    bookId: string,
    dto: UpdateLibraryBookDto,
    actor: AuthContext,
  ) {
    const existing = await this.prisma.libraryBook.findFirst({
      where: { id: bookId, tenantId: actor.tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Book not found in this tenant');
    }

    if (dto.isbn && dto.isbn !== existing.isbn) {
      await this.ensureUniqueIsbn(actor.tenantId, dto.isbn);
    }

    const updated = await this.prisma.libraryBook.update({
      where: { id: existing.id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.author !== undefined ? { author: dto.author } : {}),
        ...(dto.isbn !== undefined ? { isbn: dto.isbn } : {}),
        ...(dto.publisher !== undefined ? { publisher: dto.publisher } : {}),
        ...(dto.publishedYear !== undefined
          ? { publishedYear: dto.publishedYear }
          : {}),
        ...(dto.subjectCategory !== undefined
          ? { subjectCategory: dto.subjectCategory }
          : {}),
        ...(dto.classLevel !== undefined ? { classLevel: dto.classLevel } : {}),
        ...(dto.purchasePrice !== undefined
          ? { purchasePrice: new Prisma.Decimal(dto.purchasePrice) }
          : {}),
      },
    });

    await this.auditService.record({
      action: 'update',
      resource: 'library_book',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.id,
      before: {
        title: existing.title,
        author: existing.author,
        isbn: existing.isbn,
      },
      after: {
        title: updated.title,
        author: updated.author,
        isbn: updated.isbn,
      },
    });

    return updated;
  }

  async archiveBook(bookId: string, reason: string, actor: AuthContext) {
    const book = await this.prisma.libraryBook.findFirst({
      where: { id: bookId, tenantId: actor.tenantId },
      include: { copies: true },
    });

    if (!book) {
      throw new NotFoundException('Book not found in this tenant');
    }

    const issuedCopies = book.copies.filter(
      (c) => c.status === LibraryCopyStatus.ISSUED,
    );
    if (issuedCopies.length > 0) {
      throw new ConflictException('Cannot archive book with issued copies');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Archive all copies too
      await tx.libraryCopy.updateMany({
        where: { bookId: book.id, tenantId: actor.tenantId },
        data: {
          status: LibraryCopyStatus.ARCHIVED,
          archivedAt: new Date(),
          archiveReason: reason,
        },
      });

      return tx.libraryBook.update({
        where: { id: book.id },
        data: {
          archivedAt: new Date(),
          archiveReason: reason,
        },
      });
    });

    await this.auditService.record({
      action: 'archive',
      resource: 'library_book',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.id,
      after: { title: updated.title, reason },
    });

    return updated;
  }

  async listCopies(actor: AuthContext, options: ListCopiesQuery = {}) {
    const { skip, take, page } = this.pagination(options);
    const where: Prisma.LibraryCopyWhereInput = {
      tenantId: actor.tenantId,
      ...(options.bookId ? { bookId: options.bookId } : {}),
      ...(options.status
        ? { status: this.parseCopyStatus(options.status) }
        : {}),
      ...(options.barcode
        ? { barcode: { contains: options.barcode, mode: 'insensitive' } }
        : {}),
      archivedAt: null,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.libraryCopy.findMany({
        where,
        include: { book: true },
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take,
      }),
      this.prisma.libraryCopy.count({ where }),
    ]);

    return { items, meta: { page, limit: take, total } };
  }

  async createCopy(dto: CreateLibraryCopyDto, actor: AuthContext) {
    const book = await this.prisma.libraryBook.findFirst({
      where: { id: dto.bookId, tenantId: actor.tenantId },
    });

    if (!book) {
      throw new NotFoundException('Book not found in this tenant');
    }

    await this.ensureUniqueBarcode(actor.tenantId, dto.barcode);

    const copy = await this.prisma.libraryCopy.create({
      data: {
        tenantId: actor.tenantId,
        bookId: book.id,
        barcode: dto.barcode,
        qrCode: dto.qrCode ?? dto.barcode,
        shelfLocation: dto.shelfLocation ?? null,
        replacementCost:
          dto.replacementCost === undefined
            ? null
            : new Prisma.Decimal(dto.replacementCost),
        purchasedAt: dto.purchasedAt ? new Date(dto.purchasedAt) : null,
      },
      include: { book: true },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'library_copy',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: copy.id,
      after: { bookId: copy.bookId, barcode: copy.barcode },
    });

    return copy;
  }

  async updateCopy(
    copyId: string,
    dto: UpdateLibraryCopyDto,
    actor: AuthContext,
  ) {
    const existing = await this.prisma.libraryCopy.findFirst({
      where: { id: copyId, tenantId: actor.tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Library copy not found in this tenant');
    }

    if (dto.bookId && dto.bookId !== existing.bookId) {
      const book = await this.prisma.libraryBook.findFirst({
        where: { id: dto.bookId, tenantId: actor.tenantId },
      });

      if (!book) {
        throw new NotFoundException('Book not found in this tenant');
      }
    }

    if (dto.barcode && dto.barcode !== existing.barcode) {
      await this.ensureUniqueBarcode(actor.tenantId, dto.barcode);
    }

    const updated = await this.prisma.libraryCopy.update({
      where: { id: existing.id },
      data: {
        ...(dto.bookId !== undefined ? { bookId: dto.bookId } : {}),
        ...(dto.barcode !== undefined ? { barcode: dto.barcode } : {}),
        ...(dto.qrCode !== undefined ? { qrCode: dto.qrCode } : {}),
        ...(dto.shelfLocation !== undefined
          ? { shelfLocation: dto.shelfLocation }
          : {}),
        ...(dto.replacementCost !== undefined
          ? { replacementCost: new Prisma.Decimal(dto.replacementCost) }
          : {}),
        ...(dto.purchasedAt !== undefined
          ? { purchasedAt: dto.purchasedAt ? new Date(dto.purchasedAt) : null }
          : {}),
      },
      include: { book: true },
    });

    await this.auditService.record({
      action: 'update',
      resource: 'library_copy',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.id,
      before: {
        bookId: existing.bookId,
        barcode: existing.barcode,
        status: existing.status,
      },
      after: {
        bookId: updated.bookId,
        barcode: updated.barcode,
        status: updated.status,
      },
    });

    return updated;
  }

  async archiveCopy(copyId: string, reason: string, actor: AuthContext) {
    const copy = await this.prisma.libraryCopy.findFirst({
      where: { id: copyId, tenantId: actor.tenantId },
    });

    if (!copy) {
      throw new NotFoundException('Library copy not found in this tenant');
    }

    if (copy.status === LibraryCopyStatus.ISSUED) {
      throw new ConflictException('Cannot archive an issued copy');
    }

    const updated = await this.prisma.libraryCopy.update({
      where: { id: copy.id },
      data: {
        status: LibraryCopyStatus.ARCHIVED,
        archivedAt: new Date(),
        archiveReason: reason,
      },
    });

    await this.auditService.record({
      action: 'archive',
      resource: 'library_copy',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.id,
      after: { barcode: updated.barcode, reason },
    });

    return updated;
  }

  async markCopyStatus(
    copyId: string,
    dto: MarkLibraryCopyStatusDto,
    actor: AuthContext,
  ) {
    const status = this.parseCopyStatus(dto.status);
    const copy = await this.prisma.libraryCopy.findFirst({
      where: { id: copyId, tenantId: actor.tenantId },
    });

    if (!copy) {
      throw new NotFoundException('Library copy not found in this tenant');
    }

    if (
      status === LibraryCopyStatus.LOST ||
      status === LibraryCopyStatus.DAMAGED
    ) {
      const activeIssue = await this.prisma.libraryIssue.findFirst({
        where: {
          tenantId: actor.tenantId,
          copyId: copy.id,
          status: LibraryIssueStatus.ISSUED,
        },
      });

      if (activeIssue) {
        throw new ConflictException(
          'Cannot mark an issued copy as lost or damaged. Return or mark the active issue first.',
        );
      }
    }

    const updated = await this.prisma.libraryCopy.update({
      where: { id: copy.id },
      data: { status },
      include: { book: true },
    });

    await this.auditService.record({
      action: 'mark_status',
      resource: 'library_copy',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.id,
      before: { status: copy.status },
      after: { status: updated.status, reason: dto.reason ?? null },
    });

    return updated;
  }

  async listIssues(actor: AuthContext, options: ListIssuesQuery = {}) {
    const { skip, take, page } = this.pagination(options);
    const where: Prisma.LibraryIssueWhereInput = {
      tenantId: actor.tenantId,
      ...(options.status
        ? { status: this.parseIssueStatus(options.status) }
        : {}),
      ...(options.studentId ? { borrowerStudentId: options.studentId } : {}),
      ...(options.staffId ? { borrowerStaffId: options.staffId } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.libraryIssue.findMany({
        where,
        include: {
          copy: { include: { book: true } },
          borrowerStudent: true,
          borrowerStaff: true,
          invoice: true,
        },
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take,
      }),
      this.prisma.libraryIssue.count({ where }),
    ]);

    return { items, meta: { page, limit: take, total } };
  }

  async issueCopy(dto: IssueLibraryCopyDto, actor: AuthContext) {
    if (!dto.borrowerStudentId && !dto.borrowerStaffId) {
      throw new BadRequestException('Student or staff borrower is required');
    }

    if (dto.borrowerStudentId && dto.borrowerStaffId) {
      throw new BadRequestException(
        'Choose either a student or staff borrower',
      );
    }

    const copy = await this.prisma.libraryCopy.findFirst({
      where: { id: dto.copyId, tenantId: actor.tenantId },
      include: { book: true },
    });

    if (!copy) {
      throw new NotFoundException('Library copy not found in this tenant');
    }

    if (copy.archivedAt) {
      throw new ConflictException('Cannot issue an archived library copy');
    }

    if (copy.status !== LibraryCopyStatus.AVAILABLE) {
      throw new ConflictException('Library copy is not available for issue');
    }

    await this.ensureBorrower(
      actor,
      dto.borrowerStudentId,
      dto.borrowerStaffId,
    );

    const issue = await this.prisma.$transaction(async (tx) => {
      const lockedCopy = await tx.libraryCopy.updateMany({
        where: {
          id: copy.id,
          tenantId: actor.tenantId,
          status: LibraryCopyStatus.AVAILABLE,
        },
        data: { status: LibraryCopyStatus.ISSUED },
      });

      if (lockedCopy.count !== 1) {
        throw new ConflictException('Library copy is not available for issue');
      }

      return tx.libraryIssue.create({
        data: {
          tenantId: actor.tenantId,
          copyId: copy.id,
          borrowerStudentId: dto.borrowerStudentId ?? null,
          borrowerStaffId: dto.borrowerStaffId ?? null,
          dueAt: new Date(dto.dueAt),
          notes: dto.notes ?? null,
        },
      });
    });

    await this.auditService.record({
      action: 'issue',
      resource: 'library_issue',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: issue.id,
      after: {
        copyId: copy.id,
        borrowerStudentId: issue.borrowerStudentId,
        borrowerStaffId: issue.borrowerStaffId,
        dueAt: issue.dueAt,
      },
    });

    return issue;
  }

  async returnCopy(
    issueId: string,
    dto: ReturnLibraryCopyDto,
    actor: AuthContext,
  ) {
    const issue = await this.prisma.libraryIssue.findFirst({
      where: { id: issueId, tenantId: actor.tenantId },
      include: { copy: { include: { book: true } }, borrowerStudent: true },
    });

    if (!issue) {
      throw new NotFoundException('Library issue not found in this tenant');
    }

    if (issue.status === LibraryIssueStatus.RETURNED) {
      throw new ConflictException('Library issue is already returned');
    }

    if (issue.status === LibraryIssueStatus.LOST) {
      throw new ConflictException('Lost library issue cannot be returned');
    }

    const status = dto.markLost
      ? LibraryIssueStatus.LOST
      : LibraryIssueStatus.RETURNED;
    const copyStatus = dto.markLost
      ? LibraryCopyStatus.LOST
      : dto.returnCondition?.toLowerCase().includes('damage')
        ? LibraryCopyStatus.DAMAGED
        : LibraryCopyStatus.AVAILABLE;

    let calculatedFine = 0;
    const now = new Date();
    if (now > issue.dueAt && !dto.markLost) {
      const daysOverdue = Math.ceil(
        (now.getTime() - issue.dueAt.getTime()) / (1000 * 60 * 60 * 24),
      );
      calculatedFine = daysOverdue * this.configService.libraryFinePerDay;
    }

    const fineAmount = new Prisma.Decimal(dto.fineAmount ?? calculatedFine);

    const updated = await this.prisma.$transaction(async (tx) => {
      const invoiceId =
        issue.borrowerStudentId && fineAmount.gt(0)
          ? await this.createLibraryFineInvoice(tx, {
              actor,
              studentId: issue.borrowerStudentId,
              amount: fineAmount,
              description: dto.markLost
                ? `Lost book charge: ${issue.copy.book.title}`
                : `Library fine: ${issue.copy.book.title}`,
            })
          : null;

      const activeIssue = await tx.libraryIssue.updateMany({
        where: {
          id: issue.id,
          tenantId: actor.tenantId,
          status: LibraryIssueStatus.ISSUED,
        },
        data: {
          status,
          returnedAt: new Date(),
          returnCondition: dto.returnCondition ?? null,
          fineAmount,
          invoiceId,
          notes: dto.notes ?? issue.notes,
        },
      });

      if (activeIssue.count !== 1) {
        throw new ConflictException('Library issue is already closed');
      }

      await tx.libraryCopy.update({
        where: { id: issue.copyId },
        data: { status: copyStatus },
      });

      return tx.libraryIssue.findUniqueOrThrow({
        where: { id: issue.id },
        include: {
          copy: { include: { book: true } },
          borrowerStudent: true,
          invoice: true,
        },
      });
    });

    await this.auditService.record({
      action: dto.markLost ? 'mark_lost' : 'return',
      resource: 'library_issue',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.id,
      after: {
        status: updated.status,
        fineAmount: updated.fineAmount,
        invoiceId: updated.invoiceId,
      },
    });

    return updated;
  }

  async listOverdue(actor: AuthContext, options: PaginationQuery = {}) {
    const { skip, take, page } = this.pagination(options);
    const where: Prisma.LibraryIssueWhereInput = {
      tenantId: actor.tenantId,
      status: LibraryIssueStatus.ISSUED,
      dueAt: { lt: new Date() },
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.libraryIssue.findMany({
        where,
        include: {
          copy: { include: { book: true } },
          borrowerStudent: true,
          borrowerStaff: true,
        },
        orderBy: [{ dueAt: 'asc' }],
        skip,
        take,
      }),
      this.prisma.libraryIssue.count({ where }),
    ]);

    return { items, meta: { page, limit: take, total } };
  }

  async sendOverdueReminders(actor: AuthContext) {
    const overdueResult = await this.listOverdue(actor, {
      page: '1',
      limit: '100',
    });
    const overdue = overdueResult.items;
    const studentIds = overdue
      .map((issue) => issue.borrowerStudentId)
      .filter((studentId): studentId is string => Boolean(studentId));

    if (studentIds.length === 0) {
      return { overdue: overdue.length, deliveryCount: 0 };
    }

    const delivery = await this.communicationsService.recordDeliveryRecords({
      actor,
      sourceType: 'library_overdue',
      sourceId: `library-overdue-${Date.now()}`,
      audienceType: AudienceType.ALL,
      studentIds: Array.from(new Set(studentIds)),
      title: 'Library book overdue',
      body: 'A borrowed library book is overdue. Please return it to the school library.',
      channels: [NotificationChannel.PUSH, NotificationChannel.SMS],
      requiredConsentTypes: [ConsentType.MESSAGING],
    });

    return { overdue: overdue.length, deliveryCount: delivery.count };
  }

  async getBorrowerInfo(actor: AuthContext, studentId: string) {
    const [activeIssues, overdueBooks] = await Promise.all([
      this.prisma.libraryIssue.count({
        where: {
          tenantId: actor.tenantId,
          borrowerStudentId: studentId,
          status: LibraryIssueStatus.ISSUED,
        },
      }),
      this.prisma.libraryIssue.count({
        where: {
          tenantId: actor.tenantId,
          borrowerStudentId: studentId,
          status: LibraryIssueStatus.ISSUED,
          dueAt: { lt: new Date() },
        },
      }),
    ]);

    return {
      activeIssues,
      overdueBooks,
      canBorrow: activeIssues < this.configService.libraryMaxBooksPerStudent,
    };
  }

  private async ensureBorrower(
    actor: AuthContext,
    borrowerStudentId?: string,
    borrowerStaffId?: string,
  ) {
    const [student, staff] = await Promise.all([
      borrowerStudentId
        ? this.prisma.student.findFirst({
            where: { id: borrowerStudentId, tenantId: actor.tenantId },
          })
        : Promise.resolve(null),
      borrowerStaffId
        ? this.prisma.staff.findFirst({
            where: { id: borrowerStaffId, tenantId: actor.tenantId },
          })
        : Promise.resolve(null),
    ]);

    if (borrowerStudentId && !student) {
      throw new NotFoundException('Borrower student not found in this tenant');
    }

    if (borrowerStaffId && !staff) {
      throw new NotFoundException('Borrower staff not found in this tenant');
    }
  }

  private async ensureUniqueIsbn(tenantId: string, isbn: string) {
    const existing = await this.prisma.libraryBook.findUnique({
      where: { tenantId_isbn: { tenantId, isbn } },
    });

    if (existing) {
      throw new ConflictException('Book ISBN already exists in this tenant');
    }
  }

  private async ensureUniqueBarcode(tenantId: string, barcode: string) {
    const existing = await this.prisma.libraryCopy.findUnique({
      where: { tenantId_barcode: { tenantId, barcode } },
    });

    if (existing) {
      throw new ConflictException('Copy barcode already exists in this tenant');
    }
  }

  private parseCopyStatus(status: string) {
    if (
      !Object.values(LibraryCopyStatus).includes(status as LibraryCopyStatus)
    ) {
      throw new BadRequestException(`Invalid library copy status: ${status}`);
    }

    return status as LibraryCopyStatus;
  }

  private parseIssueStatus(status: string) {
    if (
      !Object.values(LibraryIssueStatus).includes(status as LibraryIssueStatus)
    ) {
      throw new BadRequestException(`Invalid library issue status: ${status}`);
    }

    return status as LibraryIssueStatus;
  }

  private pagination(options: PaginationQuery) {
    const page = Math.max(Number(options.page ?? 1), 1);
    const requestedLimit = Math.max(Number(options.limit ?? 50), 1);
    const take = Math.min(requestedLimit, 100);

    return {
      page,
      take,
      skip: (page - 1) * take,
    };
  }

  private async createLibraryFineInvoice(
    tx: Prisma.TransactionClient,
    input: {
      actor: AuthContext;
      studentId: string;
      amount: Prisma.Decimal;
      description: string;
    },
  ) {
    const student = await tx.student.findFirst({
      where: { id: input.studentId, tenantId: input.actor.tenantId },
      include: { enrollments: { orderBy: [{ createdAt: 'desc' }], take: 1 } },
    });

    if (!student) {
      throw new NotFoundException('Student not found for library fine');
    }

    const academicYear =
      student.enrollments[0]?.academicYearId ??
      (
        await tx.academicYear.findFirst({
          where: { tenantId: input.actor.tenantId, isCurrent: true },
        })
      )?.id;

    if (!academicYear) {
      throw new NotFoundException(
        'Current academic year is required for fine invoice',
      );
    }

    const feeHead = await this.ensureLibraryFineFeeHead(
      tx,
      input.actor.tenantId,
    );
    const invoiceNumber = await this.generateInvoiceNumber(
      tx,
      input.actor.tenantId,
    );
    const invoice = await tx.invoice.create({
      data: {
        tenantId: input.actor.tenantId,
        studentId: input.studentId,
        academicYearId: academicYear,
        invoiceNumber,
        dueDate: new Date(),
        status: InvoiceStatus.ISSUED,
        subtotal: input.amount,
        vatAmount: new Prisma.Decimal(0),
        totalAmount: input.amount,
        lines: {
          create: {
            tenantId: input.actor.tenantId,
            feeHeadId: feeHead.id,
            description: input.description,
            unitAmount: input.amount,
            vatAmount: new Prisma.Decimal(0),
            totalAmount: input.amount,
          },
        },
      },
      include: {
        lines: { include: { feeHead: true } },
      },
    });

    await this.accountingPostingService.postInvoice(
      {
        tenantId: input.actor.tenantId,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        studentId: input.studentId,
        totalAmount: input.amount,
        entryDate: new Date(),
        lines: [
          {
            accountCode: '4040',
            accountName: 'Library Fine Income',
            accountType: ChartAccountType.REVENUE,
            amount: input.amount,
            description: input.description,
          },
        ],
      },
      input.actor,
      tx,
    );

    return invoice.id;
  }

  private async ensureLibraryFineFeeHead(
    tx: Prisma.TransactionClient,
    tenantId: string,
  ) {
    return tx.feeHead.upsert({
      where: { tenantId_code: { tenantId, code: 'LIBFINE' } },
      update: {},
      create: {
        tenantId,
        code: 'LIBFINE',
        name: 'Library Fine',
        frequency: FeeFrequency.ONE_TIME,
        defaultAmount: new Prisma.Decimal(0),
        vatApplicable: false,
      },
    });
  }

  private async generateInvoiceNumber(
    tx: Prisma.TransactionClient,
    tenantId: string,
  ) {
    const count = await tx.invoice.count({ where: { tenantId } });
    return `INV-${String(count + 1).padStart(6, '0')}`;
  }
}
