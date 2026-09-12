import 'dotenv/config';
import { ForbiddenException } from '@nestjs/common';
import {
  GuardianCapability,
  type HomeworkAssignmentStatus,
  type HomeworkSubmissionStatus,
} from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import type { AuthContext } from '../src/auth/auth.types';
import { MobileService } from '../src/mobile/mobile.service';
import { ParentScopeContextService } from '../src/mobile/parent-scope-context.service';
import { PrismaService, TENANT_ID_KEY } from '../src/prisma/prisma.service';
import { createPassThroughRequestCache } from './helpers/request-cache';

class FixtureCls {
  private readonly store = new Map<string, unknown>();
  get(key: string) {
    return this.store.get(key);
  }
  set(key: string, value: unknown) {
    this.store.set(key, value);
  }
  isActive() {
    return true;
  }
  async run<T>(fn: () => Promise<T>) {
    return fn();
  }
}

describe('Parent homework dashboard summary (real database)', () => {
  const suffix = `homework-summary-${Date.now()}`;
  const cls = new FixtureCls();
  const tenantIds: string[] = [];
  let prisma: PrismaService;
  let service: MobileService;
  let actor: AuthContext;
  let studentId: string;
  let guardianLinkId: string;
  let foreignStudentId: string;

  async function createSchool(label: string) {
    const tenant = await prisma.tenant.create({
      data: { name: `${label} ${suffix}`, slug: `${label}-${suffix}` },
    });
    tenantIds.push(tenant.id);
    const tenantId = tenant.id;
    const schoolClass = await prisma.class.create({
      data: { tenantId, name: 'Grade 4', level: 4 },
    });
    const section = await prisma.section.create({
      data: { tenantId, classId: schoolClass.id, name: 'A' },
    });
    const year = await prisma.academicYear.create({
      data: {
        tenantId,
        name: suffix,
        startsOn: new Date('2026-01-01'),
        endsOn: new Date('2027-01-01'),
      },
    });
    const subject = await prisma.subject.create({
      data: {
        tenantId,
        classId: schoolClass.id,
        name: 'Math',
        code: 'MATH',
        type: 'CORE',
      },
    });
    const student = await prisma.student.create({
      data: {
        tenantId,
        classId: schoolClass.id,
        sectionId: section.id,
        studentSystemId: suffix,
        firstNameEn: 'Child',
        lastNameEn: suffix,
        dateOfBirth: new Date('2015-01-01'),
        gender: 'FEMALE',
        admissionDate: new Date('2026-01-01'),
        enrollments: {
          create: {
            tenantId,
            academicYearId: year.id,
            classId: schoolClass.id,
            sectionId: section.id,
            admissionDate: new Date('2026-01-01'),
            mediumOfInstruction: 'English',
            status: 'ACTIVE',
            effectiveFrom: new Date('2026-01-01'),
          },
        },
      },
    });
    return { tenantId, schoolClass, section, year, subject, student };
  }

  beforeAll(async () => {
    prisma = new PrismaService(cls as unknown as ClsService);
    await prisma.runWithoutTenantScope(
      'Create isolated homework summary integration fixtures in two tenants',
      async () => {
        const school = await createSchool('home');
        const foreign = await createSchool('foreign');
        studentId = school.student.id;
        foreignStudentId = foreign.student.id;
        const user = await prisma.user.create({
          data: {
            tenantId: school.tenantId,
            email: `${suffix}@example.test`,
            passwordHash: 'integration-fixture',
          },
        });
        const guardian = await prisma.guardian.create({
          data: {
            tenantId: school.tenantId,
            userId: user.id,
            fullName: suffix,
            relation: 'MOTHER',
            primaryPhone: '9800000001',
          },
        });
        const link = await prisma.studentGuardian.create({
          data: {
            tenantId: school.tenantId,
            studentId,
            guardianId: guardian.id,
            relation: 'MOTHER',
            status: 'ACTIVE',
            verificationStatus: 'VERIFIED',
            approvalStatus: 'APPROVED',
            effectiveFrom: new Date('2026-01-01'),
            capabilities: [GuardianCapability.ACADEMICS_VIEW],
          },
        });
        guardianLinkId = link.id;
        actor = {
          tenantId: school.tenantId,
          userId: user.id,
          roles: ['parent'],
          permissions: [],
        } as AuthContext;

        async function assignment(
          title: string,
          dueAt: string,
          options: {
            submissionStatus?: HomeworkSubmissionStatus;
            submissionRequired?: boolean;
            status?: HomeworkAssignmentStatus;
            sectionId?: string | null;
            target?: typeof school;
          } = {},
        ) {
          const target = options.target ?? school;
          const row = await prisma.homeworkAssignment.create({
            data: {
              tenantId: target.tenantId,
              academicYearId: target.year.id,
              classId: target.schoolClass.id,
              sectionId:
                options.sectionId === undefined
                  ? target.section.id
                  : options.sectionId,
              subjectId: target.subject.id,
              title,
              instructions: 'Complete this assignment.',
              dueAt: new Date(dueAt),
              dueDate: new Date(dueAt),
              status: options.status ?? 'ASSIGNED',
              submissionRequired: options.submissionRequired ?? true,
            },
          });
          if (options.submissionStatus) {
            await prisma.homeworkSubmission.create({
              data: {
                tenantId: target.tenantId,
                homeworkId: row.id,
                studentId: target.student.id,
                status: options.submissionStatus,
              },
            });
          }
        }

        // Seven pending assignments exceed the old five-row dashboard preview.
        for (let index = 0; index < 7; index += 1) {
          await assignment(`Pending ${index}`, '2026-09-15T06:00:00Z', {
            submissionStatus: index === 1 ? 'NOT_SUBMITTED' : undefined,
            sectionId: index === 2 ? null : school.section.id,
          });
        }
        await assignment('Needs correction', '2026-09-14T06:00:00Z', {
          submissionStatus: 'NEEDS_CORRECTION',
        });
        await assignment('Closed outstanding work', '2026-09-16T06:00:00Z', {
          status: 'CLOSED',
        });
        // Earlier irrelevant deadlines must not become the dashboard deadline.
        for (const status of ['SUBMITTED', 'LATE', 'REVIEWED'] as const) {
          await assignment(status, '2026-09-01T06:00:00Z', {
            submissionStatus: status,
          });
        }
        await assignment('Optional reading', '2026-09-01T06:00:00Z', {
          submissionRequired: false,
        });
        await assignment('Draft', '2026-09-01T06:00:00Z', { status: 'DRAFT' });
        await assignment('Cancelled', '2026-09-01T06:00:00Z', {
          status: 'CANCELLED',
        });
        const otherSection = await prisma.section.create({
          data: {
            tenantId: school.tenantId,
            classId: school.schoolClass.id,
            name: 'B',
          },
        });
        await assignment('Other section', '2026-09-01T06:00:00Z', {
          sectionId: otherSection.id,
        });
        await assignment('Other school', '2026-09-01T06:00:00Z', {
          target: foreign,
        });
      },
    );

    cls.set(TENANT_ID_KEY, actor.tenantId);
    service = new MobileService(
      prisma,
      {} as never,
      {} as never,
      {
        getEntitlements: async () => ({ modules: ['students', 'homework'] }),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      new ParentScopeContextService(prisma, createPassThroughRequestCache()),
    );
    // Only unrelated dashboard sections are stubbed. Child authorization and
    // homework aggregate both execute against the real scoped database.
    jest
      .spyOn(service, 'getStudentProfile')
      .mockResolvedValue({ child: null } as never);
    jest.spyOn(service, 'listNotifications').mockResolvedValue({
      unreadCount: 0,
      items: [],
      nextCursor: null,
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.runWithoutTenantScope(
      'Remove only isolated homework summary fixtures',
      async () => {
        const where = { tenantId: { in: tenantIds } };
        await prisma.homeworkSubmission.deleteMany({ where });
        await prisma.homeworkAssignment.deleteMany({ where });
        await prisma.studentGuardian.deleteMany({ where });
        await prisma.enrollment.deleteMany({ where });
        await prisma.student.deleteMany({ where });
        await prisma.guardian.deleteMany({ where });
        await prisma.subject.deleteMany({ where });
        await prisma.section.deleteMany({ where });
        await prisma.class.deleteMany({ where });
        await prisma.academicYear.deleteMany({ where });
        await prisma.user.deleteMany({ where });
        await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
      },
    );
    await prisma.$disconnect();
  });

  it('counts all required pending work and derives the earliest matching due date', async () => {
    const dashboard = await service.getDashboard(actor, studentId);
    expect(dashboard.homework).toEqual({
      pendingCount: 9,
      nextDueAt: '2026-09-14T06:00:00.000Z',
    });
  });

  it('rejects a foreign requested child instead of substituting the linked child', async () => {
    await expect(
      service.getDashboard(actor, foreignStudentId),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not expose homework after the guardian academics capability is revoked', async () => {
    await prisma.studentGuardian.update({
      where: { id: guardianLinkId },
      data: { capabilities: [] },
    });
    try {
      const dashboard = await service.getDashboard(actor, studentId);
      expect(dashboard.modules.homework).toBe(false);
      expect(dashboard.homework).toBeNull();
    } finally {
      await prisma.studentGuardian.update({
        where: { id: guardianLinkId },
        data: { capabilities: [GuardianCapability.ACADEMICS_VIEW] },
      });
    }
  });

  it('returns zero and no deadline when no visible required homework remains', async () => {
    await prisma.homeworkAssignment.updateMany({
      where: { tenantId: actor.tenantId },
      data: { submissionRequired: false },
    });
    const dashboard = await service.getDashboard(actor, studentId);
    expect(dashboard.homework).toEqual({ pendingCount: 0, nextDueAt: null });
  });
});
