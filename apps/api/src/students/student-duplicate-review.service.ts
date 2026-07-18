import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  StudentDuplicateReviewStatus,
  StudentLifecycleStatus,
} from '@prisma/client';
import type {
  StudentDuplicateCandidate,
  StudentDuplicateCandidateStudent,
  StudentDuplicateCandidatesResult,
  StudentDuplicateReviewMetadata,
} from '@schoolos/core';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ListDuplicateStudentCandidatesDto } from './dto/list-duplicate-student-candidates.dto';
import { MarkDuplicateStudentPairNotDuplicateDto } from './dto/mark-duplicate-student-pair-not-duplicate.dto';
import { ReopenDuplicateStudentReviewDto } from './dto/reopen-duplicate-student-review.dto';

interface DuplicateCandidatePairRow {
  sourceStudentId: string | null;
  candidateStudentId: string | null;
  score: number | null;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  reasons: string[] | null;
  identityFingerprint: string | null;
  reviewState: 'PENDING' | 'NOT_DUPLICATE' | null;
  reviewId: string | null;
  reviewStatus: StudentDuplicateReviewStatus | null;
  reviewReason: string | null;
  reviewIdentityChanged: boolean | null;
  reviewedById: string | null;
  reviewedAt: Date | null;
  reopenedById: string | null;
  reopenedAt: Date | null;
  reopenReason: string | null;
  total?: bigint;
  pending?: bigint;
  highConfidence?: bigint;
  resolvedNotDuplicate?: bigint;
}

type ResolvedDuplicateCandidatePairRow = DuplicateCandidatePairRow & {
  sourceStudentId: string;
  candidateStudentId: string;
  score: number;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  reasons: string[];
  identityFingerprint: string;
  reviewState: 'PENDING' | 'NOT_DUPLICATE';
};

interface DuplicateCandidateStudentRecord {
  id: string;
  studentSystemId: string;
  firstNameEn: string;
  lastNameEn: string;
  dateOfBirth: Date;
  admissionNumber: string | null;
  previousSchool: string | null;
  lifecycleStatus: StudentLifecycleStatus;
  class: { name: string };
  sectionRef: { name: string } | null;
  guardianLinks: Array<{
    guardian: {
      primaryPhone: string;
      secondaryPhone: string | null;
    };
  }>;
}

const candidateStudentSelect = Prisma.validator<Prisma.StudentSelect>()({
  id: true,
  studentSystemId: true,
  firstNameEn: true,
  lastNameEn: true,
  dateOfBirth: true,
  admissionNumber: true,
  previousSchool: true,
  lifecycleStatus: true,
  class: { select: { name: true } },
  sectionRef: { select: { name: true } },
  guardianLinks: {
    select: {
      guardian: {
        select: {
          primaryPhone: true,
          secondaryPhone: true,
        },
      },
    },
  },
});

