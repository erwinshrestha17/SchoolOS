import { Injectable } from '@nestjs/common';
import type {
  AdmissionCaseDisplayStatus,
  AdmissionCaseQueueName,
  AdmissionCaseQueuePage,
  AdmissionCaseSource,
  AdmissionWaitlistCapacity,
} from '@schoolos/core';
import { EnrollmentStatus, Prisma } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

const DISPLAY_STATUS_MAP: Partial<Record<string, AdmissionCaseDisplayStatus>> =
  {
    INQUIRY: 'DRAFT',
    APPLICATION: 'NEEDS_INFORMATION',
    DOCUMENT_PENDING: 'NEEDS_INFORMATION',
    ENTRANCE_INTERVIEW: 'WAITING_FOR_REVIEW',
    ACCEPTED: 'APPROVED',
    ENROLLED: 'ADMITTED',
    REJECTED: 'NOT_ADMITTED',
    FINALIZING: 'READY_TO_ADMIT',
  };
const SIMPLE_DISPLAY_STATUSES = new Set<AdmissionCaseDisplayStatus>([
  'DRAFT',
  'NEEDS_INFORMATION',
  'READY_TO_ADMIT',
  'WAITING_FOR_REVIEW',
  'WAITLISTED',
  'APPROVED',
  'ADMITTED',
  'NOT_ADMITTED',
  'CLOSED',
]);

const QUEUE_STORAGE_STATUSES: Record<string, string[]> = {
  NEEDS_INFORMATION: [
    'DRAFT',
    'INQUIRY',
    'NEEDS_INFORMATION',
    'APPLICATION',
    'DOCUMENT_PENDING',
  ],
  WAITING_FOR_REVIEW: ['WAITING_FOR_REVIEW', 'ENTRANCE_INTERVIEW'],
  READY_TO_ADMIT: ['READY_TO_ADMIT'],
  WAITLISTED: ['WAITLISTED'],
  APPROVED: ['APPROVED', 'ACCEPTED'],
  NOT_ADMITTED: ['NOT_ADMITTED', 'REJECTED'],
  DOCUMENTS_PENDING: ['ADMITTED'],
  // Queue-view alias only. AdmissionCase persists the confirmed ADMITTED
  // lifecycle value; the school-facing workspace labels finalized cases as
  // Completed without inventing a new stored status.
  COMPLETED: ['ADMITTED', 'ENROLLED'],
  DUPLICATE_WARNINGS: [
    'DRAFT',
    'NEEDS_INFORMATION',
    'READY_TO_ADMIT',
    'WAITING_FOR_REVIEW',
    'APPROVED',
    'ACCEPTED',
  ],
};

const NEARLY_FULL_THRESHOLD = 0.9;

const admissionQueueSelect =
  Prisma.validator<Prisma.AdmissionApplicationSelect>()({
    id: true,
    status: true,
    firstNameEn: true,
    lastNameEn: true,
    guardianFullName: true,
    guardianPhone: true,
    source: true,
    academicYearId: true,
    classId: true,
    sectionId: true,
    convertedStudentId: true,
    duplicateReview: true,
    policyVersion: {
      select: {
        tenantId: true,
        enforceCapacityWhenAvailable: true,
        capacityOverride: true,
      },
    },
    createdAt: true,
    updatedAt: true,
  });

type AdmissionQueueRecord = Prisma.AdmissionApplicationGetPayload<{
  select: typeof admissionQueueSelect;
}>;

interface WaitlistProjection {
  className: string | null;
  sectionName: string | null;
  capacity: AdmissionWaitlistCapacity;
  canPromote: boolean;
}

interface WaitlistClass {
  id: string;
  name: string;
}
interface WaitlistSection {
  id: string;
  classId: string;
  name: string;
  capacity: number | null;
}
interface WaitlistEnrollmentCount {
  academicYearId: string;
  sectionId: string | null;
  _count: { _all: number };
}

