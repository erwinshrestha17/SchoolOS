import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

export interface StudentSearchResult {
  id: string;
  studentSystemId: string;
  fullNameEn: string;
  admissionNumber: string | null;
  className: string;
  sectionName: string | null;
  rollNumber: number | null;
  guardianName: string | null;
  guardianPhone: string | null;
  lifecycleStatus: string;
}

interface StudentSearchRow {
  id: string;
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

@Injectable()
export class StudentSearchService {
  constructor(private readonly prisma: PrismaService) {}

  async searchStudents(
    query: string | undefined,
    actor: AuthContext,
  ): Promise<StudentSearchResult[]> {
    const normalizedQuery = query?.trim();

    if (!normalizedQuery || normalizedQuery.length < 2) {
      return [];
    }

    const likeQuery = `%${normalizedQuery.replace(/[%_]/g, '\\$&')}%`;

    const rows = await this.prisma.$queryRaw<StudentSearchRow[]>(Prisma.sql`
      SELECT
        s."id",
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
        ORDER BY sg."isPrimary" DESC, sg."createdAt" ASC
        LIMIT 1
      ) primary_guardian ON TRUE
      WHERE s."tenantId" = ${actor.tenantId}
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
      LIMIT 20
    `);

    return rows.map((row) => ({
      id: row.id,
      studentSystemId: row.studentSystemId,
      fullNameEn: `${row.firstNameEn} ${row.lastNameEn}`.trim(),
      admissionNumber: row.admissionNumber,
      className: row.className,
      sectionName: row.sectionName,
      rollNumber: row.rollNumber,
      guardianName: row.guardianName,
      guardianPhone: row.guardianPhone,
      lifecycleStatus: row.lifecycleStatus,
    }));
  }
}
