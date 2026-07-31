import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TeacherAssignmentStatus, TeacherAssignmentType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { TeacherReplacementService } from './teacher-replacement.service';

describe('TeacherReplacementService', () => {
  let service: TeacherReplacementService;
  let prisma: PrismaService;

  const actor = {
    tenantId: 'tenant-1',
    userId: 'user-1',
    permissions: ['timetable:substitute'],
    roles: ['admin'],
  };

  const sourceAssignment = {
    id: 'assign-1',
    tenantId: 'tenant-1',
    academicYearId: 'year-1',
    staffId: 'staff-old',
    assignmentType: TeacherAssignmentType.SUBJECT_TEACHER,
    classId: 'class-1',
    sectionId: 'section-1',
    subjectId: 'subject-1',
    componentScope: null,
    isPrimary: true,
    status: TeacherAssignmentStatus.ACTIVE,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeacherReplacementService,
        {
          provide: PrismaService,
          useValue: {
            teacherAssignment: {
              findFirst: jest.fn(),
              update: jest.fn(),
              create: jest.fn(),
            },
            teacherReplacement: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            teacherReplacementPendingWork: {
              findFirst: jest.fn(),
              update: jest.fn(),
            },
            teacherHandoverNote: {
              create: jest.fn(),
            },
            staff: {
              findFirst: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: { record: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(TeacherReplacementService);
    prisma = module.get(PrismaService);
  });

  it('schedules a replacement without rewriting authorship', async () => {
    jest
      .spyOn(prisma.teacherAssignment, 'findFirst')
      .mockResolvedValue(sourceAssignment as any);
    jest
      .spyOn(prisma.staff, 'findFirst')
      .mockResolvedValue({ id: 'staff-new' } as any);
    jest.spyOn(prisma.teacherReplacement, 'findFirst').mockResolvedValue(null);
    jest.spyOn(prisma.teacherReplacement, 'create').mockResolvedValue({
      id: 'repl-1',
      status: 'SCHEDULED',
      formerStaffId: 'staff-old',
      replacementStaffId: 'staff-new',
      sourceAssignmentId: 'assign-1',
    } as any);

    const result = await service.schedule(
      {
        sourceAssignmentId: 'assign-1',
        replacementStaffId: 'staff-new',
        effectiveFrom: '2026-08-01',
        reason: 'Long-term medical leave',
        pendingWork: [
          {
            kind: 'HOMEWORK_DRAFT',
            resourceId: 'hw-1',
            resourceLabel: 'Chapter 3 draft',
          },
        ],
      },
      actor as any,
    );

    expect(result.id).toBe('repl-1');
    expect(prisma.teacherReplacement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          formerStaffId: 'staff-old',
          replacementStaffId: 'staff-new',
          status: 'SCHEDULED',
        }),
      }),
    );
  });

  it('activates by revoking former assignment and creating replacement assignment', async () => {
    jest.spyOn(prisma.teacherReplacement, 'findFirst').mockResolvedValue({
      id: 'repl-1',
      tenantId: 'tenant-1',
      status: 'SCHEDULED',
      sourceAssignmentId: 'assign-1',
      academicYearId: 'year-1',
      replacementStaffId: 'staff-new',
      assignmentType: TeacherAssignmentType.SUBJECT_TEACHER,
      classId: 'class-1',
      sectionId: 'section-1',
      subjectId: 'subject-1',
      componentScope: null,
      pendingWork: [],
    } as any);

    const assignmentUpdate = jest.fn().mockResolvedValue({});
    const assignmentCreate = jest.fn().mockResolvedValue({ id: 'assign-new' });
    const replacementUpdate = jest.fn().mockResolvedValue({
      id: 'repl-1',
      status: 'ACTIVE',
      replacementAssignmentId: 'assign-new',
    });

    (prisma.$transaction as jest.Mock).mockImplementation(
      async (fn: (tx: any) => unknown) =>
        fn({
          teacherAssignment: {
            findFirst: jest.fn().mockResolvedValue(sourceAssignment),
            update: assignmentUpdate,
            create: assignmentCreate,
          },
          teacherReplacement: {
            update: replacementUpdate,
          },
        }),
    );

    const result = await service.activate('repl-1', actor as any);

    expect(result.status).toBe('ACTIVE');
    expect(assignmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'assign-1' },
        data: expect.objectContaining({
          status: TeacherAssignmentStatus.REVOKED,
        }),
      }),
    );
    expect(assignmentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          staffId: 'staff-new',
          status: TeacherAssignmentStatus.ACTIVE,
        }),
      }),
    );
  });

  it('requires explicit disposition for each pending work item', async () => {
    jest.spyOn(prisma.teacherReplacement, 'findFirst').mockResolvedValue({
      id: 'repl-1',
      tenantId: 'tenant-1',
      status: 'ACTIVE',
      pendingWork: [
        {
          id: 'pw-1',
          disposition: null,
        },
      ],
    } as any);

    await expect(service.complete('repl-1', actor as any)).rejects.toThrow(
      /All pending work items must be disposed/,
    );
  });

  it('records audited pending-work disposition', async () => {
    jest.spyOn(prisma.teacherReplacement, 'findFirst').mockResolvedValue({
      id: 'repl-1',
      tenantId: 'tenant-1',
      status: 'ACTIVE',
      pendingWork: [],
    } as any);
    jest
      .spyOn(prisma.teacherReplacementPendingWork, 'findFirst')
      .mockResolvedValue({
        id: 'pw-1',
        kind: 'MARK_SUBMISSION',
        resourceId: 'marks-1',
        disposition: null,
      } as any);
    jest
      .spyOn(prisma.teacherReplacementPendingWork, 'update')
      .mockResolvedValue({
        id: 'pw-1',
        disposition: 'TRANSFER',
      } as any);

    const result = await service.disposePendingWork(
      'repl-1',
      'pw-1',
      {
        disposition: 'TRANSFER',
        dispositionNote: 'Hand to incoming teacher',
      },
      actor as any,
    );

    expect(result.disposition).toBe('TRANSFER');
  });

  it('rejects activation when source assignment is missing', async () => {
    jest.spyOn(prisma.teacherReplacement, 'findFirst').mockResolvedValue({
      id: 'repl-1',
      tenantId: 'tenant-1',
      status: 'SCHEDULED',
      sourceAssignmentId: 'assign-missing',
      pendingWork: [],
    } as any);
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (fn: (tx: any) => unknown) =>
        fn({
          teacherAssignment: {
            findFirst: jest.fn().mockResolvedValue(null),
            update: jest.fn(),
            create: jest.fn(),
          },
          teacherReplacement: { update: jest.fn() },
        }),
    );

    await expect(service.activate('repl-1', actor as any)).rejects.toThrow(
      ConflictException,
    );
  });

  it('returns not found for cross-tenant style missing replacement', async () => {
    jest.spyOn(prisma.teacherReplacement, 'findFirst').mockResolvedValue(null);
    await expect(service.get('missing', actor as any)).rejects.toThrow(
      NotFoundException,
    );
  });
});
