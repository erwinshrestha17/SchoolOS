import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, LibraryCopyStatus, LibraryIssueStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { LibraryService } from './library.service';
import { ArchiveLibraryBookDto } from './dto/archive-library-book.dto';

@Injectable()
export class LibraryHardeningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly libraryService: LibraryService,
  ) {}

  async archiveBook(bookId: string, dto: ArchiveLibraryBookDto, actor: AuthContext) {
    const book = await this.prisma.libraryBook.findFirst({
      where: { id: bookId, tenantId: actor.tenantId },
      include: { copies: true },
    });

    if (!book) {
      throw new NotFoundException('Library book not found in this tenant');
    }

    const activeCopyCount = book.copies.filter(
      (copy) => copy.status === LibraryCopyStatus.ISSUED,
    ).length;

    if (activeCopyCount > 0) {
      throw new NotFoundException(
        'Book cannot be archived while issued copies exist',
      );
    }

    const [updated] = await this.prisma.$queryRaw<
      Array<{ id: string; archivedAt: Date | null; archiveReason: string | null }>
    >(
      Prisma.sql`
        UPDATE "LibraryBook"
        SET "archivedAt" = now(), "archiveReason" = ${dto.reason}
        WHERE "id" = ${book.id}
          AND "tenantId" = ${actor.tenantId}
        RETURNING "id", "archivedAt", "archiveReason"
      `,
    );

    await this.auditService.record({
      action: 'archive',
      resource: 'library_book',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: book.id,
      before: { title: book.title },
      after: { archivedAt: updated.archivedAt, reason: dto.reason },
    });

    return updated;
  }

  async getIssuedBooksReport(actor: AuthContext, options: { page?: string; limit?: string } = {}) {
    return this.libraryService.listIssues(actor, {
      status: LibraryIssueStatus.ISSUED,
      page: options.page,
      limit: options.limit,
    });
  }

  async getOverdueBooksReport(actor: AuthContext) {
    const items = await this.libraryService.listOverdue(actor);
    return {
      items,
      meta: { total: items.length },
    };
  }

  async getLostDamagedReport(actor: AuthContext) {
    const items = await this.prisma.libraryCopy.findMany({
      where: {
        tenantId: actor.tenantId,
        status: { in: [LibraryCopyStatus.LOST, LibraryCopyStatus.DAMAGED] },
      },
      include: { book: true },
      orderBy: [{ updatedAt: 'desc' }],
      take: 500,
    });

    return { items, meta: { total: items.length } };
  }

  async getFineSummary(actor: AuthContext) {
    const rows = await this.prisma.libraryIssue.findMany({
      where: {
        tenantId: actor.tenantId,
        fineAmount: { gt: new Prisma.Decimal(0) },
      },
      include: {
        copy: { include: { book: true } },
        borrowerStudent: true,
        invoice: true,
      },
      orderBy: [{ returnedAt: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    });

    const totalFine = rows.reduce(
      (sum, row) => sum.add(row.fineAmount ?? new Prisma.Decimal(0)),
      new Prisma.Decimal(0),
    );

    return {
      items: rows,
      summary: {
        totalIssuesWithFine: rows.length,
        totalFine: totalFine.toString(),
      },
    };
  }

  async getBorrowerHistory(
    actor: AuthContext,
    input: { studentId?: string; staffId?: string; page?: string; limit?: string },
  ) {
    return this.libraryService.listIssues(actor, {
      studentId: input.studentId,
      staffId: input.staffId,
      page: input.page,
      limit: input.limit,
    });
  }

  async exportIssuedBooksCsv(actor: AuthContext) {
    const report = await this.libraryService.listIssues(actor, {
      status: LibraryIssueStatus.ISSUED,
      page: '1',
      limit: '100',
    });

    const rows = [
      ['Issue ID', 'Book Title', 'Barcode', 'Borrower', 'Issued At', 'Due At', 'Status'],
      ...report.items.map((issue) => [
        issue.id,
        issue.copy.book.title,
        issue.copy.barcode,
        issue.borrowerStudent
          ? `${issue.borrowerStudent.firstNameEn} ${issue.borrowerStudent.lastNameEn}`
          : issue.borrowerStaff
            ? `${issue.borrowerStaff.firstName} ${issue.borrowerStaff.lastName}`
            : '',
        issue.issuedAt.toISOString(),
        issue.dueAt.toISOString(),
        issue.status,
      ]),
    ];

    await this.auditService.record({
      action: 'export',
      resource: 'library_issued_books_report',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: { rowCount: report.items.length },
    });

    return rows.map((row) => row.map(csvEscape).join(',')).join('\n');
  }

  async sendOverdueRemindersIdempotent(actor: AuthContext) {
    const windowKey = new Date().toISOString().slice(0, 10);
    const sourceId = `library-overdue-${actor.tenantId}-${windowKey}`;

    const existing = await this.prisma.notificationDeliveryRecord.count({
      where: {
        tenantId: actor.tenantId,
        sourceType: 'library_overdue',
        sourceId,
      },
    });

    if (existing > 0) {
      return { skipped: true, sourceId, deliveryCount: existing };
    }

    const result = await this.libraryService.sendOverdueReminders(actor);

    await this.auditService.record({
      action: 'send_overdue_reminders',
      resource: 'library_overdue',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: sourceId,
      after: result,
    });

    return { ...result, skipped: false, sourceId };
  }
}

function csvEscape(value: unknown) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}
