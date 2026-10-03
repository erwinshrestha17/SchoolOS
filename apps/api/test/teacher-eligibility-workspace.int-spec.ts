import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { AuditService } from '../src/audit/audit.service';
import type { AuthContext } from '../src/auth/auth.types';
import { ProfessionalIdentityService } from '../src/hr/professional-identity.service';
import { TeacherEligibilityWorkspaceService } from '../src/hr/teacher-eligibility-workspace.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { StaffService } from '../src/staff/staff.service';
import {
  eligibilityResourceKey,
  TeacherProfessionalEligibilityService,
} from '../src/teacher-scope/teacher-professional-eligibility.service';
import {
  authTestDatabaseUrl,
  IsolatedAuthCls,
} from './helpers/auth-test-isolation';
import {
  approveSchoolEligibilityPolicy,
  resolveLocalLevelId,
  retireEligibilityTenant,
  SYNTHETIC_SCHOOL_TYPE,
} from './helpers/teacher-eligibility-fixture';

/**
 * Phase 7.10 (7L) against real PostgreSQL: the HR teacher-eligibility
 * workspace, the ended-employment window (service and database function),
 * termination ending employment, evidence-reference redaction, live
 * authorization on professional decisions and concurrent verification.
 *
 * Employment, evidence and policy rows are append-only history, so each test
 * builds its own tenant and teardown retires the tenant instead of deleting.
 */
const DAY = 86_400_000;
const FROM = new Date('2024-01-01T00:00:00.000Z');
const days = (count: number) => new Date(Date.now() + count * DAY);

function must<T>(value: T | null | undefined): T {
  if (value === null || value === undefined)
    throw new Error('Expected fixture value is missing');
  return value;
}