@Injectable()
export class AdmissionCaseQueuesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    actor: AuthContext,
    query: {
      queue?: AdmissionCaseQueueName;
      page?: number;
      limit?: number;
      search?: string;
    },
  ): Promise<AdmissionCaseQueuePage> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));
    const skip = (page - 1) * limit;
    const storageStatuses = query.queue
      ? QUEUE_STORAGE_STATUSES[query.queue]
      : undefined;
    const where: Prisma.AdmissionApplicationWhereInput = {
      tenantId: actor.tenantId,
      ...(storageStatuses ? { status: { in: storageStatuses } } : {}),
      AND: [
        this.queueMetadataWhere(query.queue),
        ...(query.search
          ? [
              {
                OR: [
                  { id: { equals: query.search } },
                  {
                    firstNameEn: {
                      contains: query.search,
                      mode: 'insensitive',
                    },
                  },
                  {
                    lastNameEn: { contains: query.search, mode: 'insensitive' },
                  },
                  {
                    guardianPhone: {
                      contains: query.search,
                      mode: 'insensitive',
                    },
                  },
                ],
              } satisfies Prisma.AdmissionApplicationWhereInput,
            ]
          : []),
      ],
    };
    const [total, records] = await Promise.all([
      this.prisma.admissionApplication.count({ where }),
      this.prisma.admissionApplication.findMany({
        where,
        // Waitlisted cases use stable original-application order. Updating a
        // note or contact detail must not silently move a family ahead of an
        // earlier application. Other operational queues remain newest-first.
        orderBy:
          query.queue === 'WAITLISTED'
            ? [{ createdAt: 'asc' }, { id: 'asc' }]
            : [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
        select: admissionQueueSelect,
      }),
    ]);

    const waitlistProjection =
      query.queue === 'WAITLISTED'
        ? await this.loadWaitlistProjection(actor, records)
        : new Map<string, WaitlistProjection>();

    const items = records.map((record) => {
      const projection = waitlistProjection.get(record.id);
      return {
        id: record.id,
        displayStatus: this.displayStatus(record.status),
        fullNameEn: `${record.firstNameEn} ${record.lastNameEn}`.trim(),
        guardianFullName: record.guardianFullName,
        guardianPhone: record.guardianPhone,
        source: normalizeAdmissionSource(record.source),
        classId: record.classId,
        className: projection?.className ?? null,
        sectionId: record.sectionId,
        sectionName: projection?.sectionName ?? null,
        admittedStudentId: record.convertedStudentId,
        hasDuplicateWarning: this.hasDuplicateWarning(record.duplicateReview),
        hasDocumentsPending: this.hasDocumentsPending(record.duplicateReview),
        waitlistCapacity: projection?.capacity ?? null,
        canPromoteFromWaitlist: projection?.canPromote ?? false,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      };
    });

    return {
      items,
      total,
      page,
      limit,
      hasNextPage: total > skip + records.length,
    };
  }

  private async loadWaitlistProjection(
    actor: AuthContext,
    records: AdmissionQueueRecord[],
  ): Promise<Map<string, WaitlistProjection>> {
    if (records.length === 0) return new Map<string, WaitlistProjection>();

    const classIds = [
      ...new Set(records.flatMap((record) => record.classId ?? [])),
    ];
    const sectionIds = [
      ...new Set(records.flatMap((record) => record.sectionId ?? [])),
    ];
    const placementEntries = records.flatMap((record) => {
      if (!record.academicYearId || !record.sectionId) return [];
      return [
        [
          this.placementKey(record.academicYearId, record.sectionId),
          {
            academicYearId: record.academicYearId,
            sectionId: record.sectionId,
          },
        ] as const,
      ];
    });
    const placementPairs = [...new Map(placementEntries).values()];

    const [classes, sections, enrollmentCounts] = await Promise.all([
      this.loadClasses(actor.tenantId, classIds),
      this.loadSections(actor.tenantId, sectionIds),
      this.loadEnrollmentCounts(actor.tenantId, placementPairs),
    ]);

    const classNames = new Map<string, string>(
      classes.map((item) => [item.id, item.name] as const),
    );
    const sectionsById = new Map<string, WaitlistSection>(
      sections.map((item) => [item.id, item] as const),
    );
    const enrolledByPlacement = new Map<string, number>(
      enrollmentCounts.map(
        (item) =>
          [
            this.placementKey(item.academicYearId, item.sectionId ?? ''),
            item._count._all,
          ] as const,
      ),
    );

    return new Map<string, WaitlistProjection>(
      records.map((record) => {
        const section = record.sectionId
          ? sectionsById.get(record.sectionId)
          : undefined;
        const validSection =
          section && record.classId && section.classId === record.classId
            ? section
            : undefined;
        const enrolled =
          record.academicYearId && validSection
            ? (enrolledByPlacement.get(
                this.placementKey(record.academicYearId, validSection.id),
              ) ?? 0)
            : null;
        const policyVersion =
          record.policyVersion?.tenantId === actor.tenantId
            ? record.policyVersion
            : null;
        const effectiveCapacity =
          policyVersion?.capacityOverride ?? validSection?.capacity ?? null;
        const capacity = this.capacityStatus(
          effectiveCapacity,
          enrolled,
          policyVersion?.enforceCapacityWhenAvailable ?? false,
        );

        return [
          record.id,
          {
            className: record.classId
              ? (classNames.get(record.classId) ?? null)
              : null,
            sectionName: validSection?.name ?? null,
            capacity,
            canPromote: !capacity.enforced || capacity.state !== 'FULL',
          },
        ] as const;
      }),
    );
  }

  private loadClasses(
    tenantId: string,
    classIds: string[],
  ): Promise<WaitlistClass[]> {
    if (classIds.length === 0) return Promise.resolve([]);
    return this.prisma.class.findMany({
      where: { tenantId, id: { in: classIds } },
      select: { id: true, name: true },
    });
  }

  private loadSections(
    tenantId: string,
    sectionIds: string[],
  ): Promise<WaitlistSection[]> {
    if (sectionIds.length === 0) return Promise.resolve([]);
    return this.prisma.section.findMany({
      where: { tenantId, id: { in: sectionIds } },
      select: { id: true, classId: true, name: true, capacity: true },
    });
  }

  private async loadEnrollmentCounts(
    tenantId: string,
    placementPairs: Array<{ academicYearId: string; sectionId: string }>,
  ) {
    if (placementPairs.length === 0) return [] as WaitlistEnrollmentCount[];
    const rows = await this.prisma.enrollment.groupBy({
      by: ['academicYearId', 'sectionId'],
      where: {
        tenantId,
        status: EnrollmentStatus.ACTIVE,
        OR: placementPairs,
      },
      _count: { _all: true },
    });
    return rows.map((row) => ({
      academicYearId: row.academicYearId,
      sectionId: row.sectionId,
      _count: { _all: row._count._all },
    }));
  }

  private capacityStatus(
    effectiveCapacity: number | null,
    enrolled: number | null,
    enforced: boolean,
  ): AdmissionWaitlistCapacity {
    if (effectiveCapacity === null || enrolled === null) {
      return {
        state: 'NOT_CONFIGURED',
        capacity: null,
        enrolled: null,
        seatsAvailable: null,
        enforced,
      };
    }

    const state: AdmissionWaitlistCapacity['state'] =
      enrolled >= effectiveCapacity
        ? 'FULL'
        : enrolled >= effectiveCapacity * NEARLY_FULL_THRESHOLD
          ? 'NEARLY_FULL'
          : 'AVAILABLE';
    return {
      state,
      capacity: effectiveCapacity,
      enrolled,
      seatsAvailable: Math.max(0, effectiveCapacity - enrolled),
      enforced,
    };
  }

  private placementKey(academicYearId: string, sectionId: string) {
    return `${academicYearId}:${sectionId}`;
  }

  private queueMetadataWhere(
    queue: string | undefined,
  ): Prisma.AdmissionApplicationWhereInput {
    if (queue === 'DUPLICATE_WARNINGS') {
      return {
        OR: [
          { duplicateReview: { path: ['duplicateRisk'], equals: true } },
          { duplicateReview: { path: ['hasWarnings'], equals: true } },
        ],
      };
    }
    if (queue === 'DOCUMENTS_PENDING') {
      return {
        duplicateReview: {
          path: ['followUps'],
          array_contains: [{ code: 'DOCUMENTS_PENDING' }],
        },
      };
    }
    return {};
  }

  private displayStatus(status: string): AdmissionCaseDisplayStatus {
    const mapped = DISPLAY_STATUS_MAP[status];
    if (mapped) return mapped;
    return SIMPLE_DISPLAY_STATUSES.has(status as AdmissionCaseDisplayStatus)
      ? (status as AdmissionCaseDisplayStatus)
      : 'DRAFT';
  }

  private hasDuplicateWarning(value: Prisma.JsonValue | null) {
    const metadata = this.metadata(value);
    return (
      metadata.duplicateRisk === true ||
      metadata.hasWarnings === true ||
      (Array.isArray(metadata.duplicateCandidates) &&
        metadata.duplicateCandidates.length > 0) ||
      (Array.isArray(metadata.matches) && metadata.matches.length > 0)
    );
  }

  private hasDocumentsPending(value: Prisma.JsonValue | null) {
    const metadata = this.metadata(value);
    const followUps = metadata.followUps;
    return (
      Array.isArray(followUps) &&
      followUps.some((item) => this.isDocumentFollowUp(item))
    );
  }

  private metadata(value: Prisma.JsonValue | null): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? value
      : {};
  }

  private isDocumentFollowUp(value: unknown) {
    return (
      typeof value === 'object' &&
      value !== null &&
      (value as { code?: unknown }).code === 'DOCUMENTS_PENDING'
    );
  }
}

function normalizeAdmissionSource(value: string | null): AdmissionCaseSource {
  const normalized = value
    ?.trim()
    .toUpperCase()
    .replace(/[\s/-]+/g, '_');
  if (
    normalized === 'PARENT_ONLINE' ||
    normalized === 'ONLINE' ||
    normalized === 'WEBSITE'
  ) {
    return 'PARENT_ONLINE';
  }
  if (normalized === 'PHONE_INQUIRY' || normalized === 'PHONE') {
    return 'PHONE_INQUIRY';
  }
  if (normalized === 'TRANSFER_REQUEST' || normalized === 'TRANSFER') {
    return 'TRANSFER_REQUEST';
  }
  if (normalized === 'IMPORT' || normalized === 'BULK_IMPORT') return 'IMPORT';
  return 'OFFICE_WALK_IN';
}
