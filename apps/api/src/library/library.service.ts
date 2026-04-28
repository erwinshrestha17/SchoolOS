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
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { CommunicationsService } from '../communications/communications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLibraryBookDto } from './dto/create-library-book.dto';
import { CreateLibraryCopyDto } from './dto/create-library-copy.dto';
import { IssueLibraryCopyDto } from './dto/issue-library-copy.dto';
import { ReturnLibraryCopyDto } from './dto/return-library-copy.dto';

import { ConfigService } from '../config/config.service';

@Injectable()
export class LibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly communicationsService: CommunicationsService,
    private readonly configService: ConfigService,
  ) {}

  listBooks(actor: AuthContext, query?: string) {
    return this.prisma.libraryBook.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(query
          ? {
              OR: [
                { title: { contains: query, mode: 'insensitive' } },
                { author: { contains: query, mode: 'insensitive' } },
                { isbn: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { copies: true },
      orderBy: [{ title: 'asc' }],
      take: 100,
    });
  }

  async createBook(dto: CreateLibraryBookDto, actor: AuthContext) {
    if (dto.isbn) {
      const existing = await this.prisma.libraryBook.findUnique({
        where: { tenantId_isbn: { tenantId: actor.tenantId, isbn: dto.isbn } },
      });

      if (existing) {
        throw new ConflictException('Book ISBN already exists in this tenant');
      }
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

  listCopies(actor: AuthContext, bookId?: string) {
    return this.prisma.libraryCopy.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(bookId ? { bookId } : {}),
      },
      include: { book: true },
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
    });
  }

  async createCopy(dto: CreateLibraryCopyDto, actor: AuthContext) {
    const book = await this.prisma.libraryBook.findFirst({
      where: { id: dto.bookId, tenantId: actor.tenantId },
    });

    if (!book) {
      throw new NotFoundException('Book not found in this tenant');
    }

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

  listIssues(actor: AuthContext, status?: string) {
    return this.prisma.libraryIssue.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(status ? { status: status as LibraryIssueStatus } : {}),
      },
      include: {
        copy: { include: { book: true } },
        borrowerStudent: true,
        borrowerStaff: true,
        invoice: true,
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
    });
  }

  async issueCopy(dto: IssueLibraryCopyDto, actor: AuthContext) {
    if (!dto.borrowerStudentId && !dto.borrowerStaffId) {
      throw new BadRequestException('Student or staff borrower is required');
    }

    const copy = await this.prisma.libraryCopy.findFirst({
      where: { id: dto.copyId, tenantId: actor.tenantId },
      include: { book: true },
    });

    if (!copy) {
      throw new NotFoundException('Library copy not found in this tenant');
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
      const created = await tx.libraryIssue.create({
        data: {
          tenantId: actor.tenantId,
          copyId: copy.id,
          borrowerStudentId: dto.borrowerStudentId ?? null,
          borrowerStaffId: dto.borrowerStaffId ?? null,
          dueAt: new Date(dto.dueAt),
          notes: dto.notes ?? null,
        },
      });

      await tx.libraryCopy.update({
        where: { id: copy.id },
        data: { status: LibraryCopyStatus.ISSUED },
      });

      return created;
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

    const status = dto.markLost
      ? LibraryIssueStatus.LOST
      : LibraryIssueStatus.RETURNED;
    const copyStatus = dto.markLost
      ? LibraryCopyStatus.LOST
      : dto.returnCondition?.toLowerCase().includes('damage')
        ? LibraryCopyStatus.DAMAGED
        : LibraryCopyStatus.AVAILABLE;

    // Automated fine calculation
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
        issue.borrowerStudentId && fineAmount.greaterThan(0)
          ? await this.createLibraryFineInvoice(tx, {
              actor,
              studentId: issue.borrowerStudentId,
              amount: fineAmount,
              description: dto.markLost
                ? `Lost book charge: ${issue.copy.book.title}`
                : `Library fine: ${issue.copy.book.title}`,
            })
          : null;

      const returned = await tx.libraryIssue.update({
        where: { id: issue.id },
        data: {
          status,
          returnedAt: new Date(),
          returnCondition: dto.returnCondition ?? null,
          fineAmount,
          invoiceId,
          notes: dto.notes ?? issue.notes,
        },
        include: {
          copy: { include: { book: true } },
          borrowerStudent: true,
          invoice: true,
        },
      });

      await tx.libraryCopy.update({
        where: { id: issue.copyId },
        data: { status: copyStatus },
      });

      return returned;
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

  listOverdue(actor: AuthContext) {
    return this.prisma.libraryIssue.findMany({
      where: {
        tenantId: actor.tenantId,
        status: LibraryIssueStatus.ISSUED,
        dueAt: { lt: new Date() },
      },
      include: {
        copy: { include: { book: true } },
        borrowerStudent: true,
        borrowerStaff: true,
      },
      orderBy: [{ dueAt: 'asc' }],
    });
  }

  async sendOverdueReminders(actor: AuthContext) {
    const overdue = await this.listOverdue(actor);
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
    });

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
