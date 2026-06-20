import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

const DISPLAY_STATUS_MAP: Record<string, string> = {
  INQUIRY: 'DRAFT',
  APPLICATION: 'NEEDS_INFORMATION',
  DOCUMENT_PENDING: 'NEEDS_INFORMATION',
  ENTRANCE_INTERVIEW: 'WAITING_FOR_REVIEW',
  ACCEPTED: 'APPROVED',
  ENROLLED: 'ADMITTED',
  REJECTED: 'NOT_ADMITTED',
  FINALIZING: 'READY_TO_ADMIT',
};

const QUEUE_STORAGE_STATUSES: Record<string, string[]> = {
  NEEDS_INFORMATION: ['NEEDS_INFORMATION', 'APPLICATION', 'DOCUMENT_PENDING'],
  WAITING_FOR_REVIEW: ['WAITING_FOR_REVIEW', 'ENTRANCE_INTERVIEW'],
  READY_TO_ADMIT: ['READY_TO_ADMIT'],
  APPROVED: ['APPROVED', 'ACCEPTED'],
  NOT_ADMITTED: ['NOT_ADMITTED', 'REJECTED'],
  DOCUMENTS_PENDING: ['ADMITTED'],
  DUPLICATE_WARNINGS: ['DRAFT', 'NEEDS_INFORMATION', 'READY_TO_ADMIT', 'WAITING_FOR_REVIEW', 'APPROVED', 'ACCEPTED'],
};

@Injectable()
export class AdmissionCaseQueuesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: AuthContext, query: { queue?: string; page?: number; limit?: number; search?: string }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));
    const skip = (page - 1) * limit;
    const storageStatuses = query.queue ? QUEUE_STORAGE_STATUSES[query.queue] : undefined;
    const where: Prisma.AdmissionApplicationWhereInput = {
      tenantId: actor.tenantId,
      ...(storageStatuses ? { status: { in: storageStatuses } } : {}),
      ...(query.search
        ? {
            OR: [
              { firstNameEn: { contains: query.search, mode: 'insensitive' } },
              { lastNameEn: { contains: query.search, mode: 'insensitive' } },
              { guardianPhone: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, records] = await Promise.all([
      this.prisma.admissionApplication.count({ where }),
      this.prisma.admissionApplication.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
        select: {
          id: true,
          status: true,
          firstNameEn: true,
          lastNameEn: true,
          guardianFullName: true,
          guardianPhone: true,
          source: true,
          classId: true,
          sectionId: true,
          convertedStudentId: true,
          duplicateReview: true,
          updatedAt: true,
        },
      }),
    ]);

    const items = records
      .map((record) => ({
        id: record.id,
        displayStatus: DISPLAY_STATUS_MAP[record.status] ?? record.status,
        fullNameEn: `${record.firstNameEn} ${record.lastNameEn}`.trim(),
        guardianFullName: record.guardianFullName,
        guardianPhone: record.guardianPhone,
        source: record.source ?? 'OFFICE_WALK_IN',
        classId: record.classId,
        sectionId: record.sectionId,
        admittedStudentId: record.convertedStudentId,
        hasDuplicateWarning: this.hasDuplicateWarning(record.duplicateReview),
        hasDocumentsPending: this.hasDocumentsPending(record.duplicateReview),
        updatedAt: record.updatedAt.toISOString(),
      }))
      .filter((item) => {
        if (query.queue === 'DUPLICATE_WARNINGS') return item.hasDuplicateWarning;
        if (query.queue === 'DOCUMENTS_PENDING') return item.hasDocumentsPending;
        return true;
      });

    return {
      items,
      total: query.queue === 'DUPLICATE_WARNINGS' || query.queue === 'DOCUMENTS_PENDING' ? items.length : total,
      page,
      limit,
      hasNextPage:
        query.queue === 'DUPLICATE_WARNINGS' || query.queue === 'DOCUMENTS_PENDING'
          ? records.length === limit && items.length > 0
          : total > skip + records.length,
    };
  }

  private hasDuplicateWarning(value: Prisma.JsonValue | null) {
    const metadata = this.metadata(value);
    return metadata.duplicateRisk === true || Array.isArray(metadata.duplicateCandidates) || 'matches' in metadata;
  }

  private hasDocumentsPending(value: Prisma.JsonValue | null) {
    const metadata = this.metadata(value);
    const followUps = metadata.followUps;
    return Array.isArray(followUps) && followUps.some((item) => this.isDocumentFollowUp(item));
  }

  private metadata(value: Prisma.JsonValue | null): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private isDocumentFollowUp(value: unknown) {
    return typeof value === 'object' && value !== null && (value as { code?: unknown }).code === 'DOCUMENTS_PENDING';
  }
}