@Injectable()
export class StudentDuplicateReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listCandidates(
    query: ListDuplicateStudentCandidatesDto,
    actor: AuthContext,
  ): Promise<StudentDuplicateCandidatesResult> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const status = query.status ?? 'PENDING';
    const confidence = query.confidence ?? 'ALL';
    const search = query.search?.trim() || null;
    const offset = (page - 1) * limit;

    if (query.studentId) {
      const studentExists = await this.prisma.student.count({
        where: {
          id: query.studentId,
          tenantId: actor.tenantId,
        },
      });

      if (studentExists === 0) {
        throw new NotFoundException('Student not found in this school');
      }
    }

    const candidateCte = duplicateCandidateCte(actor.tenantId, query.studentId);
    const pageFilter = duplicateCandidatePageFilter({
      tenantId: actor.tenantId,
      status,
      confidence,
      search,
    });
    const now = new Date();
    const { start, end } = nepalDayBounds(now);

    const [rows, mergedToday] = await Promise.all([
      this.prisma.$queryRaw<DuplicateCandidatePairRow[]>(Prisma.sql`
        ${candidateCte},
        filtered_candidates AS (
          SELECT e.*
          FROM enriched_candidates e
          WHERE TRUE
            ${pageFilter}
        ),
        candidate_stats AS (
          SELECT
            (
              SELECT COUNT(*)::bigint
              FROM filtered_candidates
            ) AS "total",
            COUNT(*) FILTER (
              WHERE e."reviewState" = 'PENDING'
            )::bigint AS "pending",
            COUNT(*) FILTER (
              WHERE e."reviewState" = 'PENDING'
                AND e."confidence" = 'HIGH'
            )::bigint AS "highConfidence",
            COUNT(*) FILTER (
              WHERE e."reviewState" = 'NOT_DUPLICATE'
            )::bigint AS "resolvedNotDuplicate"
          FROM enriched_candidates e
        )
        SELECT
          page_candidate."sourceStudentId",
          page_candidate."candidateStudentId",
          page_candidate."score",
          page_candidate."confidence",
          page_candidate."reasons",
          page_candidate."identityFingerprint",
          page_candidate."reviewState",
          page_candidate."reviewId",
          page_candidate."reviewStatus",
          page_candidate."reviewReason",
          page_candidate."reviewIdentityChanged",
          page_candidate."reviewedById",
          page_candidate."reviewedAt",
          page_candidate."reopenedById",
          page_candidate."reopenedAt",
          page_candidate."reopenReason",
          stats."total",
          stats."pending",
          stats."highConfidence",
          stats."resolvedNotDuplicate"
        FROM candidate_stats stats
        LEFT JOIN LATERAL (
          SELECT filtered.*
          FROM filtered_candidates filtered
          ORDER BY
            filtered."score" DESC,
            filtered."sourceStudentId" ASC,
            filtered."candidateStudentId" ASC
          LIMIT ${limit}
          OFFSET ${offset}
        ) page_candidate ON TRUE
      `),
      this.prisma.studentMergeHistory.count({
        where: {
          tenantId: actor.tenantId,
          mergedAt: {
            gte: start,
            lt: end,
          },
        },
      }),
    ]);

    const candidateRows = rows.filter(
      (row): row is ResolvedDuplicateCandidatePairRow =>
        row.sourceStudentId !== null &&
        row.candidateStudentId !== null &&
        row.score !== null &&
        row.confidence !== null &&
        row.reasons !== null &&
        row.identityFingerprint !== null &&
        row.reviewState !== null,
    );

    const studentIds = [
      ...new Set(
        candidateRows.flatMap((row) => [
          row.sourceStudentId,
          row.candidateStudentId,
        ]),
      ),
    ];
    const students =
      studentIds.length === 0
        ? []
        : await this.prisma.student.findMany({
            where: {
              tenantId: actor.tenantId,
              id: { in: studentIds },
            },
            select: candidateStudentSelect,
          });
    const studentsById = new Map(
      students.map((student) => [student.id, student]),
    );
    const candidates = candidateRows
      .map((row) =>
        this.toCandidate(
          row,
          studentsById.get(row.sourceStudentId),
          studentsById.get(row.candidateStudentId),
        ),
      )
      .filter(
        (candidate): candidate is StudentDuplicateCandidate =>
          candidate !== null,
      );
    const stats = rows[0];
    const total = Number(stats?.total ?? 0n);

    return {
      candidates,
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      status,
      reviewedStudentId: query.studentId ?? null,
      filters: {
        studentId: query.studentId ?? null,
        search,
        confidence,
        status,
      },
      summary: {
        pending: Number(stats?.pending ?? 0n),
        highConfidence: Number(stats?.highConfidence ?? 0n),
        resolvedNotDuplicate: Number(stats?.resolvedNotDuplicate ?? 0n),
        mergedToday,
        asOf: now.toISOString(),
      },
    };
  }

  async markNotDuplicate(
    dto: MarkDuplicateStudentPairNotDuplicateDto,
    actor: AuthContext,
  ) {
    const [firstStudentId, secondStudentId] = canonicalStudentPair(
      dto.studentOneId,
      dto.studentTwoId,
    );
    const pair = await this.findCandidatePair(
      actor.tenantId,
      firstStudentId,
      secondStudentId,
    );

    if (!pair) {
      throw new BadRequestException(
        'These student records are no longer an active duplicate candidate',
      );
    }

    const reason = dto.reason.trim();
    const now = new Date();
    const review = await this.prisma.$transaction(
      async (tx) => {
        const transactionalPair = await this.findCandidatePair(
          actor.tenantId,
          firstStudentId,
          secondStudentId,
          tx,
        );

        if (!transactionalPair) {
          throw new ConflictException(
            'These records changed before the review could be saved. Refresh the duplicate queue and try again.',
          );
        }

        const existing = await tx.studentDuplicateReview.findUnique({
          where: {
            tenantId_firstStudentId_secondStudentId: {
              tenantId: actor.tenantId,
              firstStudentId,
              secondStudentId,
            },
          },
        });

        if (
          existing?.status === StudentDuplicateReviewStatus.NOT_DUPLICATE &&
          existing.identityFingerprint ===
            transactionalPair.identityFingerprint &&
          existing.reason === reason
        ) {
          return existing;
        }

        const saved = await tx.studentDuplicateReview.upsert({
          where: {
            tenantId_firstStudentId_secondStudentId: {
              tenantId: actor.tenantId,
              firstStudentId,
              secondStudentId,
            },
          },
          create: {
            tenantId: actor.tenantId,
            firstStudentId,
            secondStudentId,
            status: StudentDuplicateReviewStatus.NOT_DUPLICATE,
            reason,
            identityFingerprint: transactionalPair.identityFingerprint,
            reviewedById: actor.userId,
            reviewedAt: now,
          },
          update: {
            status: StudentDuplicateReviewStatus.NOT_DUPLICATE,
            reason,
            identityFingerprint: transactionalPair.identityFingerprint,
            reviewedById: actor.userId,
            reviewedAt: now,
            reopenedById: null,
            reopenedAt: null,
            reopenReason: null,
          },
        });

        await this.auditService.record(
          {
            action: 'mark_not_duplicate',
            resource: 'student_duplicate_review',
            tenantId: actor.tenantId,
            userId: actor.userId,
            resourceId: saved.id,
            before: existing
              ? {
                  status: existing.status,
                  reason: existing.reason,
                  identityFingerprint: existing.identityFingerprint,
                }
              : undefined,
            after: {
              firstStudentId,
              secondStudentId,
              status: saved.status,
              reason: saved.reason,
              identityFingerprint: saved.identityFingerprint,
            },
          },
          tx,
        );

        return saved;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    return {
      reviewState: 'NOT_DUPLICATE' as const,
      review: toReviewMetadata(review),
    };
  }

  async reopenReview(
    reviewId: string,
    dto: ReopenDuplicateStudentReviewDto,
    actor: AuthContext,
  ) {
    const reason = dto.reason.trim();
    const now = new Date();
    const review = await this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.studentDuplicateReview.findFirst({
          where: {
            id: reviewId,
            tenantId: actor.tenantId,
          },
        });

        if (!existing) {
          throw new NotFoundException(
            'Duplicate review was not found in this school',
          );
        }

        const pair = await this.findCandidatePair(
          actor.tenantId,
          existing.firstStudentId,
          existing.secondStudentId,
          tx,
        );

        if (!pair) {
          throw new ConflictException(
            'These records are no longer an active duplicate candidate',
          );
        }

        if (
          existing.status === StudentDuplicateReviewStatus.REOPENED &&
          existing.reopenReason === reason
        ) {
          return existing;
        }

        const saved = await tx.studentDuplicateReview.update({
          where: { id: existing.id },
          data: {
            status: StudentDuplicateReviewStatus.REOPENED,
            reopenedById: actor.userId,
            reopenedAt: now,
            reopenReason: reason,
          },
        });

        await this.auditService.record(
          {
            action: 'reopen',
            resource: 'student_duplicate_review',
            tenantId: actor.tenantId,
            userId: actor.userId,
            resourceId: saved.id,
            before: {
              status: existing.status,
              reopenReason: existing.reopenReason,
            },
            after: {
              status: saved.status,
              reopenReason: saved.reopenReason,
              firstStudentId: saved.firstStudentId,
              secondStudentId: saved.secondStudentId,
            },
          },
          tx,
        );

        return saved;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    return {
      reviewState: 'PENDING' as const,
      review: toReviewMetadata(review),
    };
  }

  private async findCandidatePair(
    tenantId: string,
    firstStudentId: string,
    secondStudentId: string,
    client: Pick<PrismaService, '$queryRaw'> | Prisma.TransactionClient = this
      .prisma,
  ) {
    const candidateCte = duplicateCandidateCte(tenantId);
    const rows = await client.$queryRaw<DuplicateCandidatePairRow[]>(
      Prisma.sql`
        ${candidateCte}
        SELECT
          e."sourceStudentId",
          e."candidateStudentId",
          e."score",
          e."confidence",
          e."reasons",
          e."identityFingerprint",
          e."reviewState",
          e."reviewId",
          e."reviewStatus",
          e."reviewReason",
          e."reviewIdentityChanged",
          e."reviewedById",
          e."reviewedAt",
          e."reopenedById",
          e."reopenedAt",
          e."reopenReason"
        FROM enriched_candidates e
        WHERE e."sourceStudentId" = ${firstStudentId}
          AND e."candidateStudentId" = ${secondStudentId}
        LIMIT 1
      `,
    );

    const row = rows[0];

    if (
      !row ||
      row.sourceStudentId === null ||
      row.candidateStudentId === null ||
      row.score === null ||
      row.confidence === null ||
      row.reasons === null ||
      row.identityFingerprint === null ||
      row.reviewState === null
    ) {
      return null;
    }

    return row as ResolvedDuplicateCandidatePairRow;
  }

  private toCandidate(
    row: ResolvedDuplicateCandidatePairRow,
    source: DuplicateCandidateStudentRecord | undefined,
    candidate: DuplicateCandidateStudentRecord | undefined,
  ): StudentDuplicateCandidate | null {
    if (!source || !candidate) {
      return null;
    }

    return {
      sourceStudent: summarizeCandidateStudent(source),
      candidateStudent: summarizeCandidateStudent(candidate),
      score: row.score,
      confidence: row.confidence,
      reasons: row.reasons,
      blockedReason:
        row.score < 40
          ? 'Candidate needs stronger matching evidence before merge preview.'
          : null,
      reviewState: row.reviewState,
      review:
        row.reviewId && row.reviewStatus && row.reviewReason && row.reviewedAt
          ? {
              id: row.reviewId,
              status: row.reviewStatus,
              reason: row.reviewReason,
              identityChanged: row.reviewIdentityChanged ?? false,
              reviewedById: row.reviewedById,
              reviewedAt: row.reviewedAt.toISOString(),
              reopenedById: row.reopenedById,
              reopenedAt: row.reopenedAt?.toISOString() ?? null,
              reopenReason: row.reopenReason,
            }
          : null,
    };
  }
}

function duplicateCandidateCte(tenantId: string, studentId?: string) {
  const studentFilter = studentId
    ? Prisma.sql`
        AND (
          p."sourceStudentId" = ${studentId}
          OR p."candidateStudentId" = ${studentId}
        )
      `
    : Prisma.empty;

  return Prisma.sql`
    WITH active_students AS (
      SELECT
        s."id",
        s."studentSystemId",
        s."firstNameEn",
        s."lastNameEn",
        s."firstNameNp",
        s."lastNameNp",
        s."dateOfBirth",
        s."admissionNumber",
        s."previousSchool",
        ARRAY(
          SELECT DISTINCT name_part."value"
          FROM regexp_split_to_table(
            lower(btrim(concat_ws(' ', s."firstNameEn", s."lastNameEn"))),
            '\\s+'
          ) name_part("value")
          WHERE name_part."value" <> ''
          ORDER BY name_part."value"
        ) AS "englishNameTokens",
        ARRAY(
          SELECT DISTINCT name_part."value"
          FROM regexp_split_to_table(
            lower(
              btrim(
                concat_ws(' ', s."firstNameNp", s."lastNameNp")
              )
            ),
            '\\s+'
          ) name_part("value")
          WHERE name_part."value" <> ''
          ORDER BY name_part."value"
        ) AS "nepaliNameTokens"
      FROM "Student" s
      WHERE s."tenantId" = ${tenantId}
        AND s."lifecycleStatus" IN ('ACTIVE', 'ARCHIVED')
    ),
    guardian_contact_values AS (
      SELECT
        sg."studentId",
        'PHONE'::text AS "kind",
        RIGHT(
          regexp_replace(contact."value", '[^0-9]', '', 'g'),
          10
        ) AS "value"
      FROM "StudentGuardian" sg
      INNER JOIN "Guardian" g
        ON g."id" = sg."guardianId"
       AND g."tenantId" = sg."tenantId"
      CROSS JOIN LATERAL (
        VALUES (g."primaryPhone"), (g."secondaryPhone")
      ) contact("value")
      WHERE sg."tenantId" = ${tenantId}
        AND contact."value" IS NOT NULL
        AND btrim(contact."value") <> ''
        AND length(
          regexp_replace(contact."value", '[^0-9]', '', 'g')
        ) >= 7

      UNION ALL

      SELECT
        sg."studentId",
        'EMAIL'::text AS "kind",
        lower(btrim(g."email")) AS "value"
      FROM "StudentGuardian" sg
      INNER JOIN "Guardian" g
        ON g."id" = sg."guardianId"
       AND g."tenantId" = sg."tenantId"
      WHERE sg."tenantId" = ${tenantId}
        AND g."email" IS NOT NULL
        AND btrim(g."email") <> ''
    ),
    guardian_signals AS (
      SELECT
        contacts."studentId",
        COALESCE(
          array_agg(DISTINCT contacts."value" ORDER BY contacts."value")
            FILTER (WHERE contacts."kind" = 'PHONE'),
          ARRAY[]::text[]
        ) AS "phones",
        COALESCE(
          array_agg(DISTINCT contacts."value" ORDER BY contacts."value")
            FILTER (WHERE contacts."kind" = 'EMAIL'),
          ARRAY[]::text[]
        ) AS "emails"
      FROM guardian_contact_values contacts
      GROUP BY contacts."studentId"
    ),
    candidate_pair_ids AS (
      SELECT a."id" AS "sourceStudentId", b."id" AS "candidateStudentId"
      FROM active_students a
      INNER JOIN active_students b
        ON a."id" < b."id"
       AND a."dateOfBirth" = b."dateOfBirth"

      UNION

      SELECT a."id", b."id"
      FROM active_students a
      INNER JOIN active_students b
        ON a."id" < b."id"
       AND a."admissionNumber" IS NOT NULL
       AND btrim(a."admissionNumber") <> ''
       AND lower(btrim(a."admissionNumber")) =
           lower(btrim(b."admissionNumber"))

      UNION

      SELECT a."id", b."id"
      FROM active_students a
      INNER JOIN active_students b
        ON a."id" < b."id"
       AND cardinality(a."englishNameTokens") > 0
       AND a."englishNameTokens" = b."englishNameTokens"

      UNION

      SELECT a."id", b."id"
      FROM active_students a
      INNER JOIN active_students b
        ON a."id" < b."id"
       AND a."firstNameNp" IS NOT NULL
       AND a."lastNameNp" IS NOT NULL
       AND cardinality(a."nepaliNameTokens") > 0
       AND a."nepaliNameTokens" = b."nepaliNameTokens"

      UNION

      SELECT
        first_contact."studentId",
        second_contact."studentId"
      FROM guardian_contact_values first_contact
      INNER JOIN guardian_contact_values second_contact
        ON first_contact."studentId" < second_contact."studentId"
       AND first_contact."kind" = second_contact."kind"
       AND first_contact."value" = second_contact."value"
    ),
    pair_signals AS (
      SELECT
        p."sourceStudentId",
        p."candidateStudentId",
        (
          cardinality(a."englishNameTokens") > 0
          AND a."englishNameTokens" = b."englishNameTokens"
        ) AS "englishNameMatch",
        (
          a."firstNameNp" IS NOT NULL
          AND a."lastNameNp" IS NOT NULL
          AND b."firstNameNp" IS NOT NULL
          AND b."lastNameNp" IS NOT NULL
          AND cardinality(a."nepaliNameTokens") > 0
          AND a."nepaliNameTokens" = b."nepaliNameTokens"
        ) AS "nepaliNameMatch",
        (a."dateOfBirth" = b."dateOfBirth") AS "dateOfBirthMatch",
        (
          a."admissionNumber" IS NOT NULL
          AND b."admissionNumber" IS NOT NULL
          AND btrim(a."admissionNumber") <> ''
          AND lower(btrim(a."admissionNumber")) =
              lower(btrim(b."admissionNumber"))
        ) AS "admissionNumberMatch",
        (
          COALESCE(ga."phones", ARRAY[]::text[])
          && COALESCE(gb."phones", ARRAY[]::text[])
        ) AS "guardianPhoneMatch",
        (
          COALESCE(ga."emails", ARRAY[]::text[])
          && COALESCE(gb."emails", ARRAY[]::text[])
        ) AS "guardianEmailMatch",
        (
          a."previousSchool" IS NOT NULL
          AND b."previousSchool" IS NOT NULL
          AND btrim(a."previousSchool") <> ''
          AND lower(btrim(a."previousSchool")) =
              lower(btrim(b."previousSchool"))
        ) AS "previousSchoolMatch",
        md5(concat_ws(
          '|',
          a."id",
          lower(regexp_replace(btrim(a."firstNameEn"), '\\s+', ' ', 'g')),
          lower(regexp_replace(btrim(a."lastNameEn"), '\\s+', ' ', 'g')),
          COALESCE(lower(btrim(a."firstNameNp")), ''),
          COALESCE(lower(btrim(a."lastNameNp")), ''),
          a."dateOfBirth"::text,
          COALESCE(lower(btrim(a."admissionNumber")), ''),
          COALESCE(lower(btrim(a."previousSchool")), ''),
          array_to_string(COALESCE(ga."phones", ARRAY[]::text[]), ','),
          array_to_string(COALESCE(ga."emails", ARRAY[]::text[]), ','),
          b."id",
          lower(regexp_replace(btrim(b."firstNameEn"), '\\s+', ' ', 'g')),
          lower(regexp_replace(btrim(b."lastNameEn"), '\\s+', ' ', 'g')),
          COALESCE(lower(btrim(b."firstNameNp")), ''),
          COALESCE(lower(btrim(b."lastNameNp")), ''),
          b."dateOfBirth"::text,
          COALESCE(lower(btrim(b."admissionNumber")), ''),
          COALESCE(lower(btrim(b."previousSchool")), ''),
          array_to_string(COALESCE(gb."phones", ARRAY[]::text[]), ','),
          array_to_string(COALESCE(gb."emails", ARRAY[]::text[]), ',')
        )) AS "identityFingerprint"
      FROM candidate_pair_ids p
      INNER JOIN active_students a
        ON a."id" = p."sourceStudentId"
      INNER JOIN active_students b
        ON b."id" = p."candidateStudentId"
      LEFT JOIN guardian_signals ga
        ON ga."studentId" = a."id"
      LEFT JOIN guardian_signals gb
        ON gb."studentId" = b."id"
      WHERE NOT EXISTS (
        SELECT 1
        FROM "SiblingGroupMember" first_sibling
        INNER JOIN "SiblingGroupMember" second_sibling
          ON second_sibling."tenantId" = first_sibling."tenantId"
         AND second_sibling."siblingGroupId" =
             first_sibling."siblingGroupId"
         AND second_sibling."studentId" = p."candidateStudentId"
        WHERE first_sibling."tenantId" = ${tenantId}
          AND first_sibling."studentId" = p."sourceStudentId"
      )
      ${studentFilter}
    ),
    scored_candidates AS (
      SELECT
        signals.*,
        LEAST(
          100,
          CASE WHEN signals."englishNameMatch" THEN 25 ELSE 0 END
          + CASE WHEN signals."nepaliNameMatch" THEN 25 ELSE 0 END
          + CASE WHEN signals."dateOfBirthMatch" THEN 20 ELSE 0 END
          + CASE WHEN signals."admissionNumberMatch" THEN 50 ELSE 0 END
          + CASE WHEN signals."guardianPhoneMatch" THEN 30 ELSE 0 END
          + CASE WHEN signals."guardianEmailMatch" THEN 30 ELSE 0 END
          + CASE WHEN signals."previousSchoolMatch" THEN 10 ELSE 0 END
        )::integer AS "score",
        array_remove(
          ARRAY[
            CASE
              WHEN signals."englishNameMatch" THEN 'Similar student name'
            END,
            CASE
              WHEN signals."nepaliNameMatch"
                THEN 'Similar student Nepali name'
            END,
            CASE
              WHEN signals."dateOfBirthMatch" THEN 'Same date of birth'
            END,
            CASE
              WHEN signals."admissionNumberMatch"
                THEN 'Admission number conflict'
            END,
            CASE
              WHEN signals."guardianPhoneMatch" THEN 'Shared guardian phone'
            END,
            CASE
              WHEN signals."guardianEmailMatch" THEN 'Shared guardian email'
            END,
            CASE
              WHEN signals."previousSchoolMatch" THEN 'Same previous school'
            END
          ],
          NULL
        )::text[] AS "reasons"
      FROM pair_signals signals
    ),
    duplicate_candidates AS (
      SELECT
        scored.*,
        CASE
          WHEN scored."score" >= 70 THEN 'HIGH'
          WHEN scored."score" >= 40 THEN 'MEDIUM'
          ELSE 'LOW'
        END::text AS "confidence"
      FROM scored_candidates scored
      WHERE scored."score" > 0
    ),
    enriched_candidates AS (
      SELECT
        candidate."sourceStudentId",
        candidate."candidateStudentId",
        candidate."score",
        candidate."confidence",
        candidate."reasons",
        candidate."identityFingerprint",
        CASE
          WHEN review."status" = 'NOT_DUPLICATE'
            AND review."identityFingerprint" =
                candidate."identityFingerprint"
            THEN 'NOT_DUPLICATE'
          ELSE 'PENDING'
        END::text AS "reviewState",
        review."id" AS "reviewId",
        review."status" AS "reviewStatus",
        review."reason" AS "reviewReason",
        (
          review."id" IS NOT NULL
          AND review."identityFingerprint" <>
              candidate."identityFingerprint"
        ) AS "reviewIdentityChanged",
        review."reviewedById",
        review."reviewedAt",
        review."reopenedById",
        review."reopenedAt",
        review."reopenReason"
      FROM duplicate_candidates candidate
      LEFT JOIN "StudentDuplicateReview" review
        ON review."tenantId" = ${tenantId}
       AND review."firstStudentId" = candidate."sourceStudentId"
       AND review."secondStudentId" = candidate."candidateStudentId"
    )
  `;
}

function duplicateCandidatePageFilter(input: {
  tenantId: string;
  status: 'PENDING' | 'NOT_DUPLICATE';
  confidence: 'ALL' | 'LOW' | 'MEDIUM' | 'HIGH';
  search: string | null;
}) {
  const confidenceFilter =
    input.confidence === 'ALL'
      ? Prisma.empty
      : Prisma.sql`AND e."confidence" = ${input.confidence}`;
  const searchFilter = input.search
    ? Prisma.sql`
        AND EXISTS (
          SELECT 1
          FROM "Student" search_student
          WHERE search_student."tenantId" = ${input.tenantId}
            AND search_student."id" IN (
              e."sourceStudentId",
              e."candidateStudentId"
            )
            AND (
              search_student."studentSystemId" ILIKE ${`%${escapeLike(input.search)}%`} ESCAPE '\\'
              OR search_student."firstNameEn" ILIKE ${`%${escapeLike(input.search)}%`} ESCAPE '\\'
              OR search_student."lastNameEn" ILIKE ${`%${escapeLike(input.search)}%`} ESCAPE '\\'
              OR CONCAT(
                search_student."firstNameEn",
                ' ',
                search_student."lastNameEn"
              ) ILIKE ${`%${escapeLike(input.search)}%`} ESCAPE '\\'
              OR COALESCE(search_student."admissionNumber", '')
                ILIKE ${`%${escapeLike(input.search)}%`} ESCAPE '\\'
            )
        )
      `
    : Prisma.empty;

  return Prisma.sql`
    AND e."reviewState" = ${input.status}
    ${confidenceFilter}
    ${searchFilter}
  `;
}

function canonicalStudentPair(studentOneId: string, studentTwoId: string) {
  if (studentOneId === studentTwoId) {
    throw new BadRequestException(
      'Duplicate review requires two different student records',
    );
  }

  return [studentOneId, studentTwoId].sort() as [string, string];
}

function summarizeCandidateStudent(
  student: DuplicateCandidateStudentRecord,
): StudentDuplicateCandidateStudent {
  return {
    id: student.id,
    studentSystemId: student.studentSystemId,
    fullNameEn: `${student.firstNameEn} ${student.lastNameEn}`.trim(),
    dateOfBirth: student.dateOfBirth.toISOString().slice(0, 10),
    admissionNumber: student.admissionNumber,
    previousSchool: student.previousSchool,
    lifecycleStatus: student.lifecycleStatus,
    className: student.class.name,
    sectionName: student.sectionRef?.name ?? null,
    guardianPhones: [
      ...new Set(
        student.guardianLinks.flatMap((link) =>
          [link.guardian.primaryPhone, link.guardian.secondaryPhone].filter(
            (phone): phone is string => Boolean(phone?.trim()),
          ),
        ),
      ),
    ],
  };
}

function toReviewMetadata(review: {
  id: string;
  status: StudentDuplicateReviewStatus;
  reason: string;
  reviewedById: string | null;
  reviewedAt: Date;
  reopenedById: string | null;
  reopenedAt: Date | null;
  reopenReason: string | null;
}): StudentDuplicateReviewMetadata {
  return {
    id: review.id,
    status: review.status,
    reason: review.reason,
    identityChanged: false,
    reviewedById: review.reviewedById,
    reviewedAt: review.reviewedAt.toISOString(),
    reopenedById: review.reopenedById,
    reopenedAt: review.reopenedAt?.toISOString() ?? null,
    reopenReason: review.reopenReason,
  };
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, '\\$&');
}

function nepalDayBounds(now: Date) {
  const nepalOffsetMs = (5 * 60 + 45) * 60 * 1000;
  const nepalNow = new Date(now.getTime() + nepalOffsetMs);
  const startUtc =
    Date.UTC(
      nepalNow.getUTCFullYear(),
      nepalNow.getUTCMonth(),
      nepalNow.getUTCDate(),
    ) - nepalOffsetMs;

  return {
    start: new Date(startUtc),
    end: new Date(startUtc + 24 * 60 * 60 * 1000),
  };
}
