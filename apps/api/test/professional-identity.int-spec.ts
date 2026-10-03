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
  let teacherActor: AuthContext;
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
      // Phase 7.10: decisions re-check the live session and `hr:manage`
      // grant, so every acting user holds a real role and an active session.
      const permission = await prisma.permission.upsert({
        where: { resource_action: { resource: 'hr', action: 'manage' } },
        create: { resource: 'hr', action: 'manage' },
        update: {},
      });
      const role = await prisma.role.create({
        data: {
          tenantId,
          name: `pi-hr-${randomUUID().slice(0, 8)}`,
          rolePermissions: { create: [{ permissionId: permission.id }] },
        },
      });
      const user = (email: string) =>
        prisma.user.create({
          data: {
            tenantId,
            email,
            passwordHash: 'synthetic-not-a-login',
            status: 'ACTIVE',
          },
        });
      const live = async (email: string): Promise<AuthContext> => {
        const created = await user(email);
        await prisma.userRole.create({
          data: { tenantId, userId: created.id, roleId: role.id },
        });
        const familyId = randomUUID();
        await prisma.refreshToken.create({
          data: {
            userId: created.id,
            familyId,
            tokenHash: randomUUID(),
            expiresAt: new Date(Date.now() + 600_000),
          },
        });
        return {
          tenantId,
          tenantSlug: 'synthetic',
          userId: created.id,
          email,
          sessionFamilyId: familyId,
          authMethod: 'PASSWORD',
          roles: [role.name],
          permissions: ['hr:manage'],
        } as unknown as AuthContext;
      };
      teacherActor = await live('teacher@example.invalid');
      teacherUserId = teacherActor.userId;
      hrA = await live('hr-a@example.invalid');
      hrB = await live('hr-b@example.invalid');
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
          teacherActor,
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

  const verify = async (id: string) =>
    scoped(() =>
      service.reviewEmployment(staffId, id, { decision: 'VERIFY' }, hrB),
    );
  const respons = (
    employmentId: string,
    kind: 'PRIMARY' | 'SECONDARY',
    from: string,
    to?: string,
  ) =>
    scoped(() =>
      service.addResponsibility(
        staffId,
        {
          employmentId,
          kind,
          title: kind === 'PRIMARY' ? 'Class teacher' : 'Exam coordinator',
          effectiveFrom: from,
          effectiveTo: to,
        } as never,
        hrA,
      ),
    );

  it('a new verified period cannot overlap ENDED employment history (7.1)', async () => {
    const first = await employment(hrA, '2025-01-01');
    await verify(first.id);
    await scoped(() =>
      service.endEmployment(
        staffId,
        first.id,
        { effectiveTo: '2025-12-31', reason: 'Resigned' },
        hrB,
      ),
    );
    const overlapping = await employment(hrA, '2025-06-01');
    await expect(verify(overlapping.id)).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'EMPLOYMENT_OVERLAP',
        overlappingEmploymentId: first.id,
      }),
    });
    // Re-employment starting exactly when the previous period ended is valid.
    const rehire = await employment(hrA, '2025-12-31');
    await expect(verify(rehire.id)).resolves.toMatchObject({
      status: 'VERIFIED',
    });
  });

  it('enforces one primary responsibility, allows secondary ones, and closes them when employment ends (7.1)', async () => {
    const row = await employment(hrA, '2025-01-01');
    await verify(row.id);
    const primary = await respons(row.id, 'PRIMARY', '2025-02-01');
    await expect(
      respons(row.id, 'PRIMARY', '2025-06-01'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'PRIMARY_RESPONSIBILITY_OVERLAP',
        overlappingResponsibilityId: primary.id,
      }),
    });
    await respons(row.id, 'SECONDARY', '2025-03-01');
    // A future-dated responsibility that would only start after the end.
    const future = await respons(row.id, 'SECONDARY', '2026-09-01');

    // The database exclusion constraint also refuses a racing primary that
    // slipped past the service pre-check.
    await expect(
      scoped(
        () =>
          prisma.$executeRaw`INSERT INTO "StaffResponsibility" ("id","tenantId","staffId","employmentId","kind","title","effectiveFrom")
          VALUES (${randomUUID()}, ${tenantId}, ${staffId}, ${row.id}, 'PRIMARY', 'Racer', '2025-07-01')`,
      ),
    ).rejects.toThrow(/StaffResponsibility_one_primary_per_range/);

    await scoped(() =>
      service.endEmployment(
        staffId,
        row.id,
        { effectiveTo: '2026-03-01', reason: 'Resigned' },
        hrB,
      ),
    );
    const rows = await scoped(() =>
      prisma.staffResponsibility.findMany({
        where: { tenantId, staffId },
        orderBy: { effectiveFrom: 'asc' },
      }),
    );
    expect(rows).toHaveLength(3);
    for (const item of rows) expect(item.endedAt).not.toBeNull();
    const shortened = rows.find((item) => item.id === primary.id);
    if (!shortened) throw new Error('primary responsibility missing');
    expect(shortened.effectiveTo?.toISOString()).toBe(
      '2026-03-01T00:00:00.000Z',
    );
    const voided = rows.find((item) => item.id === future.id);
    if (!voided) throw new Error('future responsibility missing');
    expect(voided.effectiveTo?.toISOString()).toBe(
      voided.effectiveFrom.toISOString(),
    );
    expect(voided.endReason).toMatch(/Voided/);
    // Responsibilities are not editable afterwards.
    await expect(
      scoped(() =>
        service.endResponsibility(
          staffId,
          primary.id,
          { effectiveTo: '2026-02-01', reason: 'Late edit' },
          hrA,
        ),
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'RESPONSIBILITY_ALREADY_ENDED',
      }),
    });
  });

  it('refuses responsibilities on unverified employment and for other tenants (7.1)', async () => {
    const pending = await employment(hrA, '2025-01-01');
    await expect(
      respons(pending.id, 'SECONDARY', '2025-02-01'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'EMPLOYMENT_NOT_VERIFIED' }),
    });
    await verify(pending.id);
    await expect(
      scoped(
        () =>
          service.addResponsibility(
            staffId,
            {
              employmentId: pending.id,
              kind: 'SECONDARY',
              title: 'Intruder',
              effectiveFrom: '2025-02-01',
            } as never,
            actor(randomUUID(), otherTenantId),
          ),
        otherTenantId,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
