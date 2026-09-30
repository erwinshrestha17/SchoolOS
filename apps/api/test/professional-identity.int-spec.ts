import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { AuditService } from '../src/audit/audit.service';
import type { AuthContext } from '../src/auth/auth.types';
import { ProfessionalIdentityService } from '../src/hr/professional-identity.service';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  authTestDatabaseUrl,
  IsolatedAuthCls,
} from './helpers/auth-test-isolation';

// Phase 5J–5L against real PostgreSQL: service rules AND database guards.
const describeDatabase = authTestDatabaseUrl ? describe : describe.skip;
describeDatabase('Professional identity (real PostgreSQL)', () => {
  const previousUrl = process.env.DATABASE_URL;
  const cls = new IsolatedAuthCls() as unknown as ClsService;
  let prisma: PrismaService;
  let service: ProfessionalIdentityService;
  let tenantId: string;
  let otherTenantId: string;
  let staffId: string;
  let teacherUserId: string;
  let hrA: AuthContext;
  let hrB: AuthContext;
  const scoped = <T>(fn: () => Promise<T>, tenant = tenantId) =>
    prisma.runWithTenantScope(tenant, fn);
  const actor = (userId: string, tenant = tenantId) =>
    ({
      tenantId: tenant,
      userId,
      roles: [],
      permissions: [],
    }) as unknown as AuthContext;

  beforeAll(() => {
    process.env.DATABASE_URL = authTestDatabaseUrl;
    prisma = new PrismaService(cls);
    service = new ProfessionalIdentityService(
      prisma,
      new AuditService(prisma, cls),
      {} as never,
    );
  });

  beforeEach(async () => {
    tenantId = (
      await prisma.tenant.create({
        data: { name: 'Synthetic PI school', slug: `pi-${randomUUID()}` },
      })
    ).id;
    otherTenantId = (
      await prisma.tenant.create({
        data: { name: 'Other PI school', slug: `pi-other-${randomUUID()}` },
      })
    ).id;
    await scoped(async () => {
      const user = (email: string) =>
        prisma.user.create({
          data: {
            tenantId,
            email,
            passwordHash: 'synthetic-not-a-login',
            status: 'ACTIVE',
          },
        });
      teacherUserId = (await user('teacher@example.invalid')).id;
      hrA = actor((await user('hr-a@example.invalid')).id);
      hrB = actor((await user('hr-b@example.invalid')).id);
      staffId = (
        await prisma.staff.create({
          data: {
            tenantId,
            userId: teacherUserId,
            employeeId: `SYN-${randomUUID()}`,
            firstName: 'Synthetic',
            lastName: 'Teacher',
            dateOfBirth: new Date('1990-01-01'),
            gender: 'OTHER',
            address: 'Synthetic address',
            joiningDate: new Date('2025-01-01'),
            contractType: 'PERMANENT',
          } as never,
        })
      ).id;
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
  });

  const employment = (by: AuthContext, from: string, to?: string) =>
    scoped(() =>
      service.createEmployment(
        staffId,
        {
          employmentType: 'PERMANENT',
          postCategoryCode: 'TEACHER',
          schoolTypeCode: 'INSTITUTIONAL',
          effectiveFrom: from,
          effectiveTo: to,
        } as never,
        by,
      ),
    );

  it('concurrent verification of overlapping periods verifies exactly one', async () => {
    const first = await employment(hrA, '2025-04-14');
    const second = await employment(hrA, '2025-06-01', '2026-03-31');
    const results = await Promise.allSettled([
      scoped(() =>
        service.reviewEmployment(
          staffId,
          first.id,
          { decision: 'VERIFY' },
          hrB,
        ),
      ),
      scoped(() =>
        service.reviewEmployment(
          staffId,
          second.id,
          { decision: 'VERIFY' },
          hrB,
        ),
      ),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ConflictException);
    expect(rejected[0].reason.getResponse()).toMatchObject({
      code: 'EMPLOYMENT_OVERLAP',
    });
    const verified = await scoped(() =>
      prisma.staffEmployment.count({
        where: { tenantId, staffId, status: 'VERIFIED' },
      }),
    );
    expect(verified).toBe(1);
  });

  it('maker-checker holds in the service and in the database', async () => {
    const row = await employment(hrA, '2025-04-14');
    await expect(
      scoped(() =>
        service.reviewEmployment(staffId, row.id, { decision: 'VERIFY' }, hrA),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      scoped(() =>
        service.reviewEmployment(
          staffId,
          row.id,
          { decision: 'VERIFY' },
          actor(teacherUserId),
        ),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    // Bypassing the service: the CHECK constraint still refuses.
    await expect(
      scoped(
        () =>
          prisma.$executeRaw`UPDATE "StaffEmployment" SET "status" = 'VERIFIED',
          "verifiedById" = ${hrA.userId}, "verifiedAt" = now() WHERE "id" = ${row.id}`,
      ),
    ).rejects.toThrow(/maker_checker/);
  });

  it('the submitter is immutable and must belong to the tenant', async () => {
    const row = await employment(hrA, '2025-04-14');
    await expect(
      scoped(
        () =>
          prisma.$executeRaw`UPDATE "StaffEmployment" SET "submittedById" = ${hrB.userId} WHERE "id" = ${row.id}`,
      ),
    ).rejects.toThrow(/submitter is immutable/);
    const outsider = await scoped(
      () =>
        prisma.user.create({
          data: {
            tenantId: otherTenantId,
            email: 'x@example.invalid',
            passwordHash: 'x',
          },
        }),
      otherTenantId,
    );
    await expect(
      scoped(
        () =>
          prisma.$executeRaw`INSERT INTO "StaffEmployment" ("id","tenantId","staffId","employmentType","postCategoryCode","schoolTypeCode","effectiveFrom","submittedById")
          VALUES (${randomUUID()}, ${tenantId}, ${staffId}, 'PERMANENT', 'TEACHER', 'INSTITUTIONAL', now(), ${outsider.id})`,
      ),
    ).rejects.toThrow(/must belong to the tenant/);
  });

  it('evidence: pending by default, needs a source to verify, revocable with reason, fully audited', async () => {
    await scoped(() =>
      service.createTeacherProfile(
        staffId,
        { effectiveFrom: '2025-04-14' },
        hrA,
      ),
    );
    const bare = await scoped(() =>
      service.addLicence(
        staffId,
        {
          authorityCode: 'tsc',
          externalReference: 'L-1',
          validFrom: '2025-01-01',
        } as never,
        hrA,
      ),
    );
    expect(bare.status).toBe('PENDING');
    await expect(
      scoped(() =>
        service.reviewEvidence(
          'licence',
          staffId,
          bare.id,
          { decision: 'VERIFY' },
          hrB,
        ),
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'EVIDENCE_SOURCE_REQUIRED' }),
    });

    const sourced = await scoped(() =>
      service.addLicence(
        staffId,
        {
          authorityCode: 'TSC',
          externalReference: 'L-2',
          validFrom: '2025-01-01',
          sourceUri: 'https://tsc.gov.np/verify/L-2',
        } as never,
        hrA,
      ),
    );
    const verified = await scoped(() =>
      service.reviewEvidence(
        'licence',
        staffId,
        sourced.id,
        { decision: 'VERIFY' },
        hrB,
      ),
    );
    expect(verified.status).toBe('VERIFIED');
    // Verified content is immutable at the DB level.
    await expect(
      scoped(
        () =>
          prisma.$executeRaw`UPDATE "TeachingLicenceEvidence" SET "externalReference" = 'forged' WHERE "id" = ${sourced.id}`,
      ),
    ).rejects.toThrow(/immutable/);
    const revoked = await scoped(() =>
      service.revokeEvidence(
        'licence',
        staffId,
        sourced.id,
        { reason: 'Revoked by issuing authority' },
        hrB,
      ),
    );
    expect(revoked.status).toBe('REVOKED');

    const audits = await scoped(() =>
      prisma.auditLog.findMany({
        where: {
          tenantId,
          resource: 'teaching_licence_evidence',
          resourceId: sourced.id,
        },
        orderBy: { createdAt: 'asc' },
      }),
    );
    expect(audits.map((a) => a.action)).toEqual(['submit', 'verify', 'revoke']);
  });

  it("evidence documents must be this staff member's own staff documents", async () => {
    await scoped(() =>
      service.createTeacherProfile(
        staffId,
        { effectiveFrom: '2025-04-14' },
        hrA,
      ),
    );
    const file = (key: string) =>
      scoped(() =>
        prisma.fileAsset.create({
          data: {
            tenantId,
            originalFilename: `${key}.pdf`,
            objectKey: `${tenantId}/staff_documents/${randomUUID()}.pdf`,
            mimeType: 'application/pdf',
            sizeBytes: BigInt(1024),
          },
        }),
      );
    const certificate = await file('certificate');
    const unrelated = await file('unrelated-student-file');
    await scoped(() =>
      prisma.staffDocument.create({
        data: {
          tenantId,
          staffId,
          kind: 'ACADEMIC_CERTIFICATE',
          fileId: certificate.id,
          name: 'B.Ed certificate',
        },
      }),
    );

    const accepted = await scoped(() =>
      service.addQualification(
        staffId,
        {
          qualification: 'B.Ed',
          validFrom: '2025-01-01',
          documentId: certificate.id,
        } as never,
        hrA,
      ),
    );
    expect(accepted).toMatchObject({
      status: 'PENDING',
      documentId: certificate.id,
    });
    // A document makes it verifiable by an independent reviewer.
    await expect(
      scoped(() =>
        service.reviewEvidence(
          'qualification',
          staffId,
          accepted.id,
          { decision: 'VERIFY' },
          hrB,
        ),
      ),
    ).resolves.toMatchObject({ status: 'VERIFIED' });

    await expect(
      scoped(() =>
        service.addQualification(
          staffId,
          {
            qualification: 'M.Ed',
            validFrom: '2025-01-01',
            documentId: unrelated.id,
          } as never,
          hrA,
        ),
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'EVIDENCE_DOCUMENT_NOT_STAFF_RECORD',
      }),
    });
  });

  it("never reveals another tenant's staff", async () => {
    await expect(
      scoped(
        () => service.getOverview(staffId, actor(randomUUID(), otherTenantId)),
        otherTenantId,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