const describeDatabase = authTestDatabaseUrl ? describe : describe.skip;
describeDatabase(
  'Phase 7.10 teacher eligibility workspace (PostgreSQL)',
  () => {
    const cls = new IsolatedAuthCls() as unknown as ClsService;
    const previousUrl = process.env.DATABASE_URL;
    let prisma: PrismaService;
    let eligibility: TeacherProfessionalEligibilityService;
    let workspace: TeacherEligibilityWorkspaceService;
    let identity: ProfessionalIdentityService;
    let staffService: StaffService;
    const tenants: string[] = [];

    interface World {
      tenantId: string;
      suffix: string;
      localLevelId: number;
      policyId: string;
      classId: string;
      sectionId: string;
      subjectId: string;
      academicYearId: string;
      hr: AuthContext;
      hrB: AuthContext;
      hrC: AuthContext;
      reader: AuthContext;
      readerWithDocuments: AuthContext;
    }

    interface Teacher {
      staffId: string;
      userId: string;
      employmentId: string;
      profileId: string;
      licenceId: string | null;
      qualificationId: string;
      assignmentId: string | null;
      assessmentId: string | null;
    }

    const scope = <T>(world: World, work: () => Promise<T>) =>
      prisma.runWithTenantScope(world.tenantId, work);

    async function permissionIds(keys: string[]) {
      const rows = await Promise.all(
        keys.map((key) => {
          const split = key.lastIndexOf(':');
          const resource = key.slice(0, split);
          const action = key.slice(split + 1);
          return prisma.permission.upsert({
            where: { resource_action: { resource, action } },
            create: { resource, action },
            update: {},
          });
        }),
      );
      return rows.map((row) => row.id);
    }

    async function makeWorld(
      options: { policy?: boolean } = {},
    ): Promise<World> {
      return prisma.runWithoutTenantScope('Phase 7.10 fixtures', async () => {
        const suffix = randomUUID().slice(0, 8);
        const tenant = await prisma.tenant.create({
          data: { name: 'Phase 7.10 test', slug: `p710-${suffix}` },
        });
        tenants.push(tenant.id);
        const tenantId = tenant.id;
        const localLevelId = await resolveLocalLevelId(prisma, suffix);
        const policyId =
          options.policy === false
            ? ''
            : await approveSchoolEligibilityPolicy(prisma, {
                tenantId,
                localLevelId,
                suffix,
              });

        const actor = async (
          label: string,
          permissions: string[],
        ): Promise<AuthContext> => {
          const role = await prisma.role.create({
            data: {
              tenantId,
              name: `p710-${label}-${randomUUID().slice(0, 6)}`,
              rolePermissions: {
                create: (await permissionIds(permissions)).map(
                  (permissionId) => ({ permissionId }),
                ),
              },
            },
          });
          const user = await prisma.user.create({
            data: {
              tenantId,
              email: `${label}-${randomUUID()}@example.test`,
              status: 'ACTIVE',
            },
          });
          await prisma.userRole.create({
            data: { tenantId, userId: user.id, roleId: role.id },
          });
          const familyId = randomUUID();
          await prisma.refreshToken.create({
            data: {
              userId: user.id,
              familyId,
              tokenHash: randomUUID(),
              expiresAt: new Date(Date.now() + 600_000),
            },
          });
          return {
            userId: user.id,
            tenantId,
            tenantSlug: tenant.slug,
            email: user.email,
            sessionFamilyId: familyId,
            authMethod: 'PASSWORD',
            roles: [role.name],
            permissions,
          } as AuthContext;
        };

        const hrPermissions = ['hr:read', 'hr:manage'];
        const academicYear = await prisma.academicYear.create({
          data: {
            tenantId,
            name: 'Synthetic 2026',
            startsOn: new Date('2026-01-01'),
            endsOn: new Date('2026-12-31'),
          },
        });
        const classroom = await prisma.class.create({
          data: { tenantId, name: 'Grade 9', level: 9 },
        });
        const section = await prisma.section.create({
          data: { tenantId, classId: classroom.id, name: 'A' },
        });
        const subject = await prisma.subject.create({
          data: {
            tenantId,
            classId: classroom.id,
            name: 'Science',
            code: `SCI-${suffix}`,
            type: 'CORE',
          } as never,
        });
        return {
          tenantId,
          suffix,
          localLevelId,
          policyId,
          classId: classroom.id,
          sectionId: section.id,
          subjectId: subject.id,
          academicYearId: academicYear.id,
          hr: await actor('hr', hrPermissions),
          hrB: await actor('hrb', hrPermissions),
          hrC: await actor('hrc', hrPermissions),
          reader: await actor('reader', ['hr:read']),
          readerWithDocuments: await actor('reader-docs', [
            'hr:read',
            'hr:documents:read',
          ]),
        };
      });
    }

    /**
     * One teacher with real, reviewed professional facts. Everything goes
     * through the same database guards production uses: employment and evidence
     * start PENDING and are verified by someone other than the submitter.
     */
    async function teacher(
      world: World,
      label: string,
      options: {
        licence?: 'VERIFIED' | 'PENDING' | 'NONE';
        licenceValidUntil?: Date;
        assign?: boolean;
        employmentFrom?: Date;
      } = {},
    ): Promise<Teacher> {
      const { tenantId } = world;
      const licenceMode = options.licence ?? 'VERIFIED';
      return prisma.runWithoutTenantScope('Phase 7.10 teacher', async () => {
        const user = await prisma.user.create({
          data: {
            tenantId,
            email: `${label}-${randomUUID()}@example.test`,
            status: 'ACTIVE',
          },
        });
        const staff = await prisma.staff.create({
          data: {
            tenantId,
            userId: user.id,
            employeeId: `P710-${randomUUID().slice(0, 8)}`,
            firstName: label,
            lastName: 'Teacher',
            dateOfBirth: new Date('1990-01-01'),
            gender: 'OTHER',
            address: 'Synthetic address',
            joiningDate: FROM,
            contractType: 'PERMANENT',
          } as never,
        });
        const employment = await prisma.staffEmployment.create({
          data: {
            tenantId,
            staffId: staff.id,
            employmentType: 'PERMANENT',
            postCategoryCode: 'TEACHER',
            schoolTypeCode: SYNTHETIC_SCHOOL_TYPE,
            localLevelId: world.localLevelId,
            effectiveFrom: options.employmentFrom ?? FROM,
            submittedById: world.hr.userId,
          },
        });
        await prisma.staffEmployment.update({
          where: { id: employment.id },
          data: {
            status: 'VERIFIED',
            verifiedById: world.hrB.userId,
            verifiedAt: new Date(),
          },
        });
        const profile = await prisma.teacherProfile.create({
          data: { tenantId, staffId: staff.id, effectiveFrom: FROM },
        });
        const qualification = await prisma.teacherQualificationEvidence.create({
          data: {
            tenantId,
            profileId: profile.id,
            qualification: 'Synthetic B.Ed.',
            validFrom: FROM,
            sourceUri: 'https://example.test/synthetic-qualification',
          },
        });
        await prisma.teacherQualificationEvidence.update({
          where: { id: qualification.id },
          data: {
            status: 'VERIFIED',
            verifiedById: world.hrB.userId,
            verifiedAt: new Date(),
          },
        });
        let licenceId: string | null = null;
        if (licenceMode !== 'NONE') {
          const licence = await prisma.teachingLicenceEvidence.create({
            data: {
              tenantId,
              profileId: profile.id,
              authorityCode: 'SYNTHETIC',
              externalReference: `TEST-ONLY-${randomUUID().slice(0, 8)}`,
              validFrom: FROM,
              validUntil: options.licenceValidUntil ?? null,
              sourceUri: 'https://example.test/synthetic-licence',
            },
          });
          licenceId = licence.id;
          if (licenceMode === 'VERIFIED') {
            await prisma.teachingLicenceEvidence.update({
              where: { id: licence.id },
              data: {
                status: 'VERIFIED',
                verifiedById: world.hrB.userId,
                verifiedAt: new Date(),
              },
            });
          }
        }
        let assessmentId: string | null = null;
        let assignmentId: string | null = null;
        if (options.assign !== false && licenceMode === 'VERIFIED') {
          assessmentId = await eligibility.preflightAssignment({
            tenantId,
            staffId: staff.id,
            classId: world.classId,
            subjectId: world.subjectId,
            actorId: world.hrB.userId,
          });
          const assignment = await prisma.teacherAssignment.create({
            data: {
              eligibilityAssessmentId: assessmentId,
              tenantId,
              academicYearId: world.academicYearId,
              staffId: staff.id,
              assignmentType: 'SUBJECT_TEACHER',
              classId: world.classId,
              sectionId: world.sectionId,
              subjectId: world.subjectId,
              status: 'ACTIVE',
              effectiveFrom: new Date(Date.now() - 30 * DAY),
            },
          });
          assignmentId = assignment.id;
        }
        return {
          staffId: staff.id,
          userId: user.id,
          employmentId: employment.id,
          profileId: profile.id,
          licenceId,
          qualificationId: qualification.id,
          assignmentId,
          assessmentId,
        };
      });
    }

    const listWorkspace = (
      world: World,
      query: Record<string, unknown> = {},
      actor: AuthContext = world.reader,
    ) =>
      scope(world, () =>
        workspace.getWorkspace(
          { page: 1, limit: 100, ...query } as never,
          actor,
        ),
      );

    const summaryOf = (
      world: World,
      staffId: string,
      actor: AuthContext = world.reader,
      horizonDays?: number,
    ) => scope(world, () => workspace.getSummary(staffId, horizonDays, actor));

    const itemFor = async (
      world: World,
      staffId: string,
      query: Record<string, unknown> = {},
    ) => {
      const result = await listWorkspace(world, query);
      return result.items.find((item) => item.staffId === staffId);
    };

    const revokeLicence = (world: World, member: Teacher) =>
      scope(world, () =>
        identity.revokeEvidence(
          'licence',
          member.staffId,
          must(member.licenceId),
          { reason: 'Licence withdrawn by authority' } as never,
          world.hrB,
        ),
      );

    beforeAll(() => {
      process.env.DATABASE_URL = authTestDatabaseUrl;
      prisma = new PrismaService(cls);
      const audit = new AuditService(prisma, cls);
      eligibility = new TeacherProfessionalEligibilityService(prisma);
      identity = new ProfessionalIdentityService(prisma, audit, eligibility);
      workspace = new TeacherEligibilityWorkspaceService(prisma, eligibility);
      staffService = new StaffService(
        prisma,
        {} as never,
        audit,
        { recordEvent: jest.fn() } as never,
        {} as never,
        {} as never,
        identity,
      );
    });

    afterEach(async () => {
      for (const tenantId of tenants.splice(0))
        await retireEligibilityTenant(prisma, tenantId);
    });

    afterAll(async () => {
      await prisma?.$disconnect();
      if (previousUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousUrl;
    });

    describe('workspace classification', () => {
      it('classifies eligible, needs-review, ineligible and baseline-only teachers and totals them', async () => {
        const world = await makeWorld();
        const eligible = await teacher(world, 'Eligible');
        const pending = await teacher(world, 'Pending');
        const revoked = await teacher(world, 'Revoked');
        const noProfile = await teacher(world, 'NoProfile');
        const idle = await teacher(world, 'Idle', { assign: false });

        // Pending: licence revoked, then a replacement submitted but unreviewed.
        await revokeLicence(world, pending);
        await scope(world, () =>
          identity.addLicence(
            pending.staffId,
            {
              authorityCode: 'SYNTHETIC',
              externalReference: 'REPLACEMENT-1',
              validFrom: '2024-01-01',
              sourceUri: 'https://example.test/replacement',
            } as never,
            world.hr,
          ),
        );
        await revokeLicence(world, revoked);
        await scope(world, () =>
          identity.deactivateTeacherProfile(
            noProfile.staffId,
            {
              reason: 'Left teaching track',
              effectiveTo: '2025-01-01',
            } as never,
            world.hrB,
          ),
        );

        const result = await listWorkspace(world);
        const byId = new Map(result.items.map((item) => [item.staffId, item]));

        expect(byId.get(eligible.staffId)).toMatchObject({
          state: 'ELIGIBLE',
          atRisk: false,
          primaryReasonCode: 'POLICY_REQUIREMENTS_SATISFIED',
          assignments: { current: 1, passing: 1, failing: 0 },
          evidence: { qualification: 'MATCHED', licence: 'MATCHED' },
          policy: { id: world.policyId, scope: 'SCHOOL' },
        });
        expect(byId.get(pending.staffId)).toMatchObject({
          state: 'NEEDS_REVIEW',
          primaryReasonCode: 'TEACHING_LICENCE_UNVERIFIED',
          evidence: { licence: 'PENDING_REVIEW' },
        });
        expect(byId.get(revoked.staffId)).toMatchObject({
          state: 'INELIGIBLE',
          primaryReasonCode: 'TEACHING_LICENCE_UNVERIFIED',
          evidence: { licence: 'REVOKED' },
        });
        expect(byId.get(noProfile.staffId)).toMatchObject({
          state: 'INELIGIBLE',
          primaryReasonCode: 'TEACHER_PROFILE_MISSING',
        });
        expect(byId.get(idle.staffId)).toMatchObject({
          state: 'ELIGIBLE',
          primaryReasonCode: 'NO_CURRENT_ASSIGNMENTS',
          assignments: { current: 0 },
          policy: null,
        });
        expect(result.totals).toEqual({
          total: 5,
          eligible: 2,
          needsReview: 1,
          ineligible: 2,
          atRisk: 0,
        });
        // Worst first: ineligible, then needs review, then eligible.
        expect(result.items.map((item) => item.state)).toEqual([
          'INELIGIBLE',
          'INELIGIBLE',
          'NEEDS_REVIEW',
          'ELIGIBLE',
          'ELIGIBLE',
        ]);
        expect(result.truncated).toBe(false);
      });

      it('filters by state, search and at-risk while totals describe the whole school', async () => {
        const world = await makeWorld();
        const expiring = await teacher(world, 'Expiring', {
          licenceValidUntil: days(10),
        });
        const steady = await teacher(world, 'Steady');
        const revoked = await teacher(world, 'Lapsed');
        await revokeLicence(world, revoked);

        const atRisk = await listWorkspace(world, { atRiskOnly: true });
        expect(atRisk.items.map((item) => item.staffId)).toEqual([
          expiring.staffId,
        ]);
        expect(atRisk.totals).toMatchObject({ total: 3, atRisk: 1 });

        const ineligible = await listWorkspace(world, { status: 'INELIGIBLE' });
        expect(ineligible.items.map((item) => item.staffId)).toEqual([
          revoked.staffId,
        ]);
        expect(ineligible.totals.total).toBe(3);

        const searched = await listWorkspace(world, { search: 'steady' });
        expect(searched.items.map((item) => item.staffId)).toEqual([
          steady.staffId,
        ]);

        const paged = await listWorkspace(world, { limit: 2, page: 2 });
        expect(paged).toMatchObject({ totalItems: 3, page: 2, limit: 2 });
        expect(paged.items).toHaveLength(1);
      });

      it('lists an assigned teacher whose staff record is no longer active', async () => {
        const world = await makeWorld();
        const member = await teacher(world, 'Departed');
        await prisma.runWithoutTenantScope('Phase 7.10 fixtures', () =>
          prisma.staff.update({
            where: { id: member.staffId },
            data: { status: 'INACTIVE' },
          }),
        );
        expect(await itemFor(world, member.staffId)).toMatchObject({
          state: 'INELIGIBLE',
          primaryReasonCode: 'EMPLOYMENT_INACTIVE',
        });
      });
    });

    describe('blocking changes', () => {
      it('flags a licence expiring inside the horizon and not one outside it', async () => {
        const world = await makeWorld();
        const member = await teacher(world, 'Soon', {
          licenceValidUntil: days(10),
        });
        expect(await itemFor(world, member.staffId)).toMatchObject({
          state: 'ELIGIBLE',
          atRisk: true,
          blockingChangeCount: 1,
          nextBlockingChange: {
            kind: 'EVIDENCE_EXPIRING',
            evidenceKind: 'LICENCE',
            affectedAssignments: 1,
          },
        });
        expect(
          await itemFor(world, member.staffId, { horizonDays: 5 }),
        ).toMatchObject({ atRisk: false, blockingChangeCount: 0 });
        expect(
          await itemFor(world, member.staffId, { horizonDays: 999 }),
        ).toMatchObject({ atRisk: true });
      });

      it('reports an approved future policy revision on its effective date', async () => {
        const world = await makeWorld();
        const member = await teacher(world, 'Revision');
        const effectiveFrom = days(12);
        await prisma.runWithoutTenantScope('Phase 7.10 fixtures', () =>
          approveSchoolEligibilityPolicy(prisma, {
            tenantId: world.tenantId,
            localLevelId: world.localLevelId,
            suffix: world.suffix,
            version: 2,
            supersedesId: world.policyId,
            effectiveFrom,
          }),
        );
        const summary = await summaryOf(world, member.staffId);
        expect(summary.state).toBe('ELIGIBLE');
        expect(summary.atRisk).toBe(true);
        expect(summary.blockingChanges).toMatchObject([
          { kind: 'POLICY_REVISION_SCHEDULED', affectedAssignments: 1 },
        ]);
        expect(
          Math.abs(
            new Date(summary.blockingChanges[0].at).getTime() -
              effectiveFrom.getTime(),
          ),
        ).toBeLessThan(1000);
      });
    });

    describe('ended employment window (7.1 carry-over)', () => {
      it('stays eligible until the recorded end date, in the service and the database function', async () => {
        const world = await makeWorld();
        const member = await teacher(world, 'Ending');
        await scope(world, () =>
          identity.endEmployment(
            member.staffId,
            member.employmentId,
            {
              effectiveTo: days(10).toISOString(),
              reason: 'Resigned',
            } as never,
            world.hrB,
          ),
        );
        const status = await prisma.runWithoutTenantScope('read', () =>
          prisma.staffEmployment.findUniqueOrThrow({
            where: { id: member.employmentId },
            select: { status: true },
          }),
        );
        expect(status.status).toBe('ENDED');

        // Service decision today: still eligible, flagged as ending.
        const item = await itemFor(world, member.staffId);
        expect(item).toMatchObject({
          state: 'ELIGIBLE',
          atRisk: true,
          nextBlockingChange: { kind: 'EMPLOYMENT_ENDING' },
        });
        // A new assignment preflight also still succeeds inside the window.
        await expect(
          scope(world, () =>
            eligibility.preflightAssignment({
              tenantId: world.tenantId,
              staffId: member.staffId,
              classId: world.classId,
              subjectId: world.subjectId,
            }),
          ),
        ).resolves.toEqual(expect.any(String));

        // Database authority agrees: live today, not after the end date.
        const live = (at: Date) =>
          scope(world, () =>
            eligibility.isLive({
              tenantId: world.tenantId,
              staffId: member.staffId,
              assessmentId: member.assessmentId,
              classId: world.classId,
              subjectId: world.subjectId,
              at,
            }),
          );
        expect(await live(new Date())).toBe(true);
        expect(await live(days(9))).toBe(true);
        expect(await live(days(11))).toBe(false);
      });

      it('an ended employment whose end date has passed grants nothing', async () => {
        const world = await makeWorld();
        const member = await teacher(world, 'Gone');
        await scope(world, () =>
          identity.endEmployment(
            member.staffId,
            member.employmentId,
            {
              effectiveTo: days(-1).toISOString(),
              reason: 'Resigned',
            } as never,
            world.hrB,
          ),
        );
        expect(await itemFor(world, member.staffId)).toMatchObject({
          state: 'INELIGIBLE',
          primaryReasonCode: 'EMPLOYMENT_UNVERIFIED',
        });
        await expect(
          scope(world, () =>
            eligibility.isLive({
              tenantId: world.tenantId,
              staffId: member.staffId,
              assessmentId: member.assessmentId,
              classId: world.classId,
              subjectId: world.subjectId,
              at: new Date(),
            }),
          ),
        ).resolves.toBe(false);
      });

      it('pending employment is never authoritative', async () => {
        const world = await makeWorld();
        const member = await teacher(world, 'Pending');
        // A later PENDING period carries no authority and changes nothing.
        await scope(world, () =>
          identity.createEmployment(
            member.staffId,
            {
              employmentType: 'PERMANENT',
              postCategoryCode: 'TEACHER',
              schoolTypeCode: SYNTHETIC_SCHOOL_TYPE,
              effectiveFrom: days(100).toISOString().slice(0, 10),
            } as never,
            world.hr,
          ),
        );
        expect(await itemFor(world, member.staffId)).toMatchObject({
          state: 'ELIGIBLE',
          employment: { id: member.employmentId },
        });
      });
    });

    describe('termination ends employment (7.1 carry-over)', () => {
      it('ends the open employment in the same transaction and the workspace shows ineligible', async () => {
        const world = await makeWorld();
        const member = await teacher(world, 'Terminated');
        await scope(world, () =>
          staffService.terminateStaff(
            member.staffId,
            { reason: 'Contract concluded' },
            world.hr,
          ),
        );
        const employment = await prisma.runWithoutTenantScope('read', () =>
          prisma.staffEmployment.findUniqueOrThrow({
            where: { id: member.employmentId },
            select: {
              status: true,
              effectiveTo: true,
              endedAt: true,
              endReason: true,
            },
          }),
        );
        expect(employment.status).toBe('ENDED');
        expect(employment.effectiveTo).not.toBeNull();
        expect(employment.endedAt).not.toBeNull();
        expect(employment.endReason).toContain('Staff terminated');
        expect(await itemFor(world, member.staffId)).toMatchObject({
          state: 'INELIGIBLE',
          primaryReasonCode: 'EMPLOYMENT_INACTIVE',
        });
      });

      it('refuses a termination date before the employment starts and changes nothing', async () => {
        const world = await makeWorld();
        const member = await teacher(world, 'Early', {
          employmentFrom: new Date('2025-01-01T00:00:00.000Z'),
        });
        const attempt = scope(world, () =>
          staffService.terminateStaff(
            member.staffId,
            { reason: 'Mistaken date', effectiveDate: '2024-06-01' },
            world.hr,
          ),
        );
        await expect(attempt).rejects.toBeInstanceOf(ConflictException);
        await expect(attempt).rejects.toMatchObject({
          response: expect.objectContaining({
            code: 'TERMINATION_BEFORE_EMPLOYMENT_START',
          }),
        });
        const after = await prisma.runWithoutTenantScope('read', async () => ({
          staff: await prisma.staff.findUniqueOrThrow({
            where: { id: member.staffId },
            select: { status: true },
          }),
          employment: await prisma.staffEmployment.findUniqueOrThrow({
            where: { id: member.employmentId },
            select: { status: true, effectiveTo: true },
          }),
        }));
        expect(after.staff.status).toBe('ACTIVE');
        expect(after.employment).toMatchObject({
          status: 'VERIFIED',
          effectiveTo: null,
        });
      });

      it('a person cannot terminate themselves out of their own employment record', async () => {
        const world = await makeWorld();
        const member = await teacher(world, 'Self');
        const selfActor = {
          ...world.hr,
          userId: member.userId,
        } as AuthContext;
        await expect(
          scope(world, () =>
            staffService.terminateStaff(
              member.staffId,
              { reason: 'Self termination' },
              selfActor,
            ),
          ),
        ).rejects.toBeInstanceOf(ForbiddenException);
      });
    });

    describe('summary and redaction', () => {
      it('explains the policy, requirements, evidence and assignments', async () => {
        const world = await makeWorld();
        const member = await teacher(world, 'Detailed');
        const summary = await summaryOf(world, member.staffId);
        expect(summary).toMatchObject({
          staffId: member.staffId,
          state: 'ELIGIBLE',
          roleIsNotEvidence: true,
          employment: { id: member.employmentId },
          profile: { id: member.profileId, status: 'ACTIVE' },
        });
        expect(summary.assignments).toHaveLength(1);
        expect(summary.assignments[0]).toMatchObject({
          assignmentId: member.assignmentId,
          className: 'Grade 9',
          subjectName: 'Science',
          state: 'ELIGIBLE',
          createdUnder: { id: member.assessmentId, outcome: 'ELIGIBLE' },
          requirements: {
            policy: { id: world.policyId, scope: 'SCHOOL' },
            qualification: { required: true, status: 'MATCHED' },
            licence: { required: true, status: 'MATCHED' },
          },
        });
        expect(summary.evidence.map((item) => item.kind).sort()).toEqual([
          'LICENCE',
          'QUALIFICATION',
        ]);
        expect(summary.recentAssessments[0]).toMatchObject({
          id: member.assessmentId,
          outcome: 'ELIGIBLE',
        });
      });

      it('hides evidence references without hr:documents:read, here and in the professional overview', async () => {
        const world = await makeWorld();
        const member = await teacher(world, 'Private');

        const redacted = await summaryOf(world, member.staffId, world.reader);
        expect(redacted.evidence.length).toBe(2);
        for (const item of redacted.evidence) {
          expect(item).toMatchObject({
            documentId: null,
            sourceUri: null,
            externalReference: null,
            referencesRedacted: true,
          });
        }
        expect(redacted.evidence.map((item) => item.label).sort()).toEqual([
          'Qualification',
          'Teaching licence',
        ]);

        const full = await summaryOf(
          world,
          member.staffId,
          world.readerWithDocuments,
        );
        const licence = full.evidence.find((item) => item.kind === 'LICENCE');
        expect(licence).toMatchObject({
          referencesRedacted: false,
          sourceUri: 'https://example.test/synthetic-licence',
        });
        expect(licence?.externalReference).toMatch(/^TEST-ONLY-/);

        const overviewRedacted = await scope(world, () =>
          identity.getOverview(member.staffId, world.reader),
        );
        expect(overviewRedacted.teacherProfile).toMatchObject({
          referencesRedacted: true,
        });
        for (const row of [
          ...(overviewRedacted.teacherProfile?.licences ?? []),
          ...(overviewRedacted.teacherProfile?.qualifications ?? []),
        ]) {
          expect(row).toMatchObject({ documentId: null, sourceUri: null });
          // Status and dates stay visible to `hr:read`.
          expect(row.status).toBe('VERIFIED');
        }
        expect(
          (
            overviewRedacted.teacherProfile?.licences[0] as {
              externalReference: string | null;
            }
          ).externalReference,
        ).toBeNull();

        const overviewFull = await scope(world, () =>
          identity.getOverview(member.staffId, world.readerWithDocuments),
        );
        expect(overviewFull.teacherProfile?.referencesRedacted).toBe(false);
        expect(overviewFull.teacherProfile?.licences[0]).toMatchObject({
          sourceUri: 'https://example.test/synthetic-licence',
        });
      });

      it('requires hr:read', async () => {
        const world = await makeWorld();
        const nobody = { ...world.reader, permissions: [] } as AuthContext;
        await expect(listWorkspace(world, {}, nobody)).rejects.toBeInstanceOf(
          ForbiddenException,
        );
      });
    });

    describe('tenant isolation', () => {
      it("never lists or reveals another school's teachers", async () => {
        const mine = await makeWorld();
        const theirs = await makeWorld();
        const foreign = await teacher(theirs, 'Foreign');
        const own = await teacher(mine, 'Own');

        const result = await listWorkspace(mine);
        expect(result.items.map((item) => item.staffId)).toEqual([own.staffId]);
        await expect(
          summaryOf(mine, foreign.staffId, mine.reader),
        ).rejects.toBeInstanceOf(NotFoundException);
      });
    });

    describe('batch evaluation agrees with the single decision on real data', () => {
      it('matches projectEligibility for every teacher and resolves a missing policy as unavailable', async () => {
        const world = await makeWorld();
        const members = [
          await teacher(world, 'A'),
          await teacher(world, 'B', { licence: 'NONE' }),
          await teacher(world, 'C', { licence: 'PENDING' }),
        ];
        const resources = members.map((member) => ({
          staffId: member.staffId,
          classId: world.classId,
          subjectId: world.subjectId,
        }));
        const batch = await scope(world, () =>
          eligibility.evaluateMany({ tenantId: world.tenantId, resources }),
        );
        for (const resource of resources) {
          const single = await scope(world, () =>
            eligibility.projectEligibility({
              tenantId: world.tenantId,
              ...resource,
            }),
          );
          const decision = batch.get(eligibilityResourceKey(resource));
          expect(decision).toMatchObject({
            outcome: single.outcome,
            reasonCode: single.reasonCode,
            policyVersionId: single.policyVersionId,
            qualificationId: single.qualificationId,
            licenceId: single.licenceId,
          });
        }
        expect(
          [...batch.values()].map((decision) => decision.reasonCode),
        ).toEqual([
          'POLICY_REQUIREMENTS_SATISFIED',
          'TEACHING_LICENCE_UNVERIFIED',
          'TEACHING_LICENCE_UNVERIFIED',
        ]);

        // A school with no approved policy cannot resolve eligibility.
        const bare = await makeWorld({ policy: false });
        const noPolicy = await teacher(bare, 'NoPolicy', { assign: false });
        const unavailable = await scope(bare, () =>
          eligibility.evaluateMany({
            tenantId: bare.tenantId,
            resources: [
              {
                staffId: noPolicy.staffId,
                classId: bare.classId,
                subjectId: null,
              },
            ],
          }),
        );
        expect([...unavailable.values()][0]).toMatchObject({
          outcome: 'INELIGIBLE',
          reasonCode: 'TEACHER_POLICY_UNAVAILABLE',
          structural: true,
        });
      });

      it('the exceptions report lists exactly the failing active assignments', async () => {
        const world = await makeWorld();
        await teacher(world, 'Fine');
        const lapsed = await teacher(world, 'Lapsed');
        await revokeLicence(world, lapsed);
        const report = await scope(world, () =>
          identity.listEligibilityExceptions(world.reader),
        );
        expect(report.truncated).toBe(false);
        expect(report.items.map((item) => item.staff.id)).toEqual([
          lapsed.staffId,
        ]);
        expect(report.items[0].currentReasonCode).toBe(
          'TEACHING_LICENCE_UNVERIFIED',
        );
      });
    });

    describe('decisions re-check live authorization', () => {
      async function pendingLicence(world: World, member: Teacher) {
        return scope(world, () =>
          identity.addLicence(
            member.staffId,
            {
              authorityCode: 'SYNTHETIC',
              externalReference: `PENDING-${randomUUID().slice(0, 6)}`,
              validFrom: '2024-01-01',
              sourceUri: 'https://example.test/pending',
            } as never,
            world.hr,
          ),
        );
      }
      const statusOf = (id: string) =>
        prisma.runWithoutTenantScope(
          'read',
          async () =>
            (
              await prisma.teachingLicenceEvidence.findUniqueOrThrow({
                where: { id },
                select: { status: true },
              })
            ).status,
        );

      it('a revoked session cannot verify evidence and nothing is written', async () => {
        const world = await makeWorld();
        const member = await teacher(world, 'Session', { assign: false });
        const evidence = await pendingLicence(world, member);
        await prisma.runWithoutTenantScope('Phase 7.10 fixtures', () =>
          prisma.refreshToken.updateMany({
            where: { familyId: world.hrB.sessionFamilyId },
            data: { revokedAt: new Date() },
          }),
        );
        await expect(
          scope(world, () =>
            identity.reviewEvidence(
              'licence',
              member.staffId,
              evidence.id,
              { decision: 'VERIFY' } as never,
              world.hrB,
            ),
          ),
        ).rejects.toBeInstanceOf(UnauthorizedException);
        expect(await statusOf(evidence.id)).toBe('PENDING');
      });

      it('a revoked hr:manage grant cannot verify, end or revoke', async () => {
        const world = await makeWorld();
        const member = await teacher(world, 'Grant');
        const evidence = await pendingLicence(world, member);
        await prisma.runWithoutTenantScope('Phase 7.10 fixtures', () =>
          prisma.userRole.updateMany({
            where: { userId: world.hrB.userId },
            data: { revokedAt: new Date() },
          }),
        );
        await expect(
          scope(world, () =>
            identity.reviewEvidence(
              'licence',
              member.staffId,
              evidence.id,
              { decision: 'VERIFY' } as never,
              world.hrB,
            ),
          ),
        ).rejects.toBeInstanceOf(ForbiddenException);
        await expect(
          scope(world, () =>
            identity.endEmployment(
              member.staffId,
              member.employmentId,
              { effectiveTo: days(5).toISOString(), reason: 'x' } as never,
              world.hrB,
            ),
          ),
        ).rejects.toBeInstanceOf(ForbiddenException);
        await expect(revokeLicence(world, member)).rejects.toBeInstanceOf(
          ForbiddenException,
        );
        expect(await statusOf(evidence.id)).toBe('PENDING');
        expect(await statusOf(must(member.licenceId))).toBe('VERIFIED');
      });

      it('concurrent verification of the same evidence: exactly one wins', async () => {
        const world = await makeWorld();
        const member = await teacher(world, 'Race', { assign: false });
        const evidence = await pendingLicence(world, member);
        const verify = (reviewer: AuthContext) =>
          scope(world, () =>
            identity.reviewEvidence(
              'licence',
              member.staffId,
              evidence.id,
              { decision: 'VERIFY' } as never,
              reviewer,
            ),
          );
        const results = await Promise.allSettled([
          verify(world.hrB),
          verify(world.hrC),
        ]);
        const fulfilled = results.filter((item) => item.status === 'fulfilled');
        const rejected = results.filter(
          (item): item is PromiseRejectedResult => item.status === 'rejected',
        );
        expect(fulfilled).toHaveLength(1);
        expect(rejected).toHaveLength(1);
        expect(rejected[0].reason).toBeInstanceOf(ConflictException);
        expect(rejected[0].reason.getResponse()).toMatchObject({
          code: 'EVIDENCE_NOT_PENDING',
        });
        expect(await statusOf(evidence.id)).toBe('VERIFIED');
      });
    });
  },
);
