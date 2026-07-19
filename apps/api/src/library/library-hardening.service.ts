import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  LibraryCopyStatus,
  LibraryFineStatus,
  LibraryIssueStatus,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import {
  getParentStudentIds,
  getStudentOwnId,
  getTeacherStaffOwnId,
} from '../common/security/parent-scope';
import { PrismaService } from '../prisma/prisma.service';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { ArchiveLibraryBookDto } from './dto/archive-library-book.dto';
import { CreateLibraryBookDto } from './dto/create-library-book.dto';
import { CreateLibraryCopyDto } from './dto/create-library-copy.dto';
import { CreateLibraryReservationDto } from './dto/library-reservation.dto';
import { IssueLibraryCopyDto } from './dto/issue-library-copy.dto';
import { MarkLibraryCopyStatusDto } from './dto/mark-library-copy-status.dto';
import { ReturnLibraryCopyDto } from './dto/return-library-copy.dto';
import {
  ScannerIssueLibraryCopyDto,
  ScannerReturnLibraryCopyDto,
} from './dto/scanner-library.dto';
import { UpdateLibraryBookDto } from './dto/update-library-book.dto';
import { UpdateLibraryCopyDto } from './dto/update-library-copy.dto';
import { UpdateLibrarySettingDto } from './dto/update-library-setting.dto';
import { LibraryService } from './library.service';

interface PaginationQuery {
  page?: string;
  limit?: string;
}

interface ListIssuesQuery extends PaginationQuery {
  status?: string;
  studentId?: string;
  staffId?: string;
}

interface LibraryPolicySettings {
  finePerDay: Prisma.Decimal;
  maxFineAmount: Prisma.Decimal | null;
  gracePeriodDays: number;
  lostBookChargeMultiplier: Prisma.Decimal;
  maxBooksPerStudent: number;
  maxBooksPerStaff: number;
  studentLoanDays: number;
  staffLoanDays: number;
  includeHolidaysInFine: boolean;
  reservationHoldDays: number;
}

interface BorrowerIdentity {
  borrowerStudentId?: string | null;
  borrowerStaffId?: string | null;
}

