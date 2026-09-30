import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { EntitlementState } from '@schoolos/core';
import type { AuthContext } from '../auth/auth.types';
import { isTeacherOnly } from '../common/security/parent-scope';
import { PrismaService } from '../prisma/prisma.service';
import { TeacherScopeService } from '../teacher-scope/teacher-scope.service';
import { resolveStudentActorScope } from './student-actor-scope';
import {
  authorizeStudentProfile,
  authorizeSupportStudentProfile,
} from './student-profile.projection';

export interface StudentSearchResult {
  id: string;
  studentSystemId: string;
  fullNameEn: string;
  admissionNumber: string | null;
  className: string;
  sectionName: string | null;
  rollNumber: number | null;
  /**
   * Present only when the row's `guardianContacts` section is authorized
   * (same rule as GET /students/:id) and the relationship is ACTIVE +
   * VERIFIED within its effective period.
   */
  guardianName?: string | null;
  guardianPhone?: string | null;
  lifecycleStatus: string;
}

interface StudentSearchRow {
  id: string;
  classId: string;
  sectionId: string | null;
  studentSystemId: string;
  firstNameEn: string;
  lastNameEn: string;
  admissionNumber: string | null;
  rollNumber: number | null;
  lifecycleStatus: string;
  className: string;
  sectionName: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
}

const SEARCH_LIMIT = 20;

/**
 * Global/topbar student search (AGENTS.md §19.3: global search requires a
 * server-side authorization-aware projection).
 *
 * - Scope: the same actor scope as the directory (parents → linked children,
 *   teacher-only → live assigned sections, others → tenant), applied inside
 *   the SQL so a LIMIT never drops in-scope matches.
 * - Projection: guardian contact follows the Student profile section rules.
 *   Phone matching and disclosure consider only ACTIVE + VERIFIED
 *   relationships inside their effective period.
 */
@Injectable()
export class StudentSearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teacherScope: TeacherScopeService,
  ) {}

  async searchStudents(
    query: string | undefined,
    actor: AuthContext,
    entitlementState: EntitlementState = {
      module: 'students',
      state: 'UNKNOWN',
    },
  ): Promise<StudentSearchResult[]> {
    const normalizedQuery = query?.trim();

    if (!normalizedQuery || normalizedQuery.length < 2) {
      return [];
    }

    const scope = await resolveStudentActorScope(
      this.prisma,
      this.teacherScope,
      actor,
    );
    if (
      (scope.kind === 'students' && scope.studentIds.length === 0) ||
      (scope.kind === 'sections' && scope.sectionIds.length === 0)
    ) {
      return [];
    }
    const scopeClause =
      scope.kind === 'students'
        ? Prisma.sql`AND s."id" IN (${Prisma.join(scope.studentIds)})`
        : scope.kind === 'sections'
          ? Prisma.sql`AND s."sectionId" IN (${Prisma.join(scope.sectionIds)})`
          : Prisma.empty;

    const likeQuery = `%${normalizedQuery.replace(/[%_]/g, '\\$&')}%`;
    const now = new Date();

    const rows = await this.prisma.$queryRaw<StudentSearchRow[]>(Prisma.sql`
      SELECT
        s."id",
        s."classId",
        s."sectionId",
        s."studentSystemId",
        s."firstNameEn",
        s."lastNameEn",
        s."admissionNumber",
        s."rollNumber",
        s."lifecycleStatus"::text AS "lifecycleStatus",
        c."name" AS "className",
        sec."name" AS "sectionName",
        primary_guardian."fullName" AS "guardianName",
        primary_guardian."primaryPhone" AS "guardianPhone"
      FROM "Student" s
      INNER JOIN "Class" c
        ON c."id" = s."classId"
       AND c."tenantId" = s."tenantId"
      LEFT JOIN "Section" sec
        ON sec."id" = s."sectionId"
       AND sec."tenantId" = s."tenantId"
      LEFT JOIN LATERAL (
        SELECT g."fullName", g."primaryPhone"
        FROM "StudentGuardian" sg
        INNER JOIN "Guardian" g
          ON g."id" = sg."guardianId"
         AND g."tenantId" = sg."tenantId"
        WHERE sg."tenantId" = s."tenantId"
          AND sg."studentId" = s."id"
          AND sg."status" = 'ACTIVE'
          AND sg."verificationStatus" = 'VERIFIED'
          AND sg."effectiveFrom" <= ${now}
          AND (sg."effectiveUntil" IS NULL OR sg."effectiveUntil" > ${now})
        ORDER BY sg."isPrimary" DESC, sg."createdAt" ASC
        LIMIT 1
      ) primary_guardian ON TRUE
      WHERE s."tenantId" = ${actor.tenantId}
        ${scopeClause}
        AND (
          s."studentSystemId" ILIKE ${likeQuery} ESCAPE '\\'
          OR s."firstNameEn" ILIKE ${likeQuery} ESCAPE '\\'
          OR s."lastNameEn" ILIKE ${likeQuery} ESCAPE '\\'
          OR CONCAT(s."firstNameEn", ' ', s."lastNameEn") ILIKE ${likeQuery} ESCAPE '\\'
          OR COALESCE(s."admissionNumber", '') ILIKE ${likeQuery} ESCAPE '\\'
          OR EXISTS (
            SELECT 1
            FROM "StudentGuardian" sg
            INNER JOIN "Guardian" g
              ON g."id" = sg."guardianId"
             AND g."tenantId" = sg."tenantId"
            WHERE sg."tenantId" = s."tenantId"
              AND sg."studentId" = s."id"
              AND sg."status" = 'ACTIVE'
              AND sg."verificationStatus" = 'VERIFIED'
              AND sg."effectiveFrom" <= ${now}
              AND (sg."effectiveUntil" IS NULL OR sg."effectiveUntil" > ${now})
              AND g."primaryPhone" ILIKE ${likeQuery} ESCAPE '\\'
          )
        )
      ORDER BY
        CASE
          WHEN s."studentSystemId" ILIKE ${normalizedQuery + '%'} THEN 0
          WHEN COALESCE(s."admissionNumber", '') ILIKE ${normalizedQuery + '%'} THEN 1
          ELSE 2
        END,
        s."firstNameEn" ASC,
        s."lastNameEn" ASC
      LIMIT ${SEARCH_LIMIT}
    `);

    const teacherOnly = isTeacherOnly(actor);
    return rows.map((row) => {
      const authorization = actor.isSupportOverride
        ? authorizeSupportStudentProfile({
            lifecycleState: row.lifecycleStatus,
            entitlementState,
          })
        : authorizeStudentProfile({
            actor,
            resource: {
              TENANT: actor.tenantId,
              STUDENT: row.id,
              CLASS: row.classId,
              ...(row.sectionId ? { SECTION: row.sectionId } : {}),
            },
            teacherAssignmentVerified: teacherOnly,
            lifecycleState: row.lifecycleStatus,
            entitlementState,
          });
      const result: StudentSearchResult = {
        id: row.id,
        studentSystemId: row.studentSystemId,
        fullNameEn: `${row.firstNameEn} ${row.lastNameEn}`.trim(),
        admissionNumber: row.admissionNumber,
        className: row.className,
        sectionName: row.sectionName,
        rollNumber: row.rollNumber,
        lifecycleStatus: row.lifecycleStatus,
      };
      if (authorization.authorizedSections.includes('guardianContacts')) {
        result.guardianName = row.guardianName;
        result.guardianPhone = row.guardianPhone;
      }
      return result;
    });
  }
}
