import { randomUUID } from 'node:crypto';
import { ClsService } from 'nestjs-cls';
import { Prisma } from '@prisma/client';
import type { AuthContext } from '../src/auth/auth.types';
import { AdmissionsService } from '../src/admissions/admissions.service';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  authTestDatabaseUrl,
  IsolatedAuthCls,
} from './helpers/auth-test-isolation';

// Phase 5B applications workspace against real PostgreSQL: JSON-path filters
// must not silently drop rows whose metadata lacks a key (SQL NULL), and the
// list must never return raw case metadata.
const describeDatabase = authTestDatabaseUrl ? describe : describe.skip;
describeDatabase('Admission applications workspace (real PostgreSQL)', () => {
  const previousUrl = process.env.DATABASE_URL;
  const cls = new IsolatedAuthCls() as unknown as ClsService;
  let prisma: PrismaService;
  let service: AdmissionsService;
  let tenantId: string;
  let actor: AuthContext;
  let otherReviewerId: string;
  const ids: Record<string, string> = {};
  const scoped = <T>(fn: () => Promise<T>) =>
    prisma.runWithTenantScope(tenantId, fn);
  const list = (query: Record<string, unknown>) =>
    scoped(() =>
      service.listApplications({ limit: 100, ...query } as never, actor),
    );
  const names = async (query: Record<string, unknown>) =>
    (await list(query)).items.map((item) => item.firstNameEn).sort();

  beforeAll(async () => {
    process.env.DATABASE_URL = authTestDatabaseUrl;
    prisma = new PrismaService(cls);
    // listApplications only reads through Prisma; other collaborators are
    // inert stubs.
    const stub = {} as never;
    service = new AdmissionsService(
      prisma,
      stub,
      stub,
      stub,
      stub,
      stub,
      stub,
      stub,
      stub,
      stub,
      stub,
      stub,
      stub,
    );
    tenantId = (
      await prisma.tenant.create({
        data: { name: 'Applications workspace', slug: `apps-${randomUUID()}` },
      })
    ).id;
    await scoped(async () => {
      const user = (email: string) =>
        prisma.user.create({
          data: { tenantId, email, passwordHash: 'x', status: 'ACTIVE' },
        });
      const me = await user('reviewer-me@example.invalid');
      const other = await user('reviewer-other@example.invalid');
      otherReviewerId = other.id;
      actor = { tenantId, userId: me.id, roles: [], permissions: [] } as never;
      await prisma.staff.create({
        data: {
          tenantId,
          userId: other.id,
          employeeId: `E-${randomUUID()}`,
          firstName: 'Sita',
          lastName: 'Rai',
          dateOfBirth: new Date('1990-01-01'),
          gender: 'FEMALE',
          address: 'Synthetic',
          joiningDate: new Date('2025-01-01'),
          contractType: 'PERMANENT',
        } as never,
      });
      const make = async (name: string, duplicateReview: unknown) => {
        const row = await prisma.admissionApplication.create({
          data: {
            tenantId,
            firstNameEn: name,
            lastNameEn: 'Applicant',
            duplicateReview:
              duplicateReview === null
                ? Prisma.JsonNull
                : (duplicateReview as Prisma.InputJsonValue),
          },
        });
        ids[name] = row.id;
      };
      await make('Legacy', null);
      await make('Empty', {});
      await make('Pending', {
        followUps: [
          { code: 'DOCUMENTS_PENDING', label: 'Docs', blocking: true },
        ],
        review: { reviewerUserId: me.id },
        medicalConditions: 'PRIVATE-ASTHMA',
        emergencyPhone: '9800000009',
        nationalStudentId: 'PRIVATE-NID',
      });
      await make('OnFile', {
        followUps: [{ code: 'OTHER', label: 'x', blocking: false }],
        documents: [{ fileId: 'f1', kind: 'BIRTH_CERTIFICATE' }],
        review: {
          reviewerUserId: other.id,
          notes: [
            { action: 'X', reason: 'PRIVATE-NOTE', at: 'now', byUserId: me.id },
          ],
        },
      });
      await make('Duplicate', {
        duplicateRisk: true,
        duplicateCandidates: [
          {
            studentId: 's1',
            studentSystemId: 'STU-1',
            fullNameEn: 'Twin',
            className: '5',
            sectionName: null,
            lifecycleStatus: 'ACTIVE',
          },
        ],
      });
      await prisma.admissionAssessmentSession.create({
        data: {
          tenantId,
          admissionCaseId: ids.OnFile,
          scheduledAt: new Date('2026-10-05T04:15:00.000Z'),
          status: 'COMPLETED',
          result: 'PASS',
        },
      });
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
  });

  it('document filter: pending vs not pending covers every row', async () => {
    expect(await names({ documentState: 'PENDING' })).toEqual(['Pending']);
    expect(await names({ documentState: 'NOT_PENDING' })).toEqual([
      'Duplicate',
      'Empty',
      'Legacy',
      'OnFile',
    ]);
  });

  it('reviewer filter: assigned to me vs unassigned', async () => {
    expect(await names({ reviewer: 'ME' })).toEqual(['Pending']);
    expect(await names({ reviewer: 'UNASSIGNED' })).toEqual([
      'Duplicate',
      'Empty',
      'Legacy',
    ]);
  });

  it('rows carry reference, document state, assessment and reviewer', async () => {
    const byName = Object.fromEntries(
      (await list({})).items.map((item) => [item.firstNameEn, item]),
    );
    expect(byName.OnFile).toMatchObject({
      documentState: 'ON_FILE',
      assessment: { status: 'COMPLETED', result: 'PASS' },
      reviewer: { assignedToMe: false, name: 'Sita Rai' },
    });
    expect(byName.Pending).toMatchObject({
      documentState: 'PENDING',
      reviewer: { assignedToMe: true },
    });
    expect(byName.Legacy).toMatchObject({
      documentState: 'NOT_RECORDED',
      assessment: null,
      reviewer: null,
    });
    expect(byName.Duplicate.duplicateReview).toEqual({
      hasWarnings: true,
      matches: [
        {
          studentId: 's1',
          studentSystemId: 'STU-1',
          fullNameEn: 'Twin',
          matchTypes: [],
        },
      ],
    });
    expect(byName.OnFile.reference).toMatch(/^APP-[0-9A-F]{8}$/);
    expect(otherReviewerId).toBeTruthy();
  });

  it('never returns raw case metadata', async () => {
    const payload = JSON.stringify(await list({}));
    for (const secret of [
      'PRIVATE-ASTHMA',
      '9800000009',
      'PRIVATE-NID',
      'PRIVATE-NOTE',
      'followUps',
      'medicalConditions',
    ]) {
      expect(payload).not.toContain(secret);
    }
  });

  it('finds an application by its reference', async () => {
    const reference = (await list({})).items.find(
      (item) => item.firstNameEn === 'OnFile',
    )!.reference;
    expect(await names({ search: reference })).toEqual(['OnFile']);
    // Case-insensitive, and a partial reference (4+ hex characters) works.
    expect(await names({ search: reference.toLowerCase() })).toEqual([
      'OnFile',
    ]);
    expect(await names({ search: reference.slice(0, 10) })).toEqual(['OnFile']);
    // Bare digits/hex are not treated as a reference (could be a phone).
    expect(
      await names({ search: reference.slice(4).toLowerCase() }),
    ).not.toContain('Pending');
  });
});
