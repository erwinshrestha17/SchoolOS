import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
import { FileRegistryService } from '../file-registry/file-registry.service';
import { PrismaService } from '../prisma/prisma.service';
import { isTeacherOnly } from '../common/security/parent-scope';
import {
  CreateLibraryFineDto,
  UpdateLibraryFineDto,
} from './dto/library-fine.dto';
import { StudentQrService } from '../students/student-qr.service';
import { StudentQrResolvePurpose } from '@schoolos/core';

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

@Injectable()
export class LibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly communicationsService: CommunicationsService,
    private readonly configService: ConfigService,
    private readonly accountingPostingService: AccountingPostingService,
    private readonly studentQrService: StudentQrService,
    private readonly fileRegistryService: FileRegistryService,
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

  async sendOverdueReminders(actor: AuthContext, sourceId?: string) {
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
      sourceId: sourceId ?? `library-overdue-${Date.now()}`,
      audienceType: AudienceType.ALL,
      studentIds: Array.from(new Set(studentIds)),
      title: 'Library book overdue',
      body: 'A borrowed library book is overdue. Please return it to the school library.',
      channels: [NotificationChannel.PUSH, NotificationChannel.SMS],
      requiredConsentTypes: [ConsentType.MESSAGING],
    });

    return { overdue: overdue.length, deliveryCount: delivery.count };
  }

  async getBorrowedStudents(actor: AuthContext, options: PaginationQuery = {}) {
    // Confirmed gap: unlike listIssuesScoped/listReservations, this had no
    // actor-scoping of any kind (not even the parent/student self-scoping
    // those have) -- a school-wide roster of every student currently holding
    // a book, gated only by the same `library:issues:read` a base Teacher
    // now holds. There's no meaningful "my own" reduction of a school-wide
    // roster, so it is simply hidden from a Teacher (spec M8: "no other
    // users' full borrowing history").
    if (isTeacherOnly(actor)) {
      throw new ForbiddenException(
        'This report is limited to librarians and school administrators',
      );
    }

    const { skip, take, page } = this.pagination(options);
    const where: Prisma.StudentWhereInput = {
      tenantId: actor.tenantId,
      libraryIssues: {
        some: {
          status: LibraryIssueStatus.ISSUED,
        },
      },
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.student.findMany({
        where,
        include: {
          libraryIssues: {
            where: { status: LibraryIssueStatus.ISSUED },
            include: { copy: { include: { book: true } } },
          },
          class: true,
          sectionRef: true,
        },
        orderBy: [{ firstNameEn: 'asc' }],
        skip,
        take,
      }),
      this.prisma.student.count({ where }),
    ]);

    return { items, meta: { page, limit: take, total } };
  }

  async listFines(actor: AuthContext, options: PaginationQuery = {}) {
    const { skip, take, page } = this.pagination(options);
    const where: Prisma.LibraryFineWhereInput = {
      tenantId: actor.tenantId,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.libraryFine.findMany({
        where,
        include: {
          issue: {
            include: {
              copy: { include: { book: true } },
              borrowerStudent: true,
              borrowerStaff: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take,
      }),
      this.prisma.libraryFine.count({ where }),
    ]);

    return { items, meta: { page, limit: take, total } };
  }

  async createFine(actor: AuthContext, dto: CreateLibraryFineDto) {
    const issue = await this.prisma.libraryIssue.findFirst({
      where: { id: dto.issueId, tenantId: actor.tenantId },
    });

    if (!issue) {
      throw new NotFoundException('Library issue not found');
    }

    const amount = new Prisma.Decimal(dto.amount);
    const existing = await this.prisma.libraryFine.findFirst({
      where: {
        tenantId: actor.tenantId,
        issueId: dto.issueId,
        amount,
        status: {
          in: ['PENDING', 'POSTED_TO_FEES'],
        },
      },
    });

    if (existing) {
      return existing;
    }

    const fine = await this.prisma.libraryFine.create({
      data: {
        tenantId: actor.tenantId,
        issueId: dto.issueId,
        amount,
        status: 'PENDING',
        notes: dto.notes ?? null,
      },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'library_fine',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: fine.id,
      after: fine,
    });

    return fine;
  }

  async postFineToFees(actor: AuthContext, fineId: string, reason: string) {
    if (!reason.trim()) {
      throw new BadRequestException('Reason is required to post fine to fees');
    }

    const fine = await this.prisma.libraryFine.findFirst({
      where: { id: fineId, tenantId: actor.tenantId },
      include: {
        issue: {
          include: {
            copy: { include: { book: true } },
            borrowerStudent: true,
          },
        },
      },
    });

    if (!fine) {
      throw new NotFoundException('Library fine not found');
    }

    if (!fine.issue.borrowerStudentId) {
      throw new ConflictException(
        'Only student library fines can post to fees',
      );
    }

    if (fine.feeInvoiceId || fine.issue.invoiceId) {
      return {
        ...fine,
        feeInvoiceId: fine.feeInvoiceId ?? fine.issue.invoiceId,
        alreadyPosted: true,
      };
    }

    if (fine.status === 'WAIVED') {
      throw new ConflictException('Waived library fines cannot post to fees');
    }

    const posted = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.libraryFine.findFirst({
        where: {
          id: fine.id,
          tenantId: actor.tenantId,
          feeInvoiceId: null,
          status: 'PENDING',
        },
        include: {
          issue: {
            include: {
              copy: { include: { book: true } },
            },
          },
        },
      });

      if (!locked?.issue.borrowerStudentId) {
        throw new ConflictException('Library fine is already posted or closed');
      }

      const invoiceId = await this.createLibraryFineInvoice(tx, {
        actor,
        studentId: locked.issue.borrowerStudentId,
        amount: locked.amount,
        description: `Library fine: ${locked.issue.copy.book.title}`,
      });

      await tx.libraryIssue.update({
        where: { id: locked.issueId },
        data: { invoiceId },
      });

      return tx.libraryFine.update({
        where: { id: locked.id },
        data: {
          status: 'POSTED_TO_FEES',
          feeInvoiceId: invoiceId,
          feePostedAt: new Date(),
          notes: locked.notes
            ? `${locked.notes}\nPosted to fees: ${reason.trim()}`
            : `Posted to fees: ${reason.trim()}`,
        },
        include: {
          issue: {
            include: {
              copy: { include: { book: true } },
              borrowerStudent: true,
              borrowerStaff: true,
              invoice: true,
            },
          },
        },
      });
    });

    await this.auditService.record({
      action: 'post_to_fees',
      resource: 'library_fine',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: posted.id,
      after: {
        fineId: posted.id,
        issueId: posted.issueId,
        feeInvoiceId: posted.feeInvoiceId,
        reason: reason.trim(),
      },
    });

    return posted;
  }

  async updateFine(
    actor: AuthContext,
    fineId: string,
    dto: UpdateLibraryFineDto,
  ) {
    const existing = await this.prisma.libraryFine.findFirst({
      where: { id: fineId, tenantId: actor.tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Library fine not found');
    }

    if (
      (dto.status === 'WAIVED' || dto.waivedAmount !== undefined) &&
      !dto.waiverReason?.trim()
    ) {
      throw new BadRequestException('Reason is required to waive a fine');
    }

    if (dto.correctionReason !== undefined && !dto.correctionReason.trim()) {
      throw new BadRequestException('Reason is required to correct a fine');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.libraryFine.update({
        where: { id: fineId },
        data: {
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.waivedAmount !== undefined
            ? { waivedAmount: new Prisma.Decimal(dto.waivedAmount) }
            : {}),
          ...(dto.waiverReason !== undefined
            ? { waiverReason: dto.waiverReason }
            : {}),
          ...(dto.correctionReason !== undefined
            ? { correctionReason: dto.correctionReason }
            : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        },
        include: { issue: true },
      });

      if (
        u.status === 'WAIVED' &&
        u.waivedAmount.gt(0) &&
        (u.feeInvoiceId || u.issue.invoiceId) &&
        u.issue.borrowerStudentId
      ) {
        const waiver = await tx.feeWaiver.create({
          data: {
            tenantId: actor.tenantId,
            studentId: u.issue.borrowerStudentId,
            invoiceId: u.feeInvoiceId ?? u.issue.invoiceId,
            amount: u.waivedAmount,
            reason: u.waiverReason ?? 'Library fine waiver',
            approvedById: actor.userId,
            status: 'APPROVED',
          },
        });

        await this.accountingPostingService.postFeeWaiver(
          {
            tenantId: actor.tenantId,
            waiverId: waiver.id,
            studentId: waiver.studentId,
            invoiceId: waiver.invoiceId,
            amount: waiver.amount,
            reason: waiver.reason,
          },
          actor,
          tx,
        );
      }
      return u;
    });

    await this.auditService.record({
      action: 'update',
      resource: 'library_fine',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.id,
      before: existing,
      after: updated,
    });

    return updated;
  }

  async getBookHistory(actor: AuthContext, bookId: string) {
    const book = await this.prisma.libraryBook.findFirst({
      where: { id: bookId, tenantId: actor.tenantId },
    });

    if (!book) throw new NotFoundException('Book not found');

    const issues = await this.prisma.libraryIssue.findMany({
      where: {
        tenantId: actor.tenantId,
        copy: { bookId },
      },
      include: {
        copy: true,
        borrowerStudent: true,
        borrowerStaff: true,
      },
      orderBy: { issuedAt: 'desc' },
      take: 100,
    });

    return { book, history: issues };
  }

  async getCopyHistory(actor: AuthContext, copyId: string) {
    const copy = await this.prisma.libraryCopy.findFirst({
      where: { id: copyId, tenantId: actor.tenantId },
      include: { book: true },
    });

    if (!copy) throw new NotFoundException('Copy not found');

    const issues = await this.prisma.libraryIssue.findMany({
      where: {
        tenantId: actor.tenantId,
        copyId,
      },
      include: {
        borrowerStudent: true,
        borrowerStaff: true,
      },
      orderBy: { issuedAt: 'desc' },
      take: 100,
    });

    return { copy, history: issues };
  }

  async resolveQrBorrower(actor: AuthContext, token: string) {
    return this.studentQrService.resolveQr(
      actor.tenantId,
      token,
      StudentQrResolvePurpose.LIBRARY,
      actor,
    );
  }

  private parseCopyStatus(status: string) {
    if (
      !Object.values(LibraryCopyStatus).includes(status as LibraryCopyStatus)
    ) {
      throw new BadRequestException(`Invalid library copy status: ${status}`);
    }

    return status as LibraryCopyStatus;
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
