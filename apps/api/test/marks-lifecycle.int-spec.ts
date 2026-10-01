import { randomUUID } from 'node:crypto';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { MarkEntryStatus, MarkSheetStatus, Prisma } from '@prisma/client';
import { AuditService } from '../src/audit/audit.service';
import type { AuthContext } from '../src/auth/auth.types';
import { MarkSheetService } from '../src/academics/mark-sheet.service';
import { MarkLockWorkflowService } from '../src/academics/mark-lock-workflow.service';
import { MarkReadinessService } from '../src/academics/mark-readiness.service';
import { MarksService } from '../src/academics/marks.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { IsolatedAuthCls } from './helpers/auth-test-isolation';

const databaseUrl = process.env.SCHOOLOS_MARKS_TEST_DATABASE_URL;
if (databaseUrl) {
  const target = new URL(databaseUrl);
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
    target.pathname !== '/schoolos_marks_test'
  ) {
    throw new Error('Marks tests require a dedicated loopback test database.');
  }
}

function errorCode(reason: unknown): string | undefined {
  if (
    !(reason instanceof ConflictException) &&
    !(reason instanceof ForbiddenException)
  ) {
    return undefined;
  }
  const body = reason.getResponse();
  return typeof body === 'object' && body !== null && 'code' in body
    ? String((body as { code: unknown }).code)
    : undefined;
}

