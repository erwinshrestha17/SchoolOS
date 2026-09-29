import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { authTestDatabaseUrl } from './helpers/auth-test-isolation';

const describeDatabase = authTestDatabaseUrl ? describe : describe.skip;

describeDatabase(
  'P0-N2/N3/N4 cross-phase foundation (isolated PostgreSQL)',
  () => {
    let pool: Pool;
    let db: PoolClient;
    const platformTenantId = randomUUID();
    const schoolTenantId = randomUUID();
    const otherTenantId = randomUUID();
    const platformReviewerId = randomUUID();
    const platformApproverId = randomUUID();
    const schoolReviewerId = randomUUID();
    const schoolApproverId = randomUUID();
    const teacherUserId = randomUUID();
    const staffId = randomUUID();
    const employmentId = randomUUID();
    const profileId = randomUUID();
    const qualificationId = randomUUID();
    const licenceId = randomUUID();
    const policyId = randomUUID();
    const policyKey = `synthetic.teacher-eligibility.${randomUUID()}`;
    const assessmentId = randomUUID();
    const classId = randomUUID();
    const sectionId = randomUUID();
    const subjectId = randomUUID();
    const yearId = randomUUID();
    const assignmentId = randomUUID();
    const now = new Date();
    const localLevelId = 999001;
    const districtId = 999001;
    const provinceId = 999001;

    async function rejected(sql: string, values: unknown[] = []) {
      await db.query('SAVEPOINT rejected_cross_phase_write');
      try {
        await expect(db.query(sql, values)).rejects.toThrow();
      } finally {
        await db.query('ROLLBACK TO SAVEPOINT rejected_cross_phase_write');
        await db.query('RELEASE SAVEPOINT rejected_cross_phase_write');
      }
    }

    async function approvePolicy(
      id: string,
      reviewer: string,
      approver: string,
    ) {
      await db.query(
        `UPDATE "NepalHrPolicyVersion" SET "reviewStatus" = 'IN_REVIEW' WHERE "id" = $1`,
        [id],
      );
      await db.query(
        `UPDATE "NepalHrPolicyVersion" SET "reviewStatus" = 'REVIEWED',
        "reviewedById" = $2, "reviewedAt" = now() WHERE "id" = $1`,
        [id, reviewer],
      );
      await db.query(
        `UPDATE "NepalHrPolicyVersion" SET "reviewStatus" = 'APPROVED',
        "approvedById" = $2, "approvedAt" = now() WHERE "id" = $1`,
        [id, approver],
      );
    }

    async function live(at: Date, id = assessmentId) {
      const result = await db.query<{ allowed: boolean }>(
        'SELECT schoolos_teacher_eligibility_live($1, $2, $3, $4, $5, $6) AS allowed',
        [schoolTenantId, staffId, id, at, classId, subjectId],
      );
      return result.rows[0]?.allowed;
    }

    beforeAll(async () => {
      pool = new Pool({ connectionString: authTestDatabaseUrl });
      db = await pool.connect();
      await db.query('BEGIN');
      await db.query(
        `INSERT INTO "Tenant" ("id", "name", "slug", "securityDomain") VALUES
        ($1, 'Synthetic platform', $2, 'PLATFORM'),
        ($3, 'Synthetic school', $4, 'SCHOOL'),
        ($5, 'Other synthetic school', $6, 'SCHOOL')`,
        [
          platformTenantId,
          `p0n-platform-${platformTenantId}`,
          schoolTenantId,
          `p0n-school-${schoolTenantId}`,
          otherTenantId,
          `p0n-other-${otherTenantId}`,
        ],
      );
      await db.query(
        `INSERT INTO "User" ("id", "tenantId", "status") VALUES
        ($1, $2, 'ACTIVE'), ($3, $4, 'ACTIVE'), ($5, $6, 'ACTIVE'),
        ($7, $8, 'ACTIVE'), ($9, $10, 'ACTIVE')`,
        [
          platformReviewerId,
          platformTenantId,
          platformApproverId,
          platformTenantId,
          schoolReviewerId,
          schoolTenantId,
          schoolApproverId,
          schoolTenantId,
          teacherUserId,
          schoolTenantId,
        ],
      );
      await db.query(
        `INSERT INTO "NepalProvince" ("id", "nameEn", "nameNe", "updatedAt") VALUES ($1, 'Synthetic Province', 'नमुना प्रदेश', now())`,
        [provinceId],
      );
      await db.query(
        `INSERT INTO "NepalDistrict" ("id", "provinceId", "nameEn", "nameNe", "updatedAt") VALUES ($1, $2, 'Synthetic District', 'नमुना जिल्ला', now())`,
        [districtId, provinceId],
      );
      await db.query(
        `INSERT INTO "NepalLocalLevelType" ("id", "code", "slug", "nameEn", "nameNe") VALUES ($1, 'SYNTHETIC', 'synthetic-p0n', 'Synthetic', 'नमुना')`,
        [localLevelId],
      );
      await db.query(
        `INSERT INTO "NepalLocalLevel" ("id", "districtId", "typeId", "nameEn", "nameNe", "updatedAt") VALUES ($1, $2, $3, 'Synthetic Municipality', 'नमुना नगरपालिका', now())`,
        [localLevelId, districtId, localLevelId],
      );
      await db.query(
        `INSERT INTO "Staff" ("id", "tenantId", "userId", "employeeId", "firstName", "lastName", "dateOfBirth", "gender", "address", "joiningDate", "contractType", "updatedAt")
        VALUES ($1, $2, $3, $4, 'Synthetic', 'Teacher', '1990-01-01', 'OTHER', 'Synthetic address', '2026-01-01', 'PERMANENT', now())`,
        [staffId, schoolTenantId, teacherUserId, `SYN-${staffId}`],
      );
      await db.query(
        `INSERT INTO "AcademicYear" ("id", "tenantId", "name", "startsOn", "endsOn", "updatedAt")
        VALUES ($1, $2, 'Synthetic 2026', '2026-01-01', '2027-12-31', now())`,
        [yearId, schoolTenantId],
      );
      await db.query(
        `INSERT INTO "Class" ("id", "tenantId", "name", "level") VALUES ($1, $2, 'Synthetic Grade 8', 8)`,
        [classId, schoolTenantId],
      );
      await db.query(
        `INSERT INTO "Section" ("id", "tenantId", "classId", "name", "updatedAt") VALUES ($1, $2, $3, 'A', now())`,
        [sectionId, schoolTenantId, classId],
      );
      await db.query(
        `INSERT INTO "Subject" ("id", "tenantId", "classId", "name", "code", "type") VALUES ($1, $2, $3, 'Synthetic Mathematics', 'SYN-MATH', 'CORE')`,
        [subjectId, schoolTenantId, classId],
      );
      await db.query(
        `INSERT INTO "NepalHrPolicyVersion" ("id", "policyKey", "version", "kind", "scope", "isMandatoryBaseline", "requiresQualification", "requiresLicence", "minimumMonthlyNpr", "payload", "effectiveFrom", "sourceTitle", "sourceUri")
        VALUES ($1, $2, 1, 'TEACHER_PROFESSIONAL_ELIGIBILITY', 'NATIONAL', true, true, true, 30000, '{}'::jsonb, '2026-01-01', 'Synthetic policy fixture', 'https://example.test/synthetic-policy')`,
        [policyId, policyKey],
      );
      await approvePolicy(policyId, platformReviewerId, platformApproverId);
      await db.query(
        `INSERT INTO "StaffEmployment" ("id", "tenantId", "staffId", "employmentType", "postCategoryCode", "schoolTypeCode", "localLevelId", "effectiveFrom")
        VALUES ($1, $2, $3, 'PERMANENT', 'TEACHER', 'SYNTHETIC', $4, '2026-01-01')`,
        [employmentId, schoolTenantId, staffId, localLevelId],
      );
      await db.query(
        `UPDATE "StaffEmployment" SET "status" = 'VERIFIED', "verifiedById" = $2, "verifiedAt" = now() WHERE "id" = $1`,
        [employmentId, schoolReviewerId],
      );
      await db.query(
        `INSERT INTO "TeacherProfile" ("id", "tenantId", "staffId", "effectiveFrom") VALUES ($1, $2, $3, '2026-01-01')`,
        [profileId, schoolTenantId, staffId],
      );
      await db.query(
        `INSERT INTO "TeacherQualificationEvidence" ("id", "tenantId", "profileId", "qualification", "subjectCode", "levelCode", "validFrom", "sourceUri")
        VALUES ($1, $2, $3, 'Synthetic qualification', 'SYN-MATH', '8', '2026-01-01', 'https://example.test/synthetic-qualification')`,
        [qualificationId, schoolTenantId, profileId],
      );
      await db.query(
        `UPDATE "TeacherQualificationEvidence" SET "status" = 'VERIFIED', "verifiedById" = $2, "verifiedAt" = now() WHERE "id" = $1`,
        [qualificationId, schoolReviewerId],
      );
      await db.query(
        `INSERT INTO "TeachingLicenceEvidence" ("id", "tenantId", "profileId", "authorityCode", "externalReference", "subjectCode", "levelCode", "validFrom", "sourceUri")
        VALUES ($1, $2, $3, 'SYNTHETIC', 'TEST-ONLY', 'SYN-MATH', '8', '2026-01-01', 'https://example.test/synthetic-licence')`,
        [licenceId, schoolTenantId, profileId],
      );
      await db.query(
        `UPDATE "TeachingLicenceEvidence" SET "status" = 'VERIFIED', "verifiedById" = $2, "verifiedAt" = now() WHERE "id" = $1`,
        [licenceId, schoolReviewerId],
      );
      await db.query(
        `INSERT INTO "TeacherEligibilityAssessment" ("id", "tenantId", "staffId", "profileId", "employmentId", "policyVersionId", "qualificationId", "licenceId", "outcome", "reasonCode", "evaluatedAt", "evaluatedById")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ELIGIBLE', 'POLICY_REQUIREMENTS_SATISFIED', $9, $10)`,
        [
          assessmentId,
          schoolTenantId,
          staffId,
          profileId,
          employmentId,
          policyId,
          qualificationId,
          licenceId,
          now,
          schoolApproverId,
        ],
      );
      await db.query(
        `INSERT INTO "TeacherAssignment" ("id", "tenantId", "academicYearId", "staffId", "assignmentType", "classId", "sectionId", "subjectId", "effectiveFrom", "effectiveUntil", "eligibilityAssessmentId")
        VALUES ($1, $2, $3, $4, 'SUBJECT_TEACHER', $5, $6, $7, '2026-01-01', '2027-12-31', $8)`,
        [
          assignmentId,
          schoolTenantId,
          yearId,
          staffId,
          classId,
          sectionId,
          subjectId,
          assessmentId,
        ],
      );
    });

    afterAll(async () => {
      if (db) {
        await db.query('ROLLBACK');
        db.release();
      }
      await pool?.end();
    });

    beforeEach(async () => db.query('SAVEPOINT cross_phase_case'));
    afterEach(async () => {
      await db.query('ROLLBACK TO SAVEPOINT cross_phase_case');
      await db.query('RELEASE SAVEPOINT cross_phase_case');
    });

    it('rejects a school override below a reviewed mandatory baseline', async () => {
      const schoolPolicyId = randomUUID();
      await db.query(
        `INSERT INTO "NepalHrPolicyVersion" ("id", "policyKey", "version", "kind", "scope", "tenantId", "localLevelId", "schoolTypeCode", "requiresQualification", "requiresLicence", "minimumMonthlyNpr", "payload", "effectiveFrom", "sourceTitle", "sourceUri")
        VALUES ($1, $2, 1, 'TEACHER_PROFESSIONAL_ELIGIBILITY', 'SCHOOL', $3, $4, 'SYNTHETIC', false, false, 20000, '{}'::jsonb, '2026-01-01', 'Synthetic school override', 'https://example.test/school-override')`,
        [
          schoolPolicyId,
          `synthetic.school-policy.${randomUUID()}`,
          schoolTenantId,
          localLevelId,
        ],
      );
      await db.query(
        `UPDATE "NepalHrPolicyVersion" SET "reviewStatus" = 'IN_REVIEW' WHERE "id" = $1`,
        [schoolPolicyId],
      );
      await db.query(
        `UPDATE "NepalHrPolicyVersion" SET "reviewStatus" = 'REVIEWED', "reviewedById" = $2, "reviewedAt" = now() WHERE "id" = $1`,
        [schoolPolicyId, schoolReviewerId],
      );
      await rejected(
        `UPDATE "NepalHrPolicyVersion" SET "reviewStatus" = 'APPROVED', "approvedById" = $2, "approvedAt" = now() WHERE "id" = $1`,
        [schoolPolicyId, schoolApproverId],
      );
    });

    it('denies an active assignment without an eligibility assessment', async () => {
      await rejected(
        `INSERT INTO "TeacherAssignment" ("id", "tenantId", "academicYearId", "staffId", "assignmentType", "classId", "sectionId", "subjectId", "effectiveFrom")
        VALUES ($1, $2, $3, $4, 'SUBJECT_TEACHER', $5, $6, NULL, now())`,
        [randomUUID(), schoolTenantId, yearId, staffId, classId, sectionId],
      );
      expect(await live(now)).toBe(true);
    });

    it('revokes current teaching authority when licence or employment ends', async () => {
      await db.query(
        `UPDATE "TeachingLicenceEvidence" SET "status" = 'REVOKED', "revokedAt" = now(), "revocationReason" = 'Synthetic revocation' WHERE "id" = $1`,
        [licenceId],
      );
      expect(await live(new Date())).toBe(false);
      const stored = await db.query(
        'SELECT "status" FROM "TeacherAssignment" WHERE "id" = $1',
        [assignmentId],
      );
      expect(stored.rows[0]?.status).toBe('ACTIVE');
      await db.query('ROLLBACK TO SAVEPOINT cross_phase_case');
      await db.query(
        `UPDATE "StaffEmployment" SET "status" = 'ENDED', "endedAt" = now(), "endReason" = 'Synthetic employment end', "effectiveTo" = now() WHERE "id" = $1`,
        [employmentId],
      );
      expect(await live(new Date())).toBe(false);
    });

    it('keeps the old policy as-of history while a future version invalidates old authority', async () => {
      const futureId = randomUUID();
      await db.query(
        `INSERT INTO "NepalHrPolicyVersion" ("id", "policyKey", "version", "kind", "scope", "isMandatoryBaseline", "requiresQualification", "requiresLicence", "minimumMonthlyNpr", "payload", "effectiveFrom", "sourceTitle", "sourceUri", "supersedesId")
        VALUES ($1, $2, 2, 'TEACHER_PROFESSIONAL_ELIGIBILITY', 'NATIONAL', true, true, true, 31000, '{}'::jsonb, '2027-01-01', 'Synthetic future revision', 'https://example.test/future-policy', $3)`,
        [futureId, policyKey, policyId],
      );
      await approvePolicy(futureId, platformReviewerId, platformApproverId);
      const historical = await db.query<{ id: string }>(
        `SELECT "id" FROM "NepalHrPolicyVersion" WHERE "policyKey" = $1 AND "reviewStatus" = 'APPROVED' AND "effectiveFrom" <= $2 ORDER BY "effectiveFrom" DESC, "version" DESC LIMIT 1`,
        [policyKey, new Date('2026-06-01T00:00:00Z')],
      );
      expect(historical.rows[0]?.id).toBe(policyId);
      expect(await live(new Date())).toBe(true);
      expect(await live(new Date('2027-06-01T00:00:00Z'))).toBe(false);
      const original = await db.query<{ id: string }>(
        'SELECT "id" FROM "NepalHrPolicyVersion" WHERE "id" = $1',
        [policyId],
      );
      expect(original.rows[0]?.id).toBe(policyId);
    });

    it('keeps export, submission and acknowledgement separate with immutable evidence', async () => {
      const fileId = randomUUID();
      const evidenceId = randomUUID();
      const exportId = randomUUID();
      const handoffId = randomUUID();
      const checksum = 'a'.repeat(64);
      await db.query(
        `INSERT INTO "FileAsset" ("id", "tenantId", "originalFilename", "objectKey", "mimeType", "sizeBytes", "updatedAt") VALUES
        ($1, $2, 'synthetic.csv', $3, 'text/csv', 1, now()),
        ($4, $2, 'synthetic-response.pdf', $5, 'application/pdf', 1, now())`,
        [
          fileId,
          schoolTenantId,
          `synthetic/${fileId}`,
          evidenceId,
          `synthetic/${evidenceId}`,
        ],
      );
      await db.query(
        `INSERT INTO "ReportExport" ("id", "tenantId", "reportKey", "format", "filters", "fileAssetId", "checksum", "status")
        VALUES ($1, $2, 'iemis_student_export', 'csv', '{}'::jsonb, $3, $4, 'COMPLETED')`,
        [exportId, schoolTenantId, fileId, checksum],
      );
      await rejected(
        `INSERT INTO "ExternalAuthorityHandoff" ("id", "tenantId", "authority", "purpose", "reportExportId", "snapshotFileId", "snapshotChecksumSha256", "schemaAuthority", "directSyncSupported", "createdById")
        VALUES ($1, $2, 'CEHRD_IEMIS', 'SYNTHETIC', $3, $4, $5, 'SCHOOL_OS_INTERNAL_RULE_SET', true, $6)`,
        [
          randomUUID(),
          schoolTenantId,
          exportId,
          fileId,
          checksum,
          schoolApproverId,
        ],
      );
      await db.query(
        `INSERT INTO "ExternalAuthorityHandoff" ("id", "tenantId", "authority", "purpose", "reportExportId", "snapshotFileId", "snapshotChecksumSha256", "schemaAuthority", "createdById")
        VALUES ($1, $2, 'CEHRD_IEMIS', 'SYNTHETIC', $3, $4, $5, 'SCHOOL_OS_INTERNAL_RULE_SET', $6)`,
        [
          handoffId,
          schoolTenantId,
          exportId,
          fileId,
          checksum,
          schoolApproverId,
        ],
      );
      await db.query(
        `INSERT INTO "ExternalAuthorityHandoffEvent" ("id", "tenantId", "handoffId", "status", "actorId") VALUES ($1, $2, $3, 'EXPORTED', $4)`,
        [randomUUID(), schoolTenantId, handoffId, schoolApproverId],
      );
      const exported = await db.query<{
        status: string;
        submittedAt: Date | null;
      }>(
        'SELECT "status", "submittedAt" FROM "ExternalAuthorityHandoff" WHERE "id" = $1',
        [handoffId],
      );
      expect(exported.rows[0]).toMatchObject({
        status: 'EXPORTED',
        submittedAt: null,
      });
      await rejected(
        `INSERT INTO "ExternalAuthorityHandoffEvent" ("id", "tenantId", "handoffId", "status", "actorId") VALUES ($1, $2, $3, 'SUBMITTED', $4)`,
        [randomUUID(), schoolTenantId, handoffId, schoolApproverId],
      );
      await db.query(
        `INSERT INTO "ExternalAuthorityHandoffEvent" ("id", "tenantId", "handoffId", "status", "actorId", "evidenceFileId") VALUES ($1, $2, $3, 'SUBMITTED', $4, $5)`,
        [randomUUID(), schoolTenantId, handoffId, schoolApproverId, evidenceId],
      );
      await db.query(
        `INSERT INTO "ExternalAuthorityHandoffEvent" ("id", "tenantId", "handoffId", "status", "actorId", "evidenceFileId", "externalReceiptReference") VALUES ($1, $2, $3, 'ACKNOWLEDGED', $4, $5, 'SYNTHETIC-RECEIPT')`,
        [randomUUID(), schoolTenantId, handoffId, schoolApproverId, evidenceId],
      );
      const acknowledged = await db.query<{
        status: string;
        acknowledgedAt: Date | null;
      }>(
        'SELECT "status", "acknowledgedAt" FROM "ExternalAuthorityHandoff" WHERE "id" = $1',
        [handoffId],
      );
      expect(acknowledged.rows[0]?.status).toBe('ACKNOWLEDGED');
      expect(acknowledged.rows[0]?.acknowledgedAt).not.toBeNull();
      await rejected(
        'UPDATE "ExternalAuthorityHandoff" SET "status" = \'READY\' WHERE "id" = $1',
        [handoffId],
      );
      await rejected(
        'DELETE FROM "ExternalAuthorityHandoffEvent" WHERE "handoffId" = $1',
        [handoffId],
      );
    });
  },
);
