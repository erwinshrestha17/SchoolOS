import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { authTestDatabaseUrl } from './helpers/auth-test-isolation';

const describeDatabase = authTestDatabaseUrl ? describe : describe.skip;

// The registry is not wired into academic decisions yet. These cases protect
// the persistence boundary that later policy authors and resolvers will use.
describeDatabase(
  'P0-N1 education policy foundation (isolated PostgreSQL)',
  () => {
    let pool: Pool;
    let db: PoolClient;
    const platformTenantId = randomUUID();
    const schoolTenantId = randomUUID();
    const platformReviewerId = randomUUID();
    const platformApproverId = randomUUID();
    const schoolReviewerId = randomUUID();
    const schoolApproverId = randomUUID();
    const policyKey = `synthetic.curriculum.${randomUUID()}`;

    async function rejected(sql: string, values: unknown[]) {
      await db.query('SAVEPOINT rejected_policy_write');
      try {
        await expect(db.query(sql, values)).rejects.toThrow();
      } finally {
        await db.query('ROLLBACK TO SAVEPOINT rejected_policy_write');
        await db.query('RELEASE SAVEPOINT rejected_policy_write');
      }
    }

    beforeAll(async () => {
      pool = new Pool({ connectionString: authTestDatabaseUrl });
      db = await pool.connect();
      await db.query('BEGIN');
      await db.query(
        'INSERT INTO "Tenant" ("id", "name", "slug", "securityDomain") VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)',
        [
          platformTenantId,
          'Synthetic policy Platform',
          `policy-platform-${platformTenantId}`,
          'PLATFORM',
          schoolTenantId,
          'Synthetic policy school',
          `policy-school-${schoolTenantId}`,
          'SCHOOL',
        ],
      );
      await db.query(
        'INSERT INTO "User" ("id", "tenantId", "status") VALUES ($1, $2, $3), ($4, $5, $6), ($7, $8, $9), ($10, $11, $12)',
        [
          platformReviewerId,
          platformTenantId,
          'ACTIVE',
          platformApproverId,
          platformTenantId,
          'ACTIVE',
          schoolReviewerId,
          schoolTenantId,
          'ACTIVE',
          schoolApproverId,
          schoolTenantId,
          'ACTIVE',
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

    it('requires independent review and preserves approved history', async () => {
      const firstId = randomUUID();
      await db.query(
        `INSERT INTO "NepalEducationPolicyVersion"
        ("id", "policyKey", "version", "kind", "scope", "payload", "effectiveFrom", "sourceTitle", "sourceUri")
        VALUES ($1, $2, 1, 'CURRICULUM', 'NATIONAL', $3::jsonb, $4, $5, $6)`,
        [
          firstId,
          policyKey,
          JSON.stringify({ fixture: true }),
          new Date('2026-01-01T00:00:00Z'),
          'Synthetic source for migration testing',
          'https://example.test/synthetic-policy',
        ],
      );

      await rejected(
        `UPDATE "NepalEducationPolicyVersion" SET "reviewStatus" = 'APPROVED', "reviewedById" = $2,
        "reviewedAt" = now(), "approvedById" = $3, "approvedAt" = now() WHERE "id" = $1`,
        [firstId, platformReviewerId, platformApproverId],
      );
      await db.query(
        `UPDATE "NepalEducationPolicyVersion" SET "reviewStatus" = 'IN_REVIEW' WHERE "id" = $1`,
        [firstId],
      );
      await db.query(
        `UPDATE "NepalEducationPolicyVersion" SET "reviewStatus" = 'REVIEWED', "reviewedById" = $2,
        "reviewedAt" = now() WHERE "id" = $1`,
        [firstId, platformReviewerId],
      );
      await rejected(
        `UPDATE "NepalEducationPolicyVersion" SET "reviewStatus" = 'APPROVED',
        "approvedById" = $2, "approvedAt" = now() WHERE "id" = $1`,
        [firstId, platformReviewerId],
      );
      await db.query(
        `UPDATE "NepalEducationPolicyVersion" SET "reviewStatus" = 'APPROVED',
        "approvedById" = $2, "approvedAt" = now() WHERE "id" = $1`,
        [firstId, platformApproverId],
      );
      await rejected(
        `UPDATE "NepalEducationPolicyVersion" SET "payload" = $2::jsonb WHERE "id" = $1`,
        [firstId, JSON.stringify({ silentlyRewritten: true })],
      );
      await rejected(
        'DELETE FROM "NepalEducationPolicyVersion" WHERE "id" = $1',
        [firstId],
      );

      const secondId = randomUUID();
      const successorSql = `INSERT INTO "NepalEducationPolicyVersion"
      ("id", "policyKey", "version", "kind", "scope", "payload", "effectiveFrom", "sourceTitle", "supersedesId", "sourceUri")
      VALUES ($1, $2, 2, 'CURRICULUM', $3::"NepalEducationPolicyScope", $4::jsonb, $5, $6, $7, $8)`;
      const successor = [
        secondId,
        policyKey,
        'NATIONAL',
        JSON.stringify({ fixture: true, revision: 2 }),
        new Date('2027-01-01T00:00:00Z'),
        'Synthetic successor',
        firstId,
        'https://example.test/synthetic-successor',
      ];
      await rejected(
        successorSql.replace("'CURRICULUM'", "'GRADING_ASSESSMENT'"),
        successor,
      );
      await db.query(successorSql, successor);
      await db.query(
        `UPDATE "NepalEducationPolicyVersion" SET "reviewStatus" = 'IN_REVIEW' WHERE "id" = $1`,
        [secondId],
      );
      await db.query(
        `UPDATE "NepalEducationPolicyVersion" SET "reviewStatus" = 'REVIEWED', "reviewedById" = $2,
        "reviewedAt" = now() WHERE "id" = $1`,
        [secondId, platformReviewerId],
      );
      await db.query(
        `UPDATE "NepalEducationPolicyVersion" SET "reviewStatus" = 'APPROVED',
        "approvedById" = $2, "approvedAt" = now() WHERE "id" = $1`,
        [secondId, platformApproverId],
      );

      const previous = await db.query(
        `SELECT "id" FROM "NepalEducationPolicyVersion" WHERE "policyKey" = $1
        AND "reviewStatus" = 'APPROVED' AND "effectiveFrom" <= $2
        ORDER BY "effectiveFrom" DESC, "version" DESC LIMIT 1`,
        [policyKey, new Date('2026-06-01T00:00:00Z')],
      );
      expect(previous.rows[0]?.id).toBe(firstId);
      const future = await db.query(
        `SELECT "id" FROM "NepalEducationPolicyVersion" WHERE "policyKey" = $1
        AND "reviewStatus" = 'APPROVED' AND "effectiveFrom" <= $2
        ORDER BY "effectiveFrom" DESC, "version" DESC LIMIT 1`,
        [policyKey, new Date('2027-06-01T00:00:00Z')],
      );
      expect(future.rows[0]?.id).toBe(secondId);
    });

    it('rejects missing school scope and cross-domain review actors', async () => {
      const schoolPolicyId = randomUUID();
      const schoolPolicySql = `INSERT INTO "NepalEducationPolicyVersion"
      ("id", "policyKey", "version", "kind", "scope", "tenantId", "payload", "effectiveFrom", "sourceTitle", "sourceUri", "schoolTypeCode", "recognitionAuthority", "recognitionReference")
      VALUES ($1, $2, 1, 'SCHOOL_RECOGNITION', 'SCHOOL', $3, $4::jsonb, $5, $6, $7, $8, $9, $10)`;
      const schoolPolicyValues = [
        schoolPolicyId,
        `synthetic.recognition.${randomUUID()}`,
        schoolTenantId,
        JSON.stringify({ fixture: true }),
        new Date('2026-01-01T00:00:00Z'),
        'Synthetic recognition fixture',
        'https://example.test/synthetic-recognition',
        'SYNTHETIC',
        'Synthetic authority',
        'SYN-1',
      ];
      await rejected(schoolPolicySql, [
        ...schoolPolicyValues.slice(0, 2),
        null,
        ...schoolPolicyValues.slice(3),
      ]);
      await db.query(schoolPolicySql, schoolPolicyValues);
      await db.query(
        `UPDATE "NepalEducationPolicyVersion" SET "reviewStatus" = 'IN_REVIEW' WHERE "id" = $1`,
        [schoolPolicyId],
      );
      await rejected(
        `UPDATE "NepalEducationPolicyVersion" SET "reviewStatus" = 'REVIEWED',
        "reviewedById" = $2, "reviewedAt" = now() WHERE "id" = $1`,
        [schoolPolicyId, platformReviewerId],
      );
      await db.query(
        `UPDATE "NepalEducationPolicyVersion" SET "reviewStatus" = 'REVIEWED',
        "reviewedById" = $2, "reviewedAt" = now() WHERE "id" = $1`,
        [schoolPolicyId, schoolReviewerId],
      );
      await db.query(
        `UPDATE "NepalEducationPolicyVersion" SET "reviewStatus" = 'APPROVED',
        "approvedById" = $2, "approvedAt" = now() WHERE "id" = $1`,
        [schoolPolicyId, schoolApproverId],
      );
      const result = await db.query(
        'SELECT "reviewStatus" FROM "NepalEducationPolicyVersion" WHERE "id" = $1',
        [schoolPolicyId],
      );
      expect(result.rows[0]?.reviewStatus).toBe('APPROVED');
    });

    it('does not attach school private evidence to a Platform policy', async () => {
      const fileId = randomUUID();
      await db.query(
        `INSERT INTO "FileAsset" ("id", "tenantId", "originalFilename", "objectKey", "mimeType", "sizeBytes", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, $6, now())`,
        [
          fileId,
          schoolTenantId,
          'synthetic-evidence.pdf',
          `synthetic-policy/${fileId}`,
          'application/pdf',
          1,
        ],
      );
      await rejected(
        `INSERT INTO "NepalEducationPolicyVersion"
          ("id", "policyKey", "version", "kind", "scope", "payload", "effectiveFrom", "sourceTitle", "evidenceFileAssetId")
          VALUES ($1, $2, 1, 'CURRICULUM', 'NATIONAL', $3::jsonb, $4, $5, $6)`,
        [
          randomUUID(),
          `synthetic.evidence.${randomUUID()}`,
          JSON.stringify({ fixture: true }),
          new Date('2026-01-01T00:00:00Z'),
          'Synthetic source',
          fileId,
        ],
      );
    });
  },
);