// Phase 6.3: real PostgreSQL constraints, triggers and lifecycle races.
// Actors use the admin role so the teacher-scope resolver (covered by its
// own suites) is not under test here; permissions are explicit.
(databaseUrl ? describe : describe.skip)('Marks lifecycle (PostgreSQL)', () => {
  const previousUrl = process.env.DATABASE_URL;
  let prisma: PrismaService;
  let sheets: MarkSheetService;
  let marks: MarksService;
  let readiness: MarkReadinessService;
  let termLocks: MarkLockWorkflowService;
  let tenantId: string;
  let termId: string;
  let componentId: string;
  let subjectId: string;
  let classId: string;
  let sectionId: string;
  let studentIds: string[];
  let teacher: AuthContext;
  let reviewer: AuthContext;
  let principal: AuthContext;
  const scoped = <T>(fn: () => Promise<T>) =>
    prisma.runWithTenantScope(tenantId, fn);
  const key = () => `test-${randomUUID()}`;

  const makeActor = async (
    label: string,
    permissions: string[],
  ): Promise<AuthContext> => {
    const user = await prisma.user.create({
      data: {
        tenantId,
        email: `${label}-${randomUUID()}@example.invalid`,
        passwordHash: 'synthetic-unused',
      },
    });
    return {
      tenantId,
      tenantSlug: 'marks',
      userId: user.id,
      email: user.email,
      authMethod: 'PASSWORD',
      roles: ['admin'],
      permissions,
    } as AuthContext;
  };

  const save = (actor: AuthContext, entries: Record<string, unknown>[]) =>
    scoped(() =>
      marks.bulkUpsert(
        {
          examTermId: termId,
          assessmentComponentId: componentId,
          subjectId,
          classId,
          sectionId,
          entries: entries as never,
        },
        actor,
      ),
    );

  const sheet = () =>
    scoped(() =>
      prisma.markSheet.findFirstOrThrow({
        where: { tenantId, assessmentComponentId: componentId, sectionId },
      }),
    );

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    const cls = new IsolatedAuthCls() as unknown as ClsService;
    prisma = new PrismaService(cls);
    const audit = new AuditService(prisma, cls);
    const teacherScope = {} as never;
    sheets = new MarkSheetService(prisma, audit, teacherScope);
    marks = new MarksService(prisma, audit, teacherScope, sheets);
    readiness = new MarkReadinessService(prisma);
    termLocks = new MarkLockWorkflowService(prisma, audit, readiness);
  });

  beforeEach(async () => {
    const tenant = await prisma.tenant.create({
      data: { name: 'Synthetic marks test', slug: `marks-${randomUUID()}` },
    });
    tenantId = tenant.id;
    await scoped(async () => {
      teacher = await makeActor('teacher', ['academics:enter_marks']);
      reviewer = await makeActor('reviewer', ['marks:review_lock']);
      principal = await makeActor('principal', [
        'academics:enter_marks',
        'marks:review_lock',
        'exam-terms:unlock',
      ]);
      const year = await prisma.academicYear.create({
        data: {
          tenantId,
          name: 'Synthetic 2026',
          startsOn: new Date('2026-01-01'),
          endsOn: new Date('2026-12-31'),
        },
      });
      classId = (
        await prisma.class.create({
          data: { tenantId, name: 'Grade 9', level: 9 },
        })
      ).id;
      sectionId = (
        await prisma.section.create({ data: { tenantId, classId, name: 'A' } })
      ).id;
      subjectId = (
        await prisma.subject.create({
          data: {
            tenantId,
            classId,
            name: 'Science',
            code: `SCI-${randomUUID().slice(0, 6)}`,
            type: 'CORE',
          } as never,
        })
      ).id;
      termId = (
        await prisma.examTerm.create({
          data: {
            tenantId,
            academicYearId: year.id,
            name: `First Term ${randomUUID().slice(0, 6)}`,
            startsOn: new Date('2026-04-01'),
            endsOn: new Date('2026-06-30'),
          },
        })
      ).id;
      componentId = (
        await prisma.assessmentComponent.create({
          data: {
            tenantId,
            examTermId: termId,
            subjectId,
            name: 'Theory',
            maxMarks: new Prisma.Decimal(75),
          },
        })
      ).id;
      studentIds = [];
      for (const name of ['Asha', 'Bikash']) {
        studentIds.push(
          (
            await prisma.student.create({
              data: {
                tenantId,
                classId,
                sectionId,
                studentSystemId: randomUUID(),
                firstNameEn: name,
                lastNameEn: 'Synthetic',
                gender: 'OTHER',
                dateOfBirth: new Date('2012-01-01'),
                admissionDate: new Date('2026-01-01'),
              } as never,
            })
          ).id,
        );
      }
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
  });

  describe('database invariants', () => {
    it('stores absent and withheld marks without a number', async () => {
      await save(teacher, [
        { studentId: studentIds[0], isAbsent: true, marksObtained: 40 },
        { studentId: studentIds[1], isWithheld: true },
      ]);
      const rows = await scoped(() =>
        prisma.markEntry.findMany({
          where: { tenantId },
          orderBy: { status: 'asc' },
        }),
      );
      expect(rows.map((row) => [row.status, row.marksObtained])).toEqual([
        [MarkEntryStatus.ABSENT, null],
        [MarkEntryStatus.WITHHELD, null],
      ]);
    });

    it('rejects a numeric mark on an absent entry at the database', async () => {
      await expect(
        scoped(() =>
          prisma.markEntry.create({
            data: {
              tenantId,
              examTermId: termId,
              assessmentComponentId: componentId,
              subjectId,
              studentId: studentIds[0],
              status: MarkEntryStatus.ABSENT,
              marksObtained: new Prisma.Decimal(0),
            },
          }),
        ),
      ).rejects.toThrow(/MarkEntry_marks_match_status_check/);
    });

    it('rejects marks above the component maximum at the database', async () => {
      await expect(
        scoped(() =>
          prisma.markEntry.create({
            data: {
              tenantId,
              examTermId: termId,
              assessmentComponentId: componentId,
              subjectId,
              studentId: studentIds[0],
              status: MarkEntryStatus.SUBMITTED,
              marksObtained: new Prisma.Decimal(76),
            },
          }),
        ),
      ).rejects.toThrow(/MarkEntry_marks_exceed_max/);
    });

    it('freezes the component maximum once marks are submitted', async () => {
      await save(teacher, [
        { studentId: studentIds[0], marksObtained: 70 },
        { studentId: studentIds[1], marksObtained: 50 },
      ]);
      // Lowering below an entered mark is refused even in DRAFT.
      await expect(
        scoped(() =>
          prisma.assessmentComponent.update({
            where: { id: componentId },
            data: { maxMarks: new Prisma.Decimal(60) },
          }),
        ),
      ).rejects.toThrow(/AssessmentComponent_max_below_entered_marks/);

      const draft = await sheet();
      await scoped(() =>
        sheets.submit(
          draft.id,
          { expectedVersion: draft.version, idempotencyKey: key() },
          teacher,
        ),
      );
      await expect(
        scoped(() =>
          prisma.assessmentComponent.update({
            where: { id: componentId },
            data: { maxMarks: new Prisma.Decimal(100) },
          }),
        ),
      ).rejects.toThrow(/AssessmentComponent_max_marks_frozen/);
    });
  });

  describe('lifecycle', () => {
    const fillAll = () =>
      save(teacher, [
        { studentId: studentIds[0], marksObtained: 60 },
        { studentId: studentIds[1], isAbsent: true },
      ]);

    it('runs submit -> return -> resubmit -> review -> lock with separate duties', async () => {
      await fillAll();
      let current = await sheet();
      expect(current.status).toBe(MarkSheetStatus.DRAFT);

      current = await scoped(() =>
        sheets.submit(
          current.id,
          { expectedVersion: current.version, idempotencyKey: key() },
          teacher,
        ),
      );
      expect(current.status).toBe(MarkSheetStatus.SUBMITTED);

      // Entry is frozen while under review.
      const frozen = await save(teacher, [
        {
          studentId: studentIds[0],
          marksObtained: 61,
          expectedVersion: (
            await scoped(() =>
              prisma.markEntry.findFirstOrThrow({
                where: { tenantId, studentId: studentIds[0] },
              }),
            )
          ).updatedAt.toISOString(),
        },
      ]).catch((error: unknown) => error);
      expect(errorCode(frozen)).toBe('MARK_SHEET_NOT_EDITABLE');

      current = await scoped(() =>
        sheets.review(
          current.id,
          {
            action: 'RETURN',
            reason: 'Recheck Asha practical total',
            expectedVersion: current.version,
            idempotencyKey: key(),
          },
          reviewer,
        ),
      );
      expect(current.status).toBe(MarkSheetStatus.RETURNED);

      const asha = await scoped(() =>
        prisma.markEntry.findFirstOrThrow({
          where: { tenantId, studentId: studentIds[0] },
        }),
      );
      await save(teacher, [
        {
          studentId: studentIds[0],
          marksObtained: 62,
          expectedVersion: asha.updatedAt.toISOString(),
        },
      ]);

      current = await sheet();
      current = await scoped(() =>
        sheets.submit(
          current.id,
          { expectedVersion: current.version, idempotencyKey: key() },
          teacher,
        ),
      );
      expect(current.status).toBe(MarkSheetStatus.RESUBMITTED);

      current = await scoped(() =>
        sheets.review(
          current.id,
          {
            action: 'REVIEW',
            expectedVersion: current.version,
            idempotencyKey: key(),
          },
          reviewer,
        ),
      );
      current = await scoped(() =>
        sheets.review(
          current.id,
          {
            action: 'LOCK',
            expectedVersion: current.version,
            idempotencyKey: key(),
          },
          principal,
        ),
      );
      expect(current.status).toBe(MarkSheetStatus.LOCKED);

      const entries = await scoped(() =>
        prisma.markEntry.findMany({ where: { tenantId } }),
      );
      expect(entries.every((entry) => entry.isLocked)).toBe(true);
      const history = await scoped(() => sheets.history(current.id, principal));
      expect(history.map((row) => row.action)).toEqual([
        'SUBMIT',
        'RETURN',
        'RESUBMIT',
        'REVIEW',
        'LOCK',
      ]);
    });

    it('refuses to submit while a student has no final mark', async () => {
      await save(teacher, [{ studentId: studentIds[0], marksObtained: 60 }]);
      const current = await sheet();
      const result = await scoped(() =>
        sheets.submit(
          current.id,
          { expectedVersion: current.version, idempotencyKey: key() },
          teacher,
        ),
      ).catch((error: unknown) => error);
      expect(errorCode(result)).toBe('MARK_SHEET_INCOMPLETE');
    });

    it('the submitter cannot review or lock their own marks', async () => {
      await fillAll();
      let current = await sheet();
      current = await scoped(() =>
        sheets.submit(
          current.id,
          { expectedVersion: current.version, idempotencyKey: key() },
          principal,
        ),
      );
      const result = await scoped(() =>
        sheets.review(
          current.id,
          {
            action: 'REVIEW',
            expectedVersion: current.version,
            idempotencyKey: key(),
          },
          principal,
        ),
      ).catch((error: unknown) => error);
      expect(errorCode(result)).toBe('SELF_APPROVAL_PROHIBITED');
      expect(sheets.allowedActions(current, principal)).not.toContain('REVIEW');
    });

    it('a retried submit with the same key returns the original outcome once', async () => {
      await fillAll();
      const draft = await sheet();
      const idempotencyKey = key();
      const submit = () =>
        scoped(() =>
          sheets.submit(
            draft.id,
            { expectedVersion: draft.version, idempotencyKey },
            teacher,
          ),
        );
      const [first, second] = await Promise.all([submit(), submit()]);
      expect(first.status).toBe(MarkSheetStatus.SUBMITTED);
      expect(second.version).toBe(first.version);
      const transitions = await scoped(() =>
        prisma.markSheetTransition.count({
          where: { tenantId, markSheetId: draft.id },
        }),
      );
      expect(transitions).toBe(1);

      // The same key cannot be reused for another action.
      const reused = await scoped(() =>
        sheets.review(
          draft.id,
          { action: 'REVIEW', expectedVersion: first.version, idempotencyKey },
          reviewer,
        ),
      ).catch((error: unknown) => error);
      expect(errorCode(reused)).toBe('IDEMPOTENCY_KEY_REUSED');
    });

    it('two reviewers deciding the same version: exactly one wins', async () => {
      await fillAll();
      let current = await sheet();
      current = await scoped(() =>
        sheets.submit(
          current.id,
          { expectedVersion: current.version, idempotencyKey: key() },
          teacher,
        ),
      );
      const results = await Promise.allSettled([
        scoped(() =>
          sheets.review(
            current.id,
            {
              action: 'REVIEW',
              expectedVersion: current.version,
              idempotencyKey: key(),
            },
            reviewer,
          ),
        ),
        scoped(() =>
          sheets.review(
            current.id,
            {
              action: 'RETURN',
              reason: 'Competing decision',
              expectedVersion: current.version,
              idempotencyKey: key(),
            },
            principal,
          ),
        ),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const loser = results.find(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      );
      expect([
        'MARK_SHEET_VERSION_CONFLICT',
        'MARK_SHEET_INVALID_TRANSITION',
      ]).toContain(errorCode(loser?.reason));
    });

    it('two teachers saving the same mark from the same version: one conflict, no lost update', async () => {
      await save(teacher, [{ studentId: studentIds[0], marksObtained: 40 }]);
      const row = await scoped(() =>
        prisma.markEntry.findFirstOrThrow({
          where: { tenantId, studentId: studentIds[0] },
        }),
      );
      const version = row.updatedAt.toISOString();
      const results = await Promise.allSettled([
        save(teacher, [
          {
            studentId: studentIds[0],
            marksObtained: 41,
            expectedVersion: version,
          },
        ]),
        save(principal, [
          {
            studentId: studentIds[0],
            marksObtained: 42,
            expectedVersion: version,
          },
        ]),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const loser = results.find(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      );
      expect(errorCode(loser?.reason)).toBe('MARK_VERSION_CONFLICT');
    });

    it('changing an existing mark without its version is refused', async () => {
      await save(teacher, [{ studentId: studentIds[0], marksObtained: 40 }]);
      const result = await save(teacher, [
        { studentId: studentIds[0], marksObtained: 45 },
      ]).catch((error: unknown) => error);
      expect(errorCode(result)).toBe('MARK_VERSION_CONFLICT');
    });

    it('a save racing a lock either lands before the lock or is refused', async () => {
      await fillAll();
      let current = await sheet();
      current = await scoped(() =>
        sheets.submit(
          current.id,
          { expectedVersion: current.version, idempotencyKey: key() },
          teacher,
        ),
      );
      current = await scoped(() =>
        sheets.review(
          current.id,
          {
            action: 'RETURN',
            reason: 'One more look',
            expectedVersion: current.version,
            idempotencyKey: key(),
          },
          reviewer,
        ),
      );
      const asha = await scoped(() =>
        prisma.markEntry.findFirstOrThrow({
          where: { tenantId, studentId: studentIds[0] },
        }),
      );
      // A RETURNED sheet cannot be locked directly; resubmission is needed,
      // so the save always wins here and the sheet stays editable.
      const [saveResult] = await Promise.allSettled([
        save(teacher, [
          {
            studentId: studentIds[0],
            marksObtained: 63,
            expectedVersion: asha.updatedAt.toISOString(),
          },
        ]),
        scoped(() =>
          sheets.review(
            current.id,
            {
              action: 'LOCK',
              expectedVersion: current.version,
              idempotencyKey: key(),
            },
            principal,
          ),
        ),
      ]);
      expect(saveResult.status).toBe('fulfilled');
      expect((await sheet()).status).toBe(MarkSheetStatus.RETURNED);
    });
  });

  describe('term lock gate and readiness (6E/6H)', () => {
    const fillAndLockSheet = async () => {
      await save(teacher, [
        { studentId: studentIds[0], marksObtained: 60 },
        { studentId: studentIds[1], isAbsent: true },
      ]);
      let current = await sheet();
      current = await scoped(() =>
        sheets.submit(
          current.id,
          { expectedVersion: current.version, idempotencyKey: key() },
          teacher,
        ),
      );
      current = await scoped(() =>
        sheets.review(
          current.id,
          {
            action: 'REVIEW',
            expectedVersion: current.version,
            idempotencyKey: key(),
          },
          reviewer,
        ),
      );
      return scoped(() =>
        sheets.review(
          current.id,
          {
            action: 'LOCK',
            expectedVersion: current.version,
            idempotencyKey: key(),
          },
          principal,
        ),
      );
    };

    it('reports exact component x section readiness', async () => {
      await save(teacher, [{ studentId: studentIds[0], marksObtained: 60 }]);
      const result = await scoped(() =>
        readiness.getTermReadiness(termId, principal),
      );
      expect(result.cells).toEqual([
        expect.objectContaining({
          assessmentComponentId: componentId,
          sectionId,
          studentCount: 2,
          finalCount: 1,
          sheetStatus: 'DRAFT',
          state: 'IN_PROGRESS',
        }),
      ]);
      expect(result.allLocked).toBe(false);
    });

    it('refuses a term lock while any sheet is not locked', async () => {
      await save(teacher, [{ studentId: studentIds[0], marksObtained: 60 }]);
      const result = await scoped(() =>
        termLocks.request(
          { examTermId: termId, reason: 'Term complete' } as never,
          teacher,
        ),
      ).catch((error: unknown) => error);
      expect(errorCode(result)).toBe('TERM_LOCK_BLOCKED');
    });

    it('locks the term only after every sheet is locked, by someone other than the requester', async () => {
      await fillAndLockSheet();
      const request = await scoped(() =>
        termLocks.request(
          { examTermId: termId, reason: 'Term complete' } as never,
          reviewer,
        ),
      );
      const own = await scoped(() =>
        termLocks.review(request.id, { status: 'APPROVED' } as never, reviewer),
      ).catch((error: unknown) => error);
      expect(errorCode(own)).toBe('SELF_APPROVAL_PROHIBITED');

      await scoped(() =>
        termLocks.review(
          request.id,
          { status: 'APPROVED' } as never,
          principal,
        ),
      );
      const term = await scoped(() =>
        prisma.examTerm.findUniqueOrThrow({ where: { id: termId } }),
      );
      expect(term.isLocked).toBe(true);

      const locked = await sheet();
      const unlock = await scoped(() =>
        sheets.unlock(
          locked.id,
          {
            reason: 'Correct a transcription error',
            expectedVersion: locked.version,
            idempotencyKey: key(),
          },
          principal,
        ),
      ).catch((error: unknown) => error);
      expect(errorCode(unlock)).toBe('EXAM_TERM_LOCKED');
    });

    it('a sheet unlock racing a term lock never leaves an open sheet in a locked term', async () => {
      await fillAndLockSheet();
      const request = await scoped(() =>
        termLocks.request(
          { examTermId: termId, reason: 'Term complete' } as never,
          reviewer,
        ),
      );
      const locked = await sheet();
      await Promise.allSettled([
        scoped(() =>
          termLocks.review(
            request.id,
            { status: 'APPROVED' } as never,
            principal,
          ),
        ),
        scoped(() =>
          sheets.unlock(
            locked.id,
            {
              reason: 'Correct a transcription error',
              expectedVersion: locked.version,
              idempotencyKey: key(),
            },
            principal,
          ),
        ),
      ]);
      const term = await scoped(() =>
        prisma.examTerm.findUniqueOrThrow({ where: { id: termId } }),
      );
      const after = await sheet();
      expect(after.status).toBe(
        term.isLocked ? MarkSheetStatus.LOCKED : MarkSheetStatus.RETURNED,
      );
    });
  });
});
