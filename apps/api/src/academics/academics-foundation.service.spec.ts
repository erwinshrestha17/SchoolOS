import { NotFoundException } from '@nestjs/common';
import { AssessmentType, AuthMethod, Prisma } from '@prisma/client';
import { AcademicsFoundationService } from './academics-foundation.service';

const actor = {
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  userId: 'user-1',
  email: 'academic@school.test',
  roles: ['admin'],
  permissions: ['academics:create', 'assessment-components:manage'],
  authMethod: AuthMethod.PASSWORD,
};

describe('AcademicsFoundationService assessment templates', () => {
  it('lists deterministic assessment templates without tenant data', () => {
    const { service } = buildService();

    expect(service.listAssessmentTemplates()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'basic-terminal',
          defaultExamTermName: 'Terminal Exam',
        }),
        expect.objectContaining({
          key: 'theory-practical',
          defaultExamTermName: 'Theory Practical Exam',
        }),
      ]),
    );
  });

  it('applies a theory-practical template to tenant-owned class subjects', async () => {
    const { service, prisma, auditService } = buildService({
      subjects: [
        {
          id: 'subject-science',
          tenantId: actor.tenantId,
          classId: 'class-1',
          code: 'SCI',
          name: 'Science',
          hasPractical: true,
          theoryMarks: 70,
          practicalMarks: 30,
          passMarks: null,
        },
        {
          id: 'subject-english',
          tenantId: actor.tenantId,
          classId: 'class-1',
          code: 'ENG',
          name: 'English',
          hasPractical: false,
          theoryMarks: null,
          practicalMarks: null,
          passMarks: 40,
        },
      ],
    });

    const result = await service.applyAssessmentTemplate(
      {
        academicYearId: 'year-1',
        classId: 'class-1',
        templateKey: 'theory-practical',
        examTermName: 'First Terminal',
        startsOn: '2026-06-01',
        endsOn: '2026-06-15',
        reason: 'Initial exam setup',
      },
      actor,
    );

    expect(prisma.subject.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        classId: 'class-1',
      },
      orderBy: [{ code: 'asc' }],
    });
    expect(prisma.examTerm.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: actor.tenantId,
          academicYearId: 'year-1',
          name: 'First Terminal',
          status: 'DRAFT',
        }),
      }),
    );
    expect(prisma.assessmentComponent.create).toHaveBeenCalledTimes(3);
    expect(prisma.assessmentComponent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subjectId: 'subject-science',
          name: 'Theory',
          type: AssessmentType.THEORY,
          maxMarks: new Prisma.Decimal(70),
        }),
      }),
    );
    expect(prisma.assessmentComponent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subjectId: 'subject-english',
          name: 'Terminal',
          type: AssessmentType.TERMINAL,
          passMarks: new Prisma.Decimal(40),
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'apply_template',
        resource: 'assessment_template',
        tenantId: actor.tenantId,
        after: expect.objectContaining({
          templateKey: 'theory-practical',
          subjectCount: 2,
          componentCount: 3,
          reason: 'Initial exam setup',
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        templateKey: 'theory-practical',
        subjectCount: 2,
        componentCount: 3,
      }),
    );
  });

  it('fails closed when selected subjects are outside the tenant class', async () => {
    const { service } = buildService({ subjects: [] });

    await expect(
      service.applyAssessmentTemplate(
        {
          academicYearId: 'year-1',
          classId: 'class-1',
          templateKey: 'basic-terminal',
          subjectIds: ['subject-other'],
          startsOn: '2026-06-01',
          endsOn: '2026-06-15',
        },
        actor,
      ),
    ).rejects.toThrow(NotFoundException);
  });
});

function buildService(options: { subjects?: unknown[] } = {}) {
  const prisma = {
    academicYear: {
      findFirst: jest.fn().mockResolvedValue({ id: 'year-1' }),
    },
    class: {
      findFirst: jest.fn().mockResolvedValue({ id: 'class-1' }),
    },
    examTerm: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { weightPercent: null } }),
      create: jest.fn().mockResolvedValue({
        id: 'term-1',
        tenantId: actor.tenantId,
        name: 'First Terminal',
      }),
    },
    subject: {
      findMany: jest.fn().mockResolvedValue(options.subjects ?? []),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    assessmentComponent: {
      count: jest.fn(),
      create: jest.fn().mockImplementation(async ({ data }) => ({
        id: `component-${data.subjectId}-${data.name}`,
        ...data,
        subject: { id: data.subjectId },
      })),
    },
    markEntry: { count: jest.fn() },
    reportCard: { count: jest.fn() },
    examTimetableSlot: { count: jest.fn() },
    casRecord: { count: jest.fn() },
    timetableSlot: { count: jest.fn() },
    homeworkAssignment: { count: jest.fn() },
    $transaction: jest.fn(async (callback) => callback(prisma)),
  };
  const auditService = {
    record: jest.fn(),
  };

  return {
    service: new AcademicsFoundationService(
      prisma as never,
      auditService as never,
    ),
    prisma,
    auditService,
  };
}
