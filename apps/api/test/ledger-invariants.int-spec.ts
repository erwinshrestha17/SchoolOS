import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { allocateDocumentNumber } from '../src/common/document-sequence';
import { authTestDatabaseUrl } from './helpers/auth-test-isolation';

// Phase 7.3 against real PostgreSQL. Direct SQL proves the database enforces
// ledger, period, numbering and payment invariants independently of services.
// Everything runs in one transaction rolled back at the end, except the
// sequence concurrency suite, which commits to a throwaway tenant and removes it.
const describeDatabase = authTestDatabaseUrl ? describe : describe.skip;

describeDatabase('Ledger invariants (database)', () => {
  let pool: Pool;
  let db: PoolClient;
  const tenantId = randomUUID();
  const otherTenantId = randomUUID();
  const userId = randomUUID();
  const yearId = randomUUID();
  const closedYearId = randomUUID();
  const openPeriod = randomUUID();
  const closedPeriod = randomUUID();
  const lockedPeriod = randomUUID();
  const closedYearPeriod = randomUUID();
  const otherTenantPeriod = randomUUID();
  const cashAccount = randomUUID();
  const revenueAccount = randomUUID();
  const studentId = randomUUID();
  const otherStudentId = randomUUID();

  let savepoint = 0;
  async function attempt(sql: string, params: unknown[], immediate: boolean) {
    savepoint += 1;
    const name = `sp_${String(savepoint)}`;
    await db.query(`SAVEPOINT ${name}`);
    let message = '';
    try {
      await db.query(sql, params);
      if (immediate) await db.query('SET CONSTRAINTS ALL IMMEDIATE');
    } catch (error) {
      message = (error as Error).message;
    }
    await db.query(`ROLLBACK TO SAVEPOINT ${name}`);
    return message;
  }
  async function rejects(
    sql: string,
    params: unknown[],
    pattern: RegExp,
    immediate = false,
  ) {
    expect(await attempt(sql, params, immediate)).toMatch(pattern);
  }
  async function accepts(sql: string, params: unknown[], immediate = false) {
    expect(await attempt(sql, params, immediate)).toBe('');
  }

  async function entry(options: {
    status?: string;
    date?: string;
    period?: string | null;
    sourceType?: string;
    sourceId?: string | null;
    tenant?: string;
  }) {
    const id = randomUUID();
    await db.query(
      `INSERT INTO "JournalEntry" ("id","tenantId","fiscalPeriodId","entryDate","narration","status","sourceType","sourceId")
       VALUES ($1,$2,$3,$4,'Synthetic','DRAFT',$5,$6)`,
      [
        id,
        options.tenant ?? tenantId,
        options.period === undefined ? openPeriod : options.period,
        options.date ?? '2060-01-15',
        options.sourceType ?? 'MANUAL',
        options.sourceId ?? null,
      ],
    );
    return id;
  }
  async function line(
    entryId: string,
    side: 'DEBIT' | 'CREDIT',
    amount: number,
    account = side === 'DEBIT' ? cashAccount : revenueAccount,
  ) {
    await db.query(
      `INSERT INTO "JournalLine" ("id","tenantId","journalEntryId","chartAccountId","side","debit","credit","amount")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        randomUUID(),
        tenantId,
        entryId,
        account,
        side,
        side === 'DEBIT' ? amount : 0,
        side === 'CREDIT' ? amount : 0,
        amount,
      ],
    );
  }
  async function postedEntry(options: Parameters<typeof entry>[0] = {}) {
    const id = await entry(options);
    await line(id, 'DEBIT', 100);
    await line(id, 'CREDIT', 100);
    await db.query(
      `UPDATE "JournalEntry" SET "status"='POSTED',"postedAt"=now() WHERE "id"=$1`,
      [id],
    );
    await db.query('SET CONSTRAINTS ALL IMMEDIATE');
    return id;
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: authTestDatabaseUrl });
    db = await pool.connect();
    await db.query('BEGIN');
    await db.query(
      `INSERT INTO "Tenant" ("id","name","slug","securityDomain") VALUES
       ($1,'Synthetic school',$2,'SCHOOL'),($3,'Other synthetic school',$4,'SCHOOL')`,
      [tenantId, `p73-${tenantId}`, otherTenantId, `p73-o-${otherTenantId}`],
    );
    await db.query(
      `INSERT INTO "User" ("id","tenantId","status") VALUES ($1,$2,'ACTIVE')`,
      [userId, tenantId],
    );
    await db.query(
      `INSERT INTO "FiscalYear" ("id","tenantId","name","startDate","endDate","status","updatedAt") VALUES
       ($1,$2,'FY open','2060-01-01','2060-12-31','OPEN',now()),
       ($3,$2,'FY closed','2059-01-01','2059-12-31','CLOSED',now()),
       ($4,$5,'FY other','2060-01-01','2060-12-31','OPEN',now())`,
      [yearId, tenantId, closedYearId, randomUUID(), otherTenantId],
    );
    const otherYear = (
      await db.query(`SELECT "id" FROM "FiscalYear" WHERE "tenantId"=$1`, [
        otherTenantId,
      ])
    ).rows[0] as { id: string };
    const period = (
      id: string,
      year: string,
      tenant: string,
      n: number,
      from: string,
      to: string,
      status: string,
    ) =>
      db.query(
        `INSERT INTO "FiscalPeriod" ("id","tenantId","fiscalYearId","label","periodNumber","startDate","endDate","status","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())`,
        [
          id,
          tenant,
          year,
          `P${String(n)}-${id.slice(0, 4)}`,
          n,
          from,
          to,
          status,
        ],
      );
    await period(
      openPeriod,
      yearId,
      tenantId,
      1,
      '2060-01-01',
      '2060-01-31',
      'OPEN',
    );
    await period(
      closedPeriod,
      yearId,
      tenantId,
      2,
      '2060-02-01',
      '2060-02-28',
      'CLOSED',
    );
    await period(
      lockedPeriod,
      yearId,
      tenantId,
      3,
      '2060-03-01',
      '2060-03-31',
      'LOCKED',
    );
    await period(
      closedYearPeriod,
      closedYearId,
      tenantId,
      1,
      '2059-01-01',
      '2059-01-31',
      'OPEN',
    );
    await period(
      otherTenantPeriod,
      otherYear.id,
      otherTenantId,
      1,
      '2060-01-01',
      '2060-01-31',
      'OPEN',
    );
    await db.query(
      `INSERT INTO "ChartAccount" ("id","tenantId","code","name","type","updatedAt") VALUES
       ($1,$2,'1000','Cash','ASSET',now()),($3,$2,'4000','Revenue','REVENUE',now())`,
      [cashAccount, tenantId, revenueAccount],
    );
    const classId = randomUUID();
    await db.query(
      `INSERT INTO "Class" ("id","tenantId","name","level") VALUES ($1,$2,'Synthetic class',1)`,
      [classId, tenantId],
    );
    for (const id of [studentId, otherStudentId]) {
      await db.query(
        `INSERT INTO "Student" ("id","tenantId","studentSystemId","firstNameEn","lastNameEn","dateOfBirth","gender","admissionDate","classId","updatedAt")
         VALUES ($1,$2,$3,'Synthetic','Student','2016-01-01','OTHER','2060-01-01',$4,now())`,
        [id, tenantId, randomUUID(), classId],
      );
    }
  });

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

  describe('JournalLine shape', () => {
    const insert = (
      side: string,
      debit: number,
      credit: number,
      amount: number,
    ) => ({
      sql: `INSERT INTO "JournalLine" ("id","tenantId","journalEntryId","chartAccountId","side","debit","credit","amount")
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      params: (entryId: string) => [
        randomUUID(),
        tenantId,
        entryId,
        cashAccount,
        side,
        debit,
        credit,
        amount,
      ],
    });
    it('accepts a well-formed debit and credit line', async () => {
      const id = await entry({});
      const debit = insert('DEBIT', 10, 0, 10);
      const credit = insert('CREDIT', 0, 10, 10);
      await accepts(debit.sql, debit.params(id));
      await accepts(credit.sql, credit.params(id));
    });
    it.each([
      ['both sides positive', 'DEBIT', 10, 10, 10],
      ['side says debit but credit carries the amount', 'DEBIT', 0, 10, 10],
      ['side says credit but debit carries the amount', 'CREDIT', 10, 0, 10],
      ['amount differs from the side value', 'DEBIT', 10, 0, 11],
      ['zero amount', 'DEBIT', 0, 0, 0],
      ['negative amount', 'DEBIT', -5, 0, -5],
    ])('rejects %s', async (_label, side, debit, credit, amount) => {
      const id = await entry({});
      const bad = insert(side, debit, credit, amount);
      await rejects(bad.sql, bad.params(id), /JournalLine_amount_side_check/);
    });
  });

  describe('balanced at commit', () => {
    it('rejects a POSTED journal with unbalanced lines', async () => {
      const id = await entry({});
      await line(id, 'DEBIT', 100);
      await line(id, 'CREDIT', 90);
      await rejects(
        `UPDATE "JournalEntry" SET "status"='POSTED' WHERE "id"=$1`,
        [id],
        /JournalEntry_posted_balanced|must balance/,
        true,
      );
    });
    it('rejects a POSTED journal with fewer than two lines', async () => {
      const id = await entry({});
      await line(id, 'DEBIT', 100);
      await rejects(
        `UPDATE "JournalEntry" SET "status"='POSTED' WHERE "id"=$1`,
        [id],
        /at least two lines/,
        true,
      );
    });
    it('allows unbalanced work-in-progress drafts', async () => {
      const id = await entry({});
      await line(id, 'DEBIT', 100);
      await accepts(`SELECT 1`, [], true);
      expect(id).toBeDefined();
    });
    it('accepts a balanced journal inserted already POSTED with lines added after the entry', async () => {
      const id = randomUUID();
      await db.query(
        `INSERT INTO "JournalEntry" ("id","tenantId","fiscalPeriodId","entryDate","narration","status","sourceType")
         VALUES ($1,$2,$3,'2060-01-10','Direct posted','POSTED','MANUAL')`,
        [id, tenantId, openPeriod],
      );
      await line(id, 'DEBIT', 40);
      await line(id, 'CREDIT', 40);
      await db.query('SET CONSTRAINTS ALL IMMEDIATE');
    });
    it('rejects removing a line from a posted journal even to unbalance it', async () => {
      const id = await postedEntry();
      await rejects(
        `DELETE FROM "JournalLine" WHERE "journalEntryId"=$1 AND "side"='CREDIT'`,
        [id],
        /Lines of a posted journal are immutable/,
      );
    });
  });

  describe('posted immutability', () => {
    it('freezes the content of a posted journal', async () => {
      const id = await postedEntry();
      for (const set of [
        `"narration"='tampered'`,
        `"entryDate"='2060-01-20'`,
        `"sourceId"='x'`,
        `"postedAt"=now() + interval '1 day'`,
        `"fiscalPeriodId"='${closedPeriod}'`,
      ])
        await rejects(
          `UPDATE "JournalEntry" SET ${set} WHERE "id"=$1`,
          [id],
          /Posted journal entries are immutable/,
        );
    });
    it('refuses to delete a posted journal', async () => {
      const id = await postedEntry();
      await rejects(
        `DELETE FROM "JournalEntry" WHERE "id"=$1`,
        [id],
        /cannot be deleted/,
      );
    });
    it('freezes every line of a posted journal', async () => {
      const id = await postedEntry();
      await rejects(
        `UPDATE "JournalLine" SET "chartAccountId"=$2 WHERE "journalEntryId"=$1`,
        [id, revenueAccount],
        /Lines of a posted journal are immutable/,
      );
      const extra = [randomUUID(), tenantId, id, cashAccount];
      await rejects(
        `INSERT INTO "JournalLine" ("id","tenantId","journalEntryId","chartAccountId","side","debit","credit","amount")
         VALUES ($1,$2,$3,$4,'DEBIT',5,0,5)`,
        extra,
        /Lines of a posted journal are immutable/,
      );
    });
    it('still lets a draft be edited and deleted', async () => {
      const id = await entry({});
      await line(id, 'DEBIT', 10);
      await accepts(
        `UPDATE "JournalEntry" SET "narration"='edited' WHERE "id"=$1`,
        [id],
      );
      await accepts(`DELETE FROM "JournalLine" WHERE "journalEntryId"=$1`, [
        id,
      ]);
    });
    it('allows only POSTED to REVERSED with write-once reversal columns', async () => {
      const id = await postedEntry();
      await accepts(
        `UPDATE "JournalEntry" SET "status"='REVERSED',"reversedAt"=now(),"reversedById"=$2,"reversalReason"='Synthetic' WHERE "id"=$1`,
        [id, userId],
      );
      await db.query(
        `UPDATE "JournalEntry" SET "status"='REVERSED',"reversedAt"=now(),"reversedById"=$2,"reversalReason"='Synthetic' WHERE "id"=$1`,
        [id, userId],
      );
      await rejects(
        `UPDATE "JournalEntry" SET "reversalReason"='rewritten' WHERE "id"=$1`,
        [id],
        /write-once/,
      );
      await rejects(
        `UPDATE "JournalEntry" SET "status"='POSTED' WHERE "id"=$1`,
        [id],
        /Illegal posted journal status change/,
      );
      await rejects(
        `UPDATE "JournalEntry" SET "status"='DRAFT' WHERE "id"=$1`,
        [id],
        /Illegal posted journal status change/,
      );
    });
    it('lets a posted correction record its link once', async () => {
      const original = await postedEntry();
      const correction = await postedEntry();
      await db.query(
        `UPDATE "JournalEntry" SET "correctionOfId"=$2,"correctionReason"='Synthetic' WHERE "id"=$1`,
        [correction, original],
      );
      await rejects(
        `UPDATE "JournalEntry" SET "correctionOfId"=$2 WHERE "id"=$1`,
        [correction, correction],
        /write-once/,
      );
    });
  });

  describe('posting period', () => {
    const post = (
      period: string | null,
      date: string,
      sourceType = 'MANUAL',
    ) => ({
      sql: `INSERT INTO "JournalEntry" ("id","tenantId","fiscalPeriodId","entryDate","narration","status","sourceType","sourceId")
            VALUES ($1,$2,$3,$4,'Synthetic','POSTED',$5,$6)`,
      params: [
        randomUUID(),
        tenantId,
        period,
        date,
        sourceType,
        sourceType === 'MANUAL' ? null : randomUUID(),
      ],
    });
    it('rejects posting into CLOSED or LOCKED periods at insert', async () => {
      const closed = post(closedPeriod, '2060-02-10');
      await rejects(closed.sql, closed.params, /closed fiscal period/);
      const locked = post(lockedPeriod, '2060-03-10');
      await rejects(locked.sql, locked.params, /locked fiscal period/);
    });
    it('rejects a DRAFT moving to POSTED in a period closed meanwhile', async () => {
      const id = await entry({ period: closedPeriod, date: '2060-02-10' });
      await line(id, 'DEBIT', 10);
      await line(id, 'CREDIT', 10);
      await rejects(
        `UPDATE "JournalEntry" SET "status"='POSTED' WHERE "id"=$1`,
        [id],
        /closed fiscal period/,
      );
    });
    it('allows only the fiscal-year closing entry into a CLOSED period', async () => {
      const closing = post(closedPeriod, '2060-02-28', 'CLOSING_ENTRY');
      await db.query('SAVEPOINT closing');
      await db.query(closing.sql, closing.params);
      await db.query('ROLLBACK TO SAVEPOINT closing');
      const lockedClosing = post(lockedPeriod, '2060-03-31', 'CLOSING_ENTRY');
      await rejects(
        lockedClosing.sql,
        lockedClosing.params,
        /locked fiscal period/,
      );
      const other = post(closedPeriod, '2060-02-28', 'ADJUSTMENT');
      await rejects(other.sql, other.params, /closed fiscal period/);
    });
    it('rejects an entry date outside its period, a missing period and a foreign tenant period', async () => {
      const outside = post(openPeriod, '2060-02-05');
      await rejects(outside.sql, outside.params, /outside fiscal period/);
      const missing = post(null, '2060-01-10');
      await rejects(
        missing.sql,
        missing.params,
        /JournalEntry_posted_has_period|requires a fiscal period/,
      );
      const foreign = post(otherTenantPeriod, '2060-01-10');
      await rejects(
        foreign.sql,
        foreign.params,
        /does not belong to the tenant|tenant/i,
      );
    });
    it('rejects posting into a closed fiscal year even when the period row is open', async () => {
      const inClosedYear = post(closedYearPeriod, '2059-01-10');
      await rejects(
        inClosedYear.sql,
        inClosedYear.params,
        /closed fiscal year/,
      );
    });
    it('does not let a journal-referenced fiscal period be deleted', async () => {
      await postedEntry();
      await rejects(
        `DELETE FROM "FiscalPeriod" WHERE "id"=$1`,
        [openPeriod],
        /violates foreign key constraint|JournalEntry_fiscalPeriodId_fkey/,
      );
    });
    it('accepts a normal post into the open period', async () => {
      const ok = post(openPeriod, '2060-01-10');
      await accepts(ok.sql, ok.params);
    });
  });

  describe('system source key', () => {
    it('requires a source id for every non-MANUAL journal', async () => {
      await rejects(
        `INSERT INTO "JournalEntry" ("id","tenantId","fiscalPeriodId","entryDate","narration","status","sourceType")
         VALUES ($1,$2,$3,'2060-01-10','Synthetic','DRAFT','INVOICE')`,
        [randomUUID(), tenantId, openPeriod],
        /JournalEntry_system_source_key/,
      );
      await accepts(
        `INSERT INTO "JournalEntry" ("id","tenantId","fiscalPeriodId","entryDate","narration","status","sourceType")
         VALUES ($1,$2,$3,'2060-01-10','Synthetic','DRAFT','MANUAL')`,
        [randomUUID(), tenantId, openPeriod],
      );
    });
  });

  describe('payments and receipts', () => {
    async function payment(student = studentId) {
      const id = randomUUID();
      await db.query(
        `INSERT INTO "Payment" ("id","tenantId","studentId","method","amount","paidAt")
         VALUES ($1,$2,$3,'CASH',500,'2060-01-10')`,
        [id, tenantId, student],
      );
      return id;
    }
    it.each([
      [`"amount"=600`],
      [`"method"='BANK'`],
      [`"paidAt"='2060-01-11'`],
      [`"referenceNumber"='x'`],
      [`"isAdvance"=true`],
      [`"idempotencyKey"='k2'`],
    ])('rejects changing %s after insert', async (set) => {
      const id = await payment();
      await rejects(
        `UPDATE "Payment" SET ${set} WHERE "id"=$1`,
        [id],
        /Payment_immutable|immutable/,
      );
    });
    it('rejects reassigning the student unless the merge opts in for the transaction', async () => {
      const id = await payment();
      await rejects(
        `UPDATE "Payment" SET "studentId"=$2 WHERE "id"=$1`,
        [id, otherStudentId],
        /immutable/,
      );
      await db.query(
        `SELECT set_config('schoolos.allow_payment_student_reassign','on',true)`,
      );
      await accepts(`UPDATE "Payment" SET "studentId"=$2 WHERE "id"=$1`, [
        id,
        otherStudentId,
      ]);
      // The opt-in never unlocks money fields.
      await rejects(
        `UPDATE "Payment" SET "amount"=1 WHERE "id"=$1`,
        [id],
        /immutable/,
      );
    });
    it('reverses a payment once, write-once, never reinstating it and never deleting it', async () => {
      const id = await payment();
      await db.query(
        `UPDATE "Payment" SET "status"='REVERSED',"reversedAt"=now(),"reversedById"=$2,"reversalReason"='Synthetic',"reversalIdempotencyKey"='r1' WHERE "id"=$1`,
        [id, userId],
      );
      await rejects(
        `UPDATE "Payment" SET "status"='SUCCESS' WHERE "id"=$1`,
        [id],
        /cannot be reinstated/,
      );
      await rejects(
        `UPDATE "Payment" SET "reversalReason"='rewritten' WHERE "id"=$1`,
        [id],
        /write-once/,
      );
      await rejects(
        `DELETE FROM "Payment" WHERE "id"=$1`,
        [id],
        /cannot be deleted/,
      );
    });
    it('keeps receipt identity immutable while the generated file fields stay writable', async () => {
      const paymentId = await payment();
      const receiptId = randomUUID();
      await db.query(
        `INSERT INTO "Receipt" ("id","tenantId","paymentId","receiptNumber")
         VALUES ($1,$2,$3,'REC-2060-00001')`,
        [receiptId, tenantId, paymentId],
      );
      for (const set of [
        `"receiptNumber"='REC-2060-99999'`,
        `"vatAmount"=5`,
        `"issuedAt"=now() + interval '1 day'`,
        `"fiscalYear"='2060/61'`,
        `"schoolPan"='123'`,
      ])
        await rejects(
          `UPDATE "Receipt" SET ${set} WHERE "id"=$1`,
          [receiptId],
          /Receipt_immutable|immutable/,
        );
      await accepts(
        `UPDATE "Receipt" SET "fileStatus"='AVAILABLE',"fileGeneratedAt"=now(),"pdfUrl"='x' WHERE "id"=$1`,
        [receiptId],
      );
      await rejects(
        `DELETE FROM "Receipt" WHERE "id"=$1`,
        [receiptId],
        /cannot be deleted/,
      );
    });
  });
});

describeDatabase('DocumentSequence (concurrency)', () => {
  let pool: Pool;
  const tenantId = randomUUID();
  const otherTenantId = randomUUID();

  const clientFor = (conn: PoolClient) => ({
    $queryRaw: async (sql: { text: string; values: unknown[] }) =>
      (await conn.query(sql.text, sql.values)).rows,
  });
  async function allocate(tenant: string, key: string) {
    const conn = await pool.connect();
    try {
      await conn.query('BEGIN');
      const value = await allocateDocumentNumber(
        clientFor(conn) as never,
        tenant,
        key,
      );
      await conn.query('COMMIT');
      return value;
    } finally {
      conn.release();
    }
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: authTestDatabaseUrl, max: 12 });
    await pool.query(
      `INSERT INTO "Tenant" ("id","name","slug","securityDomain") VALUES
       ($1,'Sequence school',$2,'SCHOOL'),($3,'Other sequence school',$4,'SCHOOL')`,
      [tenantId, `p73s-${tenantId}`, otherTenantId, `p73s-o-${otherTenantId}`],
    );
  });
  afterAll(async () => {
    await pool.query(`DELETE FROM "Tenant" WHERE "id" = ANY($1)`, [
      [tenantId, otherTenantId],
    ]);
    await pool.end();
  });

  it('hands 30 concurrent allocations 30 distinct, gap-free numbers', async () => {
    const values = await Promise.all(
      Array.from({ length: 30 }, () => allocate(tenantId, 'INVOICE:2060-61')),
    );
    expect(new Set(values).size).toBe(30);
    expect([...values].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 30 }, (_, index) => index + 1),
    );
  });

  it('keeps keys and tenants independent', async () => {
    expect(await allocate(tenantId, 'REFUND')).toBe(1);
    expect(await allocate(otherTenantId, 'REFUND')).toBe(1);
    expect(await allocate(tenantId, 'REFUND')).toBe(2);
    expect(await allocate(tenantId, 'INVOICE:2061-62')).toBe(1);
  });

  it('rolls the counter back with an aborted transaction (no gap)', async () => {
    const conn = await pool.connect();
    await conn.query('BEGIN');
    const burned = await allocateDocumentNumber(
      clientFor(conn) as never,
      tenantId,
      'CASHIER_CLOSE',
    );
    await conn.query('ROLLBACK');
    conn.release();
    expect(burned).toBe(1);
    expect(await allocate(tenantId, 'CASHIER_CLOSE')).toBe(1);
  });
});
