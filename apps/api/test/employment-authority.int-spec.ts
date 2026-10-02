import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { authTestDatabaseUrl } from './helpers/auth-test-isolation';

// Phase 7.1 against real PostgreSQL, using direct SQL so the database is
// proven to enforce the invariants independently of any service code. All
// writes happen in one transaction that is rolled back, leaving no data.
const describeDatabase = authTestDatabaseUrl ? describe : describe.skip;
describeDatabase('Employment authority (database invariants)', () => {
  let pool: Pool;
  let db: PoolClient;
  const tenantId = randomUUID();
  const otherTenantId = randomUUID();
  const userId = randomUUID();
  const reviewerId = randomUUID();
  const otherUserId = randomUUID();
  const staffId = randomUUID();
  const otherStaffId = randomUUID();

  let savepoint = 0;
  async function rejects(sql: string, params: unknown[], pattern: RegExp) {
    savepoint += 1;
    const name = `sp_${String(savepoint)}`;
    await db.query(`SAVEPOINT ${name}`);
    let message = '';
    try {
      await db.query(sql, params);
    } catch (error) {
      message = (error as Error).message;
    }
    await db.query(`ROLLBACK TO SAVEPOINT ${name}`);
    expect(message).toMatch(pattern);
  }
  async function accepts(sql: string, params: unknown[]) {
    savepoint += 1;
    const name = `sp_${String(savepoint)}`;
    await db.query(`SAVEPOINT ${name}`);
    try {
      await db.query(sql, params);
    } finally {
      await db.query(`ROLLBACK TO SAVEPOINT ${name}`);
    }
  }

  async function employment(
    from: string,
    to: string | null,
    state: 'PENDING' | 'VERIFIED' | 'ENDED' | 'REJECTED',
    forStaff = staffId,
    forTenant = tenantId,
  ) {
    const id = randomUUID();
    await db.query(
      `INSERT INTO "StaffEmployment" ("id","tenantId","staffId","employmentType","postCategoryCode","schoolTypeCode","effectiveFrom","effectiveTo","submittedById")
       VALUES ($1,$2,$3,'PERMANENT','TEACHER','SYNTHETIC',$4,$5,$6)`,
      [id, forTenant, forStaff, from, to, userId],
    );
    if (state === 'PENDING') return id;
    if (state === 'REJECTED') {
      await db.query(
        `UPDATE "StaffEmployment" SET "status"='REJECTED',"verifiedById"=$2,"verifiedAt"=now() WHERE "id"=$1`,
        [id, reviewerId],
      );
      return id;
    }
    await db.query(
      `UPDATE "StaffEmployment" SET "status"='VERIFIED',"verifiedById"=$2,"verifiedAt"=now() WHERE "id"=$1`,
      [id, reviewerId],
    );
    if (state === 'ENDED') {
      await db.query(
        `UPDATE "StaffEmployment" SET "status"='ENDED',"endedAt"=now(),"endReason"='Resigned' WHERE "id"=$1`,
        [id],
      );
    }
    return id;
  }

  const responsibility = (
    employmentId: string,
    kind: 'PRIMARY' | 'SECONDARY',
    from: string,
    to: string | null,
    forStaff = staffId,
    forTenant = tenantId,
  ) => {
    const id = randomUUID();
    return db
      .query(
        `INSERT INTO "StaffResponsibility" ("id","tenantId","staffId","employmentId","kind","title","effectiveFrom","effectiveTo","createdById")
         VALUES ($1,$2,$3,$4,$5,'Synthetic post',$6,$7,$8)`,
        [id, forTenant, forStaff, employmentId, kind, from, to, userId],
      )
      .then(() => id);
  };

  beforeAll(async () => {
    pool = new Pool({ connectionString: authTestDatabaseUrl });
    db = await pool.connect();
    await db.query('BEGIN');
    await db.query(
      `INSERT INTO "Tenant" ("id","name","slug","securityDomain") VALUES
       ($1,'Synthetic school',$2,'SCHOOL'),($3,'Other synthetic school',$4,'SCHOOL')`,
      [
        tenantId,
        `p71-${tenantId}`,
        otherTenantId,
        `p71-other-${otherTenantId}`,
      ],
    );
    await db.query(
      `INSERT INTO "User" ("id","tenantId","status") VALUES
       ($1,$2,'ACTIVE'),($3,$2,'ACTIVE'),($4,$5,'ACTIVE')`,
      [userId, tenantId, reviewerId, otherUserId, otherTenantId],
    );
    const staffInsert = `INSERT INTO "Staff" ("id","tenantId","userId","employeeId","firstName","lastName","dateOfBirth","gender","address","joiningDate","contractType","updatedAt")
       VALUES ($1,$2,$3,$4,'Synthetic','Staff','1990-01-01','OTHER','Synthetic address','2020-01-01','PERMANENT',now())`;
    await db.query(staffInsert, [staffId, tenantId, userId, `S-${staffId}`]);
    await db.query(staffInsert, [
      otherStaffId,
      tenantId,
      reviewerId,
      `S-${otherStaffId}`,
    ]);
  });

  // Every test runs inside its own savepoint so fixtures never leak.
  beforeEach(async () => {
    await db.query('SAVEPOINT test_case');
  });
  afterEach(async () => {
    await db.query('ROLLBACK TO SAVEPOINT test_case');
  });

  afterAll(async () => {
    await db.query('ROLLBACK');
    db.release();
    await pool.end();
  });

  describe('overlapping employment', () => {
    it('rejects a new verified period that overlaps ENDED history (service-independent)', async () => {
      const ended = await employment('2024-01-01', '2025-01-01', 'ENDED');
      expect(ended).toBeDefined();
      const overlapping = await employment('2024-06-01', null, 'PENDING');
      await rejects(
        `UPDATE "StaffEmployment" SET "status"='VERIFIED',"verifiedById"=$2,"verifiedAt"=now() WHERE "id"=$1`,
        [overlapping, reviewerId],
        /Overlapping verified employment|StaffEmployment_no_authoritative_overlap/,
      );
    });

    it('the EXCLUDE constraint holds even when the guard trigger is bypassed', async () => {
      await employment('2022-01-01', '2023-01-01', 'ENDED');
      // Bypass only the guard trigger (transactional DDL, rolled back with the
      // savepoint): the declarative constraint must still refuse the row.
      await db.query('SAVEPOINT bypass');
      await db.query(
        'ALTER TABLE "StaffEmployment" DISABLE TRIGGER "StaffEmployment_guard"',
      );
      let message = '';
      try {
        await db.query(
          `INSERT INTO "StaffEmployment" ("id","tenantId","staffId","employmentType","postCategoryCode","schoolTypeCode","effectiveFrom","effectiveTo","status","verifiedById","verifiedAt","submittedById")
           VALUES ($1,$2,$3,'PERMANENT','TEACHER','SYNTHETIC','2022-06-01','2022-09-01','VERIFIED',$4,now(),$5)`,
          [randomUUID(), tenantId, staffId, reviewerId, userId],
        );
      } catch (error) {
        message = (error as Error).message;
      }
      await db.query('ROLLBACK TO SAVEPOINT bypass');
      expect(message).toMatch(/StaffEmployment_no_authoritative_overlap/);
    });

    it('allows adjacent half-open periods and non-authoritative overlaps', async () => {
      await employment('2026-01-01', '2026-06-01', 'ENDED');
      // Starts exactly where the previous period ends.
      await employment('2026-06-01', null, 'VERIFIED');
      // PENDING and REJECTED rows carry no authority and never block.
      await employment('2026-02-01', '2026-03-01', 'PENDING');
      await employment('2026-02-01', '2026-03-01', 'REJECTED');
    });

    it('does not compare different staff members', async () => {
      await employment('2030-01-01', null, 'VERIFIED', staffId);
      await employment('2030-01-01', null, 'VERIFIED', otherStaffId);
    });

    it('keeps ended history immutable and undeletable', async () => {
      const ended = await employment('2031-01-01', '2031-06-01', 'ENDED');
      await rejects(
        `DELETE FROM "StaffEmployment" WHERE "id"=$1`,
        [ended],
        /cannot be deleted/,
      );
      await rejects(
        `UPDATE "StaffEmployment" SET "effectiveTo"='2031-12-01' WHERE "id"=$1`,
        [ended],
        /immutable/,
      );
    });
  });

  describe('responsibilities', () => {
    let employmentId: string;
    beforeAll(async () => {
      employmentId = await employment('2040-01-01', null, 'VERIFIED');
    });

    it('allows exactly one PRIMARY at any instant and any number of SECONDARY', async () => {
      await responsibility(employmentId, 'PRIMARY', '2040-01-01', '2040-07-01');
      await rejects(
        `INSERT INTO "StaffResponsibility" ("id","tenantId","staffId","employmentId","kind","title","effectiveFrom","effectiveTo")
         VALUES ($1,$2,$3,$4,'PRIMARY','Overlap','2040-06-01',NULL)`,
        [randomUUID(), tenantId, staffId, employmentId],
        /StaffResponsibility_one_primary_per_range/,
      );
      // Adjacent primary (half-open) and overlapping secondaries are fine.
      await responsibility(employmentId, 'PRIMARY', '2040-07-01', null);
      await responsibility(employmentId, 'SECONDARY', '2040-03-01', null);
      await responsibility(
        employmentId,
        'SECONDARY',
        '2040-04-01',
        '2040-05-01',
      );
    });

    it('requires a verified employment and a window inside it', async () => {
      const pending = await employment(
        '2041-01-01',
        null,
        'PENDING',
        otherStaffId,
      );
      await rejects(
        `INSERT INTO "StaffResponsibility" ("id","tenantId","staffId","employmentId","kind","title","effectiveFrom")
         VALUES ($1,$2,$3,$4,'SECONDARY','Pending employment','2041-02-01')`,
        [randomUUID(), tenantId, otherStaffId, pending],
        /requires a verified, current employment/,
      );
      const bounded = await employment(
        '2042-01-01',
        '2042-12-01',
        'VERIFIED',
        otherStaffId,
      );
      await rejects(
        `INSERT INTO "StaffResponsibility" ("id","tenantId","staffId","employmentId","kind","title","effectiveFrom")
         VALUES ($1,$2,$3,$4,'SECONDARY','Open ended','2042-02-01')`,
        [randomUUID(), tenantId, otherStaffId, bounded],
        /inside the employment window/,
      );
      await rejects(
        `INSERT INTO "StaffResponsibility" ("id","tenantId","staffId","employmentId","kind","title","effectiveFrom","effectiveTo")
         VALUES ($1,$2,$3,$4,'SECONDARY','Starts early','2041-12-01','2042-02-01')`,
        [randomUUID(), tenantId, otherStaffId, bounded],
        /inside the employment window/,
      );
    });

    it('rejects cross-tenant and cross-staff references', async () => {
      await rejects(
        `INSERT INTO "StaffResponsibility" ("id","tenantId","staffId","employmentId","kind","title","effectiveFrom")
         VALUES ($1,$2,$3,$4,'SECONDARY','Wrong tenant','2040-02-01')`,
        [randomUUID(), otherTenantId, staffId, employmentId],
        /must match the tenant, staff and employment/,
      );
      await rejects(
        `INSERT INTO "StaffResponsibility" ("id","tenantId","staffId","employmentId","kind","title","effectiveFrom")
         VALUES ($1,$2,$3,$4,'SECONDARY','Wrong staff','2040-02-01')`,
        [randomUUID(), tenantId, otherStaffId, employmentId],
        /must match the tenant, staff and employment/,
      );
    });

    it('is append-only: content immutable, no delete, ending needs a reason', async () => {
      const id = await responsibility(
        employmentId,
        'SECONDARY',
        '2040-08-01',
        null,
      );
      await rejects(
        `UPDATE "StaffResponsibility" SET "title"='Renamed' WHERE "id"=$1`,
        [id],
        /immutable/,
      );
      await rejects(
        `UPDATE "StaffResponsibility" SET "kind"='PRIMARY' WHERE "id"=$1`,
        [id],
        /immutable/,
      );
      await rejects(
        `DELETE FROM "StaffResponsibility" WHERE "id"=$1`,
        [id],
        /cannot be deleted/,
      );
      await rejects(
        `UPDATE "StaffResponsibility" SET "effectiveTo"='2040-09-01' WHERE "id"=$1`,
        [id],
        /only be changed by ending it|end_pair/,
      );
      await rejects(
        `UPDATE "StaffResponsibility" SET "effectiveTo"='2040-09-01',"endedAt"=now(),"endReason"=' ' WHERE "id"=$1`,
        [id],
        /StaffResponsibility_end_pair/,
      );
      await accepts(
        `UPDATE "StaffResponsibility" SET "effectiveTo"='2040-09-01',"endedAt"=now(),"endReason"='Reassigned' WHERE "id"=$1`,
        [id],
      );
    });

    it('an ended responsibility cannot be changed or extended', async () => {
      const id = await responsibility(
        employmentId,
        'SECONDARY',
        '2040-10-01',
        '2040-12-01',
      );
      await rejects(
        `UPDATE "StaffResponsibility" SET "effectiveTo"='2041-06-01',"endedAt"=now(),"endReason"='Extend' WHERE "id"=$1`,
        [id],
        /cannot extend/,
      );
      await db.query(
        `UPDATE "StaffResponsibility" SET "effectiveTo"='2040-11-01',"endedAt"=now(),"endReason"='Shortened' WHERE "id"=$1`,
        [id],
      );
      await rejects(
        `UPDATE "StaffResponsibility" SET "effectiveTo"='2040-10-15',"endedAt"=now(),"endReason"='Again' WHERE "id"=$1`,
        [id],
        /ended responsibility cannot be changed/,
      );
    });

    it('an employment cannot end while a responsibility still runs past the end', async () => {
      const own = await employment(
        '2050-01-01',
        null,
        'VERIFIED',
        otherStaffId,
      );
      const open = await responsibility(
        own,
        'SECONDARY',
        '2050-01-01',
        null,
        otherStaffId,
      );
      await rejects(
        `UPDATE "StaffEmployment" SET "status"='ENDED',"effectiveTo"='2050-06-01',"endedAt"=now(),"endReason"='Resigned' WHERE "id"=$1`,
        [own],
        /responsibilities before ending the employment/,
      );
      // After shortening the responsibility, the employment may end.
      await db.query(
        `UPDATE "StaffResponsibility" SET "effectiveTo"='2050-06-01',"endedAt"=now(),"endReason"='Employment ended' WHERE "id"=$1`,
        [open],
      );
      await accepts(
        `UPDATE "StaffEmployment" SET "status"='ENDED',"effectiveTo"='2050-06-01',"endedAt"=now(),"endReason"='Resigned' WHERE "id"=$1`,
        [own],
      );
    });
  });

  describe('payroll line lineage', () => {
    it('requires the employment window to be recorded together', async () => {
      const run = randomUUID();
      await db.query(
        `INSERT INTO "PayrollRun" ("id","tenantId","periodMonth","periodYear","status","updatedAt") VALUES ($1,$2,3,2060,'GENERATED',now())`,
        [run, tenantId],
      );
      const employmentId = await employment(
        '2060-01-01',
        null,
        'VERIFIED',
        otherStaffId,
      );
      const lineSql = (columns: string, values: string) =>
        `INSERT INTO "PayrollLine" ("id","tenantId","payrollRunId","staffId","grossSalary","netSalary",${columns})
         VALUES ('${randomUUID()}','${tenantId}','${run}','${otherStaffId}',1,1,${values})`;
      await rejects(
        lineSql('"employmentId"', `'${employmentId}'`),
        [],
        /PayrollLine_employment_window/,
      );
      await rejects(
        lineSql(
          '"employmentId","employmentFrom","employmentTo"',
          `'${employmentId}','2060-02-01','2060-01-01'`,
        ),
        [],
        /PayrollLine_employment_window/,
      );
      await accepts(
        lineSql(
          '"employmentId","employmentFrom"',
          `'${employmentId}','2060-01-01'`,
        ),
        [],
      );
    });
  });
});