@Injectable()
export class LibraryHardeningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly libraryService: LibraryService,
    @Optional()
    private readonly fileRegistryService?: FileRegistryService,
  ) {}

  async createBook(dto: CreateLibraryBookDto, actor: AuthContext) {
    if (dto.isbn) await this.ensureUniqueIsbn(actor.tenantId, dto.isbn);

    const book = await this.prisma.libraryBook.create({
      data: {
        tenantId: actor.tenantId,
        title: dto.title,
        subtitle: dto.subtitle ?? null,
        author: dto.author,
        isbn: dto.isbn ?? null,
        publisher: dto.publisher ?? null,
        publishedYear: dto.publishedYear ?? null,
        edition: dto.edition ?? null,
        language: dto.language ?? null,
        deweyDecimal: dto.deweyDecimal ?? null,
        materialType: dto.materialType ?? null,
        subjectCategory: dto.subjectCategory ?? null,
        classLevel: dto.classLevel ?? null,
        keywords: dto.keywords ?? Prisma.JsonNull,
        description: dto.description ?? null,
        coverImageUrl: dto.coverImageUrl ?? null,
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
    if (!existing) throw new NotFoundException('Book not found in this tenant');

    if (dto.isbn && dto.isbn !== existing.isbn) {
      await this.ensureUniqueIsbn(actor.tenantId, dto.isbn);
    }

    const updated = await this.prisma.libraryBook.update({
      where: { id: existing.id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.subtitle !== undefined ? { subtitle: dto.subtitle } : {}),
        ...(dto.author !== undefined ? { author: dto.author } : {}),
        ...(dto.isbn !== undefined ? { isbn: dto.isbn } : {}),
        ...(dto.publisher !== undefined ? { publisher: dto.publisher } : {}),
        ...(dto.publishedYear !== undefined
          ? { publishedYear: dto.publishedYear }
          : {}),
        ...(dto.edition !== undefined ? { edition: dto.edition } : {}),
        ...(dto.language !== undefined ? { language: dto.language } : {}),
        ...(dto.deweyDecimal !== undefined
          ? { deweyDecimal: dto.deweyDecimal }
          : {}),
        ...(dto.materialType !== undefined
          ? { materialType: dto.materialType }
          : {}),
        ...(dto.subjectCategory !== undefined
          ? { subjectCategory: dto.subjectCategory }
          : {}),
        ...(dto.classLevel !== undefined ? { classLevel: dto.classLevel } : {}),
        ...(dto.keywords !== undefined
          ? { keywords: dto.keywords ?? Prisma.JsonNull }
          : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.coverImageUrl !== undefined
          ? { coverImageUrl: dto.coverImageUrl }
          : {}),
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

  async archiveBook(
    bookId: string,
    dto: ArchiveLibraryBookDto,
    actor: AuthContext,
  ) {
    const reason = dto.reason?.trim();
    if (!reason) throw new BadRequestException('Archive reason is required');

    const book = await this.prisma.libraryBook.findFirst({
      where: { id: bookId, tenantId: actor.tenantId },
      include: { copies: true },
    });
    if (!book) throw new NotFoundException('Book not found in this tenant');

    const issuedCopies = book.copies.filter(
      (copy) => copy.status === LibraryCopyStatus.ISSUED,
    );
    if (issuedCopies.length > 0) {
      throw new ConflictException('Cannot archive book with issued copies');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const copyRows = book.copies.map((copy) => ({
        tenantId: actor.tenantId,
        copyId: copy.id,
        eventType: 'ARCHIVED_WITH_BOOK',
        statusBefore: copy.status,
        statusAfter: LibraryCopyStatus.ARCHIVED,
        reason,
        actorUserId: actor.userId,
        metadata: { bookId: book.id },
      }));

      if (copyRows.length > 0) {
        await tx.libraryCopyHistory.createMany({ data: copyRows });
      }

      await tx.libraryReservation.updateMany({
        where: { tenantId: actor.tenantId, bookId: book.id, status: 'ACTIVE' },
        data: {
          status: 'CANCELLED',
          notes: `Cancelled because book was archived: ${reason}`,
        },
      });

      await tx.libraryCopy.updateMany({
        where: { bookId: book.id, tenantId: actor.tenantId },
        data: {
          status: LibraryCopyStatus.ARCHIVED,
          archivedAt: now,
          archiveReason: reason,
        },
      });

      return tx.libraryBook.update({
        where: { id: book.id },
        data: { archivedAt: now, archiveReason: reason },
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

  async createCopy(dto: CreateLibraryCopyDto, actor: AuthContext) {
    const book = await this.prisma.libraryBook.findFirst({
      where: { id: dto.bookId, tenantId: actor.tenantId, archivedAt: null },
    });
    if (!book) throw new NotFoundException('Book not found in this tenant');

    await this.ensureUniqueBarcode(actor.tenantId, dto.barcode);
    if (dto.qrCode) await this.ensureUniqueQrCode(actor.tenantId, dto.qrCode);

    const copy = await this.prisma.libraryCopy.create({
      data: {
        tenantId: actor.tenantId,
        bookId: book.id,
        barcode: dto.barcode,
        qrCode: dto.qrCode ?? dto.barcode,
        shelfLocation: dto.shelfLocation ?? null,
        acquisitionSource: dto.acquisitionSource ?? null,
        conditionNote: dto.conditionNote ?? null,
        replacementCost:
          dto.replacementCost === undefined
            ? null
            : new Prisma.Decimal(dto.replacementCost),
        purchasedAt: dto.purchasedAt ? new Date(dto.purchasedAt) : null,
        lastInventoryAt: dto.lastInventoryAt
          ? new Date(dto.lastInventoryAt)
          : null,
      },
      include: { book: true },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'library_copy',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: copy.id,
      after: {
        bookId: copy.bookId,
        barcode: copy.barcode,
        qrCode: copy.qrCode,
      },
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

    if (existing.archivedAt) {
      throw new ConflictException('Cannot update an archived library copy');
    }

    if (dto.bookId && dto.bookId !== existing.bookId) {
      const book = await this.prisma.libraryBook.findFirst({
        where: { id: dto.bookId, tenantId: actor.tenantId, archivedAt: null },
      });
      if (!book) throw new NotFoundException('Book not found in this tenant');
    }

    if (dto.barcode && dto.barcode !== existing.barcode) {
      await this.ensureUniqueBarcode(actor.tenantId, dto.barcode);
    }
    if (dto.qrCode && dto.qrCode !== existing.qrCode) {
      await this.ensureUniqueQrCode(actor.tenantId, dto.qrCode);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const copy = await tx.libraryCopy.update({
        where: { id: existing.id },
        data: {
          ...(dto.bookId !== undefined ? { bookId: dto.bookId } : {}),
          ...(dto.barcode !== undefined ? { barcode: dto.barcode } : {}),
          ...(dto.qrCode !== undefined ? { qrCode: dto.qrCode } : {}),
          ...(dto.shelfLocation !== undefined
            ? { shelfLocation: dto.shelfLocation }
            : {}),
          ...(dto.acquisitionSource !== undefined
            ? { acquisitionSource: dto.acquisitionSource }
            : {}),
          ...(dto.conditionNote !== undefined
            ? { conditionNote: dto.conditionNote }
            : {}),
          ...(dto.replacementCost !== undefined
            ? { replacementCost: new Prisma.Decimal(dto.replacementCost) }
            : {}),
          ...(dto.purchasedAt !== undefined
            ? {
                purchasedAt: dto.purchasedAt ? new Date(dto.purchasedAt) : null,
              }
            : {}),
          ...(dto.lastInventoryAt !== undefined
            ? {
                lastInventoryAt: dto.lastInventoryAt
                  ? new Date(dto.lastInventoryAt)
                  : null,
              }
            : {}),
        },
        include: { book: true },
      });

      await this.recordCopyHistory(tx, {
        actor,
        copyId: copy.id,
        eventType: 'UPDATED',
        statusBefore: existing.status,
        statusAfter: copy.status,
        reason: 'Copy metadata updated',
        metadata: {
          beforeBarcode: existing.barcode,
          afterBarcode: copy.barcode,
        },
      });

      return copy;
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
    const archiveReason = reason?.trim();
    if (!archiveReason)
      throw new BadRequestException('Archive reason is required');

    const copy = await this.prisma.libraryCopy.findFirst({
      where: { id: copyId, tenantId: actor.tenantId },
    });
    if (!copy)
      throw new NotFoundException('Library copy not found in this tenant');
    if (copy.status === LibraryCopyStatus.ISSUED) {
      throw new ConflictException('Cannot archive an issued copy');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.libraryReservation.updateMany({
        where: { tenantId: actor.tenantId, copyId: copy.id, status: 'ACTIVE' },
        data: {
          status: 'CANCELLED',
          notes: `Cancelled because copy was archived: ${archiveReason}`,
        },
      });

      const archived = await tx.libraryCopy.update({
        where: { id: copy.id },
        data: {
          status: LibraryCopyStatus.ARCHIVED,
          archivedAt: new Date(),
          archiveReason,
        },
      });

      await this.recordCopyHistory(tx, {
        actor,
        copyId: copy.id,
        eventType: 'ARCHIVED',
        statusBefore: copy.status,
        statusAfter: LibraryCopyStatus.ARCHIVED,
        reason: archiveReason,
      });

      return archived;
    });

    await this.auditService.record({
      action: 'archive',
      resource: 'library_copy',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.id,
      after: { barcode: updated.barcode, reason: archiveReason },
    });

    return updated;
  }

  async deleteCopy(copyId: string, reason: string, actor: AuthContext) {
    const copy = await this.prisma.libraryCopy.findFirst({
      where: { id: copyId, tenantId: actor.tenantId },
      include: { _count: { select: { issues: true, history: true } } },
    });
    if (!copy)
      throw new NotFoundException('Library copy not found in this tenant');

    if (copy._count.issues > 0 || copy._count.history > 0) {
      return this.archiveCopy(copyId, reason, actor);
    }

    await this.prisma.libraryCopy.delete({ where: { id: copy.id } });
    await this.auditService.record({
      action: 'delete',
      resource: 'library_copy',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: copy.id,
      before: { barcode: copy.barcode, reason },
    });
    return { deleted: true, id: copy.id };
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
    if (!copy)
      throw new NotFoundException('Library copy not found in this tenant');

    if ([LibraryCopyStatus.LOST, LibraryCopyStatus.DAMAGED].includes(status)) {
      if (!dto.reason?.trim()) {
        throw new BadRequestException(
          'Reason is required when marking a library copy lost or damaged',
        );
      }

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

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.libraryCopy.update({
        where: { id: copy.id },
        data: { status },
        include: { book: true },
      });

      await this.recordCopyHistory(tx, {
        actor,
        copyId: copy.id,
        eventType: 'STATUS_CHANGED',
        statusBefore: copy.status,
        statusAfter: status,
        reason: dto.reason?.trim() ?? null,
      });

      return next;
    });

    await this.auditService.record({
      action: 'mark_status',
      resource: 'library_copy',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.id,
      before: { status: copy.status },
      after: { status: updated.status, reason: dto.reason?.trim() ?? null },
    });

    return updated;
  }

  async listIssuesScoped(actor: AuthContext, options: ListIssuesQuery = {}) {
    const { skip, take, page } = this.pagination(options);
    const where = await this.buildScopedIssueWhere(actor, options);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.libraryIssue.findMany({
        where,
        include: {
          copy: { include: { book: true } },
          borrowerStudent: true,
          borrowerStaff: true,
          invoice: true,
          fines: true,
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
    this.assertOneBorrower(dto);
    const borrower = {
      borrowerStudentId: dto.borrowerStudentId ?? null,
      borrowerStaffId: dto.borrowerStaffId ?? null,
    };

    const [copy, settings] = await Promise.all([
      this.prisma.libraryCopy.findFirst({
        where: { id: dto.copyId, tenantId: actor.tenantId },
        include: { book: true },
      }),
      this.getLibrarySettings(actor),
    ]);

    if (!copy)
      throw new NotFoundException('Library copy not found in this tenant');
    if (copy.archivedAt)
      throw new ConflictException('Cannot issue an archived library copy');
    if (copy.status !== LibraryCopyStatus.AVAILABLE) {
      throw new ConflictException('Library copy is not available for issue');
    }

    await this.ensureBorrower(actor, borrower);
    await this.enforceBorrowerPolicy(actor, borrower, settings);
    await this.ensureReservationAllowsIssue(actor, copy, borrower);

    const issuedAt = new Date();
    const loanDays = borrower.borrowerStaffId
      ? settings.staffLoanDays
      : settings.studentLoanDays;
    const dueAt = dto.dueAt ? new Date(dto.dueAt) : addDays(issuedAt, loanDays);

    if (Number.isNaN(dueAt.getTime()) || dueAt <= issuedAt) {
      throw new BadRequestException('Due date must be in the future');
    }

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

      const created = await tx.libraryIssue.create({
        data: {
          tenantId: actor.tenantId,
          copyId: copy.id,
          borrowerStudentId: borrower.borrowerStudentId,
          borrowerStaffId: borrower.borrowerStaffId,
          issuedAt,
          dueAt,
          notes: dto.notes ?? null,
        },
      });

      await tx.libraryReservation.updateMany({
        where: {
          tenantId: actor.tenantId,
          status: 'ACTIVE',
          bookId: copy.bookId,
          OR: [{ copyId: null }, { copyId: copy.id }],
          ...(borrower.borrowerStudentId
            ? { borrowerStudentId: borrower.borrowerStudentId }
            : { borrowerStaffId: borrower.borrowerStaffId }),
        },
        data: { status: 'FULFILLED', fulfilledIssueId: created.id },
      });

      await this.recordCopyHistory(tx, {
        actor,
        copyId: copy.id,
        eventType: 'ISSUED',
        statusBefore: copy.status,
        statusAfter: LibraryCopyStatus.ISSUED,
        reason: dto.notes ?? null,
        metadata: { issueId: created.id, dueAt: dueAt.toISOString() },
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

  async issueCopyByScanner(
    dto: ScannerIssueLibraryCopyDto,
    actor: AuthContext,
  ) {
    const copy = await this.resolveCopyByScanCode(actor, dto.code);
    return this.issueCopy({ ...dto, copyId: copy.id }, actor);
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
    if (!issue)
      throw new NotFoundException('Library issue not found in this tenant');
    if (issue.status === LibraryIssueStatus.RETURNED) {
      throw new ConflictException('Library issue is already returned');
    }
    if (issue.status === LibraryIssueStatus.LOST) {
      throw new ConflictException('Lost library issue cannot be returned');
    }

    const settings = await this.getLibrarySettings(actor);
    const returnedAt = new Date();
    const status = dto.markLost
      ? LibraryIssueStatus.LOST
      : LibraryIssueStatus.RETURNED;
    const copyStatus = dto.markLost
      ? LibraryCopyStatus.LOST
      : dto.returnCondition?.toLowerCase().includes('damage')
        ? LibraryCopyStatus.DAMAGED
        : LibraryCopyStatus.AVAILABLE;

    const calculatedFine = await this.calculateFineAmount(
      issue,
      returnedAt,
      settings,
      Boolean(dto.markLost),
    );
    const fineAmount = new Prisma.Decimal(dto.fineAmount ?? calculatedFine);
    const fineKey = `${actor.tenantId}:${issue.id}:${status}:${fineAmount.toString()}`;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (fineAmount.gt(0)) {
        const existingFine = await tx.libraryFine.findFirst({
          where: {
            tenantId: actor.tenantId,
            issueId: issue.id,
            amount: fineAmount,
            status: {
              in: [LibraryFineStatus.PENDING, LibraryFineStatus.POSTED_TO_FEES],
            },
          },
        });

        if (!existingFine) {
          await tx.libraryFine.create({
            data: {
              tenantId: actor.tenantId,
              issueId: issue.id,
              amount: fineAmount,
              status: LibraryFineStatus.PENDING,
              notes: dto.notes ?? fineKey,
            },
          });
        }
      }

      const activeIssue = await tx.libraryIssue.updateMany({
        where: {
          id: issue.id,
          tenantId: actor.tenantId,
          status: LibraryIssueStatus.ISSUED,
        },
        data: {
          status,
          returnedAt,
          returnCondition: dto.returnCondition ?? null,
          fineAmount,
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

      await this.recordCopyHistory(tx, {
        actor,
        copyId: issue.copyId,
        eventType: dto.markLost ? 'LOST_ON_RETURN' : 'RETURNED',
        statusBefore: issue.copy.status,
        statusAfter: copyStatus,
        reason: dto.notes ?? dto.returnCondition ?? null,
        metadata: { issueId: issue.id, fineAmount: fineAmount.toString() },
      });

      return tx.libraryIssue.findUniqueOrThrow({
        where: { id: issue.id },
        include: {
          copy: { include: { book: true } },
          borrowerStudent: true,
          borrowerStaff: true,
          invoice: true,
          fines: true,
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

  async returnCopyByScanner(
    dto: ScannerReturnLibraryCopyDto,
    actor: AuthContext,
  ) {
    const copy = await this.resolveCopyByScanCode(actor, dto.code);
    const issue = await this.prisma.libraryIssue.findFirst({
      where: {
        tenantId: actor.tenantId,
        copyId: copy.id,
        status: LibraryIssueStatus.ISSUED,
      },
    });
    if (!issue)
      throw new NotFoundException('No active issue found for scanned copy');

    return this.returnCopy(issue.id, dto, actor);
  }

  async resolveCopyByScanCode(actor: AuthContext, code: string) {
    const value = code?.trim();
    if (!value) throw new BadRequestException('Scanner code is required');

    const copy = await this.prisma.libraryCopy.findFirst({
      where: {
        tenantId: actor.tenantId,
        archivedAt: null,
        OR: [{ barcode: value }, { qrCode: value }],
      },
      include: { book: true },
    });

    if (!copy)
      throw new NotFoundException('No library copy found for scanned code');
    return copy;
  }

  async createReservation(
    dto: CreateLibraryReservationDto,
    actor: AuthContext,
  ) {
    this.assertOneBorrower(dto);
    const borrower = {
      borrowerStudentId: dto.borrowerStudentId ?? null,
      borrowerStaffId: dto.borrowerStaffId ?? null,
    };
    await this.ensureBorrower(actor, borrower);

    const settings = await this.getLibrarySettings(actor);
    const book = await this.prisma.libraryBook.findFirst({
      where: { id: dto.bookId, tenantId: actor.tenantId, archivedAt: null },
    });
    if (!book) throw new NotFoundException('Book not found in this tenant');

    if (dto.copyId) {
      const copy = await this.prisma.libraryCopy.findFirst({
        where: {
          id: dto.copyId,
          tenantId: actor.tenantId,
          bookId: dto.bookId,
          archivedAt: null,
        },
      });
      if (!copy)
        throw new NotFoundException('Library copy not found for this book');
    }

    const existing = await this.prisma.libraryReservation.findFirst({
      where: {
        tenantId: actor.tenantId,
        bookId: dto.bookId,
        status: 'ACTIVE',
        ...(borrower.borrowerStudentId
          ? { borrowerStudentId: borrower.borrowerStudentId }
          : { borrowerStaffId: borrower.borrowerStaffId }),
      },
    });
    if (existing) return { ...existing, alreadyReserved: true };

    const expiresAt = dto.expiresAt
      ? new Date(dto.expiresAt)
      : addDays(new Date(), settings.reservationHoldDays);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
      throw new BadRequestException('Reservation expiry must be in the future');
    }

    const reservation = await this.prisma.libraryReservation.create({
      data: {
        tenantId: actor.tenantId,
        bookId: dto.bookId,
        copyId: dto.copyId ?? null,
        borrowerStudentId: borrower.borrowerStudentId,
        borrowerStaffId: borrower.borrowerStaffId,
        expiresAt,
        notes: dto.notes ?? null,
      },
      include: { book: true, copy: true },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'library_reservation',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: reservation.id,
      after: reservation,
    });

    return reservation;
  }

  async listReservations(
    actor: AuthContext,
    options: PaginationQuery & { status?: string; bookId?: string } = {},
  ) {
    const { skip, take, page } = this.pagination(options);
    const scope = await this.buildBorrowerScope(actor);
    const where: Prisma.LibraryReservationWhereInput = {
      tenantId: actor.tenantId,
      ...(options.status ? { status: options.status } : {}),
      ...(options.bookId ? { bookId: options.bookId } : {}),
      ...scope,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.libraryReservation.findMany({
        where,
        include: { book: true, copy: true },
        orderBy: [{ reservedAt: 'desc' }],
        skip,
        take,
      }),
      this.prisma.libraryReservation.count({ where }),
    ]);

    return { items, meta: { page, limit: take, total } };
  }

  async cancelReservation(reservationId: string, actor: AuthContext) {
    const reservation = await this.ensureReservationVisible(
      actor,
      reservationId,
    );
    if (reservation.status !== 'ACTIVE') return reservation;

    const updated = await this.prisma.libraryReservation.update({
      where: { id: reservation.id },
      data: { status: 'CANCELLED' },
      include: { book: true, copy: true },
    });

    await this.auditService.record({
      action: 'cancel',
      resource: 'library_reservation',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.id,
      after: { status: updated.status },
    });

    return updated;
  }

  async fulfillReservation(
    reservationId: string,
    dto: { copyId?: string; dueAt?: string; notes?: string },
    actor: AuthContext,
  ) {
    const reservation = await this.ensureReservationVisible(
      actor,
      reservationId,
    );
    if (reservation.status !== 'ACTIVE') {
      throw new ConflictException('Only active reservations can be fulfilled');
    }

    const copyId = dto.copyId ?? reservation.copyId;
    if (!copyId)
      throw new BadRequestException('Copy is required to fulfill reservation');

    return this.issueCopy(
      {
        copyId,
        borrowerStudentId: reservation.borrowerStudentId ?? undefined,
        borrowerStaffId: reservation.borrowerStaffId ?? undefined,
        dueAt: dto.dueAt,
        notes: dto.notes ?? `Fulfilled reservation ${reservation.id}`,
      },
      actor,
    );
  }

  async getIssuedBooksReport(
    actor: AuthContext,
    options: { page?: string; limit?: string } = {},
  ) {
    return this.listIssuesScoped(actor, {
      status: LibraryIssueStatus.ISSUED,
      page: options.page,
      limit: options.limit,
    });
  }

  async getOverdueBooksReport(actor: AuthContext) {
    return this.libraryService.listOverdue(actor);
  }

  async getLostDamagedReport(actor: AuthContext) {
    const items = await this.prisma.libraryCopy.findMany({
      where: {
        tenantId: actor.tenantId,
        status: { in: [LibraryCopyStatus.LOST, LibraryCopyStatus.DAMAGED] },
      },
      include: {
        book: true,
        history: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: 500,
    });

    return { items, meta: { total: items.length } };
  }

  async getFineSummary(actor: AuthContext) {
    const rows = await this.prisma.libraryFine.findMany({
      where: { tenantId: actor.tenantId },
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
      orderBy: [{ createdAt: 'desc' }],
      take: 500,
    });

    const totalFine = rows.reduce(
      (sum, row) => sum.add(row.amount),
      new Prisma.Decimal(0),
    );
    const totalWaived = rows.reduce(
      (sum, row) => sum.add(row.waivedAmount ?? new Prisma.Decimal(0)),
      new Prisma.Decimal(0),
    );

    return {
      items: rows,
      summary: {
        totalFines: rows.length,
        totalFine: totalFine.toString(),
        totalWaived: totalWaived.toString(),
        pending: rows.filter((row) => row.status === LibraryFineStatus.PENDING)
          .length,
        postedToFees: rows.filter(
          (row) => row.status === LibraryFineStatus.POSTED_TO_FEES,
        ).length,
        paid: rows.filter((row) => row.status === LibraryFineStatus.PAID)
          .length,
      },
    };
  }

  async getPopularBooksReport(
    actor: AuthContext,
    _options: PaginationQuery = {},
  ) {
    const popularCopies = await this.prisma.libraryIssue.groupBy({
      by: ['copyId'],
      where: { tenantId: actor.tenantId },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 100,
    });

    const copies = await this.prisma.libraryCopy.findMany({
      where: {
        tenantId: actor.tenantId,
        id: { in: popularCopies.map((row) => row.copyId) },
      },
      include: { book: true },
    });
    const countByCopy = new Map(
      popularCopies.map((row) => [row.copyId, row._count.id]),
    );
    const countByBook = new Map<
      string,
      { book: unknown; issueCount: number }
    >();

    for (const copy of copies) {
      const existing = countByBook.get(copy.bookId);
      const issueCount = countByCopy.get(copy.id) ?? 0;
      countByBook.set(copy.bookId, {
        book: copy.book,
        issueCount: (existing?.issueCount ?? 0) + issueCount,
      });
    }

    const items = Array.from(countByBook.values()).sort(
      (a, b) => b.issueCount - a.issueCount,
    );
    return { items: items.slice(0, 20), meta: { total: items.length } };
  }

  async getBorrowerHistory(
    actor: AuthContext,
    input: {
      studentId?: string;
      staffId?: string;
      page?: string;
      limit?: string;
    },
  ) {
    return this.listIssuesScoped(actor, {
      studentId: input.studentId,
      staffId: input.staffId,
      page: input.page,
      limit: input.limit,
    });
  }

  async reconcileFinePayment(actor: AuthContext, fineId: string) {
    const fine = await this.prisma.libraryFine.findFirst({
      where: { id: fineId, tenantId: actor.tenantId },
      include: { issue: true },
    });
    if (!fine) throw new NotFoundException('Library fine not found');

    const invoiceId = fine.feeInvoiceId ?? fine.issue.invoiceId;
    if (!invoiceId) {
      throw new ConflictException('Library fine has not been posted to fees');
    }

    const payments = await this.prisma.payment.findMany({
      where: {
        tenantId: actor.tenantId,
        invoiceId,
        status: PaymentStatus.SUCCESS,
      },
      orderBy: [{ paidAt: 'desc' }],
    });

    const paidAmount = payments.reduce(
      (sum, payment) => sum.add(payment.amount),
      new Prisma.Decimal(0),
    );
    const payable = fine.amount.sub(fine.waivedAmount ?? new Prisma.Decimal(0));
    const nextStatus = paidAmount.gte(payable)
      ? LibraryFineStatus.PAID
      : paidAmount.gt(0)
        ? LibraryFineStatus.PARTIALLY_PAID
        : fine.status;

    if (fine.status === nextStatus) {
      return {
        ...fine,
        alreadyReconciled: true,
        paidAmount: paidAmount.toString(),
      };
    }

    const updated = await this.prisma.libraryFine.update({
      where: { id: fine.id },
      data: { status: nextStatus },
      include: { issue: true },
    });

    await this.auditService.record({
      action: 'reconcile_payment',
      resource: 'library_fine',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: fine.id,
      before: { status: fine.status },
      after: {
        status: updated.status,
        invoiceId,
        paidAmount: paidAmount.toString(),
      },
    });

    return {
      ...updated,
      alreadyReconciled: false,
      paidAmount: paidAmount.toString(),
    };
  }

  async postFineToFeesIdempotent(
    actor: AuthContext,
    fineId: string,
    reason: string,
  ) {
    const fine = await this.prisma.libraryFine.findFirst({
      where: { id: fineId, tenantId: actor.tenantId },
      include: { issue: true },
    });
    if (!fine) throw new NotFoundException('Library fine not found');

    if (fine.feeInvoiceId || fine.issue.invoiceId) {
      return {
        ...fine,
        feeInvoiceId: fine.feeInvoiceId ?? fine.issue.invoiceId,
        alreadyPosted: true,
      };
    }

    return this.libraryService.postFineToFees(actor, fineId, reason);
  }

  async exportIssuedBooksCsv(actor: AuthContext) {
    const report = await this.listIssuesScoped(actor, {
      status: LibraryIssueStatus.ISSUED,
      page: '1',
      limit: '100',
    });

    const rows = [
      [
        'Issue ID',
        'Book Title',
        'Barcode',
        'Borrower',
        'Issued At',
        'Due At',
        'Status',
      ],
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

  async exportIssuedBooksCsvFile(actor: AuthContext) {
    if (!this.fileRegistryService) {
      throw new ConflictException('File Registry is not available for export');
    }

    const csv = await this.exportIssuedBooksCsv(actor);
    const fileName = `library-issued-books-${new Date().toISOString().slice(0, 10)}.csv`;
    const asset = await this.fileRegistryService.registerGeneratedFile({
      tenantId: actor.tenantId,
      generatedByUserId: actor.userId,
      originalFilename: fileName,
      content: Buffer.from(csv, 'utf8'),
      mimeType: 'text/csv',
      module: 'library',
      metadata: {
        kind: 'library_issued_books_report',
        generatedAt: new Date().toISOString(),
      },
    });

    return { fileAssetId: asset.id, fileName, mimeType: 'text/csv' };
  }

  async getLibrarySettings(actor: AuthContext): Promise<LibraryPolicySettings> {
    const settings = await this.prisma.librarySetting.findUnique({
      where: { tenantId: actor.tenantId },
    });

    return normalizeSettings(settings);
  }

  async updateLibrarySettings(
    actor: AuthContext,
    dto: UpdateLibrarySettingDto,
  ) {
    const settings = await this.prisma.librarySetting.upsert({
      where: { tenantId: actor.tenantId },
      update: {
        ...(dto.finePerDay !== undefined
          ? { finePerDay: new Prisma.Decimal(dto.finePerDay) }
          : {}),
        ...(dto.maxFineAmount !== undefined
          ? {
              maxFineAmount: dto.maxFineAmount
                ? new Prisma.Decimal(dto.maxFineAmount)
                : null,
            }
          : {}),
        ...(dto.gracePeriodDays !== undefined
          ? { gracePeriodDays: dto.gracePeriodDays }
          : {}),
        ...(dto.lostBookChargeMultiplier !== undefined
          ? {
              lostBookChargeMultiplier: new Prisma.Decimal(
                dto.lostBookChargeMultiplier,
              ),
            }
          : {}),
        ...(dto.maxBooksPerStudent !== undefined
          ? { maxBooksPerStudent: dto.maxBooksPerStudent }
          : {}),
        ...(dto.maxBooksPerStaff !== undefined
          ? { maxBooksPerStaff: dto.maxBooksPerStaff }
          : {}),
        ...(dto.studentLoanDays !== undefined
          ? { studentLoanDays: dto.studentLoanDays }
          : {}),
        ...(dto.staffLoanDays !== undefined
          ? { staffLoanDays: dto.staffLoanDays }
          : {}),
        ...(dto.includeHolidaysInFine !== undefined
          ? { includeHolidaysInFine: dto.includeHolidaysInFine }
          : {}),
        ...(dto.reservationHoldDays !== undefined
          ? { reservationHoldDays: dto.reservationHoldDays }
          : {}),
      },
      create: {
        tenantId: actor.tenantId,
        finePerDay: new Prisma.Decimal(dto.finePerDay ?? 0),
        maxFineAmount: dto.maxFineAmount
          ? new Prisma.Decimal(dto.maxFineAmount)
          : null,
        gracePeriodDays: dto.gracePeriodDays ?? 0,
        lostBookChargeMultiplier: new Prisma.Decimal(
          dto.lostBookChargeMultiplier ?? 1,
        ),
        maxBooksPerStudent: dto.maxBooksPerStudent ?? 3,
        maxBooksPerStaff: dto.maxBooksPerStaff ?? 5,
        studentLoanDays: dto.studentLoanDays ?? 14,
        staffLoanDays: dto.staffLoanDays ?? 30,
        includeHolidaysInFine: dto.includeHolidaysInFine ?? false,
        reservationHoldDays: dto.reservationHoldDays ?? 3,
      },
    });

    await this.auditService.record({
      action: 'update_settings',
      resource: 'library_settings',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: settings,
    });

    return settings;
  }

  async sendOverdueRemindersIdempotent(actor: AuthContext) {
    const windowKey = new Date().toISOString().slice(0, 10);
    const sourceId = `library-overdue-${actor.tenantId}-${windowKey}`;

    const existing = await this.prisma.notificationDelivery.count({
      where: {
        tenantId: actor.tenantId,
        sourceType: 'library_overdue',
        sourceId,
      },
    });

    if (existing > 0) {
      return { skipped: true, sourceId, deliveryCount: existing };
    }

    const result = await this.libraryService.sendOverdueReminders(
      actor,
      sourceId,
    );

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

  private async calculateFineAmount(
    issue: {
      dueAt: Date;
      copy: {
        replacementCost: Prisma.Decimal | null;
        book: { purchasePrice: Prisma.Decimal | null };
      };
    },
    returnedAt: Date,
    settings: LibraryPolicySettings,
    markLost: boolean,
  ) {
    if (markLost) {
      return calculateLostReplacementCharge(
        issue.copy.replacementCost,
        issue.copy.book.purchasePrice,
        settings.lostBookChargeMultiplier,
      );
    }

    if (returnedAt <= issue.dueAt) return 0;

    const rawDaysOverdue = Math.ceil(
      (returnedAt.getTime() - issue.dueAt.getTime()) / 86_400_000,
    );
    let holidayCount = 0;

    if (!settings.includeHolidaysInFine && rawDaysOverdue > 0) {
      const holidayDates = await this.prisma.schoolCalendarDay.findMany({
        where: {
          calendarDate: {
            gt: startOfDay(issue.dueAt),
            lte: addDays(startOfDay(issue.dueAt), rawDaysOverdue),
          },
          isWorkingDay: false,
        },
        select: { calendarDate: true },
      });
      holidayCount = new Set(
        holidayDates.map((holiday) =>
          startOfDay(holiday.calendarDate).toISOString(),
        ),
      ).size;
    }

    const billableDays = Math.max(
      0,
      rawDaysOverdue - holidayCount - settings.gracePeriodDays,
    );
    const rawFine = new Prisma.Decimal(settings.finePerDay)
      .mul(billableDays)
      .toDecimalPlaces(2);

    if (settings.maxFineAmount && rawFine.gt(settings.maxFineAmount)) {
      return Number(settings.maxFineAmount);
    }
    return Number(rawFine);
  }

  private async ensureReservationAllowsIssue(
    actor: AuthContext,
    copy: { id: string; bookId: string },
    borrower: BorrowerIdentity,
  ) {
    const activeReservation = await this.prisma.libraryReservation.findFirst({
      where: {
        tenantId: actor.tenantId,
        status: 'ACTIVE',
        bookId: copy.bookId,
        OR: [{ copyId: null }, { copyId: copy.id }],
        expiresAt: { gt: new Date() },
      },
      orderBy: [{ reservedAt: 'asc' }],
    });

    if (!activeReservation) return;
    if (this.borrowerMatches(activeReservation, borrower)) return;

    throw new ConflictException('Copy is reserved for another borrower');
  }

  private async ensureReservationVisible(
    actor: AuthContext,
    reservationId: string,
  ) {
    const scope = await this.buildBorrowerScope(actor);
    const reservation = await this.prisma.libraryReservation.findFirst({
      where: { id: reservationId, tenantId: actor.tenantId, ...scope },
      include: { book: true, copy: true },
    });
    if (!reservation)
      throw new NotFoundException('Library reservation not found');
    return reservation;
  }

  private async buildScopedIssueWhere(
    actor: AuthContext,
    options: ListIssuesQuery,
  ): Promise<Prisma.LibraryIssueWhereInput> {
    const where: Prisma.LibraryIssueWhereInput = {
      tenantId: actor.tenantId,
      ...(options.status
        ? { status: this.parseIssueStatus(options.status) }
        : {}),
    };

    const parentStudentIds = await getParentStudentIds(this.prisma, actor);
    if (parentStudentIds !== null) {
      if (options.staffId)
        throw new ForbiddenException(
          'Parents cannot read staff library issues',
        );
      if (options.studentId && !parentStudentIds.includes(options.studentId)) {
        throw new ForbiddenException(
          'Parent cannot read this student library history',
        );
      }
      where.borrowerStudentId = {
        in: options.studentId ? [options.studentId] : parentStudentIds,
      };
      return where;
    }

    const studentOwnId = await getStudentOwnId(this.prisma, actor);
    if (studentOwnId !== null) {
      if (options.staffId)
        throw new ForbiddenException(
          'Students cannot read staff library issues',
        );
      if (options.studentId && options.studentId !== studentOwnId) {
        throw new ForbiddenException(
          'Student cannot read another student library history',
        );
      }
      where.borrowerStudentId = studentOwnId;
      return where;
    }

    // Confirmed gap (Teacher Persona spec M8 "no other users' full borrowing
    // history"): this fell through to unrestricted tenant-wide access for
    // any staff actor, including a base Teacher role. A Teacher may only see
    // their own circulation records.
    const teacherStaffId = await getTeacherStaffOwnId(this.prisma, actor);
    if (teacherStaffId !== null) {
      if (options.studentId)
        throw new ForbiddenException(
          'Teachers cannot read student library issues',
        );
      if (options.staffId && options.staffId !== teacherStaffId) {
        throw new ForbiddenException(
          'Teachers can only read their own library issues',
        );
      }
      where.borrowerStaffId = teacherStaffId;
      return where;
    }

    if (options.studentId) where.borrowerStudentId = options.studentId;
    if (options.staffId) where.borrowerStaffId = options.staffId;
    return where;
  }

  private async buildBorrowerScope(actor: AuthContext) {
    const parentStudentIds = await getParentStudentIds(this.prisma, actor);
    if (parentStudentIds !== null) {
      return { borrowerStudentId: { in: parentStudentIds } };
    }

    const studentOwnId = await getStudentOwnId(this.prisma, actor);
    if (studentOwnId !== null) return { borrowerStudentId: studentOwnId };

    // Same confirmed gap as buildScopedIssueWhere above, applied to
    // reservations: a base Teacher role must only see/cancel their own
    // reservations, not the whole tenant's.
    const teacherStaffId = await getTeacherStaffOwnId(this.prisma, actor);
    if (teacherStaffId !== null) return { borrowerStaffId: teacherStaffId };

    return {};
  }

  private async enforceBorrowerPolicy(
    actor: AuthContext,
    borrower: BorrowerIdentity,
    settings: LibraryPolicySettings,
  ) {
    const activeIssues = await this.prisma.libraryIssue.count({
      where: {
        tenantId: actor.tenantId,
        status: LibraryIssueStatus.ISSUED,
        ...(borrower.borrowerStudentId
          ? { borrowerStudentId: borrower.borrowerStudentId }
          : { borrowerStaffId: borrower.borrowerStaffId }),
      },
    });

    const maxAllowed = borrower.borrowerStaffId
      ? settings.maxBooksPerStaff
      : settings.maxBooksPerStudent;
    if (activeIssues >= maxAllowed) {
      throw new ConflictException(
        'Borrower has reached the active library issue limit',
      );
    }
  }

  private async ensureBorrower(actor: AuthContext, borrower: BorrowerIdentity) {
    const [student, staff] = await Promise.all([
      borrower.borrowerStudentId
        ? this.prisma.student.findFirst({
            where: { id: borrower.borrowerStudentId, tenantId: actor.tenantId },
          })
        : Promise.resolve(null),
      borrower.borrowerStaffId
        ? this.prisma.staff.findFirst({
            where: { id: borrower.borrowerStaffId, tenantId: actor.tenantId },
          })
        : Promise.resolve(null),
    ]);

    if (borrower.borrowerStudentId && !student) {
      throw new NotFoundException('Borrower student not found in this tenant');
    }
    if (borrower.borrowerStaffId && !staff) {
      throw new NotFoundException('Borrower staff not found in this tenant');
    }
  }

  private assertOneBorrower(input: BorrowerIdentity) {
    if (!input.borrowerStudentId && !input.borrowerStaffId) {
      throw new BadRequestException('Student or staff borrower is required');
    }
    if (input.borrowerStudentId && input.borrowerStaffId) {
      throw new BadRequestException(
        'Choose either a student or staff borrower',
      );
    }
  }

  private borrowerMatches(
    record: BorrowerIdentity,
    borrower: BorrowerIdentity,
  ) {
    return (
      (borrower.borrowerStudentId &&
        record.borrowerStudentId === borrower.borrowerStudentId) ||
      (borrower.borrowerStaffId &&
        record.borrowerStaffId === borrower.borrowerStaffId)
    );
  }

  private async ensureUniqueIsbn(tenantId: string, isbn: string) {
    const existing = await this.prisma.libraryBook.findUnique({
      where: { tenantId_isbn: { tenantId, isbn } },
    });
    if (existing)
      throw new ConflictException('Book ISBN already exists in this tenant');
  }

  private async ensureUniqueBarcode(tenantId: string, barcode: string) {
    const existing = await this.prisma.libraryCopy.findUnique({
      where: { tenantId_barcode: { tenantId, barcode } },
    });
    if (existing)
      throw new ConflictException('Copy barcode already exists in this tenant');
  }

  private async ensureUniqueQrCode(tenantId: string, qrCode: string) {
    const existing = await this.prisma.libraryCopy.findUnique({
      where: { tenantId_qrCode: { tenantId, qrCode } },
    });
    if (existing)
      throw new ConflictException('Copy QR code already exists in this tenant');
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
    return { page, take, skip: (page - 1) * take };
  }

  private async recordCopyHistory(
    tx: Prisma.TransactionClient,
    input: {
      actor: AuthContext;
      copyId: string;
      eventType: string;
      statusBefore?: string | null;
      statusAfter?: string | null;
      reason?: string | null;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    await tx.libraryCopyHistory.create({
      data: {
        tenantId: input.actor.tenantId,
        copyId: input.copyId,
        eventType: input.eventType,
        statusBefore: input.statusBefore ?? null,
        statusAfter: input.statusAfter ?? null,
        reason: input.reason ?? null,
        actorUserId: input.actor.userId,
        metadata: input.metadata ?? Prisma.JsonNull,
      },
    });
  }
}

function normalizeSettings(
  settings: Partial<LibraryPolicySettings> | null,
): LibraryPolicySettings {
  return {
    finePerDay: new Prisma.Decimal(settings?.finePerDay ?? 0),
    maxFineAmount: settings?.maxFineAmount
      ? new Prisma.Decimal(settings.maxFineAmount)
      : null,
    gracePeriodDays: settings?.gracePeriodDays ?? 0,
    lostBookChargeMultiplier: new Prisma.Decimal(
      settings?.lostBookChargeMultiplier ?? 1,
    ),
    maxBooksPerStudent: settings?.maxBooksPerStudent ?? 3,
    maxBooksPerStaff: settings?.maxBooksPerStaff ?? 5,
    studentLoanDays: settings?.studentLoanDays ?? 14,
    staffLoanDays: settings?.staffLoanDays ?? 30,
    includeHolidaysInFine: settings?.includeHolidaysInFine ?? false,
    reservationHoldDays: settings?.reservationHoldDays ?? 3,
  };
}

function calculateLostReplacementCharge(
  copyReplacementCost: Prisma.Decimal | null,
  bookPurchasePrice: Prisma.Decimal | null,
  multiplier: Prisma.Decimal,
) {
  const base = copyReplacementCost ?? bookPurchasePrice;
  if (!base) return 0;
  return Number(new Prisma.Decimal(base).mul(multiplier).toDecimalPlaces(2));
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

function csvEscape(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}
