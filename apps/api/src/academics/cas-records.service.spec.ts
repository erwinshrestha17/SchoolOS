import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CasRecordsService } from './cas-records.service';
import { TeacherScopeService } from '../teacher-scope/teacher-scope.service';
import {
  createTeacherScopeServiceForTests,
  teacherAssignmentFixture,
} from '../../test/test-helpers';

describe('CasRecordsService', () => {
  let service: CasRecordsService;
  let prisma: PrismaService;

  const mockActor = {
    userId: 'user-1',
    tenantId: 'tenant-1',
    tenantSlug: 'tenant-one',
    roles: ['admin'],
    permissions: [],
  } as unknown as AuthContext;

  const teacherActor = {
    userId: 'teacher-user-1',
    tenantId: 'tenant-1',
    tenantSlug: 'tenant-one',
    roles: ['teacher'],
    permissions: ['cas-records:read', 'academics:read'],
  } as unknown as AuthContext;
  let teacherAssignments: Array<Record<string, any>>;

  beforeEach(async () => {
    teacherAssignments = [];
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CasRecordsService,
        {
          // Real resolver over an in-memory assignment store; tests that care
          // about scoping push rows via `teacherAssignments`.
          provide: TeacherScopeService,
          useFactory: () => {
            const deps = createTeacherScopeServiceForTests({
              get assignments() {
                return teacherAssignments;
              },
              staffId: 'staff-1',
            } as never);
            return new TeacherScopeService(
              deps.prisma as never,
              deps.audit as never,
            );
          },
        },
        {
          provide: PrismaService,
          useValue: {
            casRecord: {
              findMany: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              count: jest.fn(),
            },
            academicYear: { findFirst: jest.fn() },
            class: { findFirst: jest.fn() },
            section: {
              findFirst: jest.fn(),
              findMany: jest.fn().mockResolvedValue([]),
            },
            subject: { findFirst: jest.fn() },
            student: { findMany: jest.fn(), findFirst: jest.fn() },
            staff: { findFirst: jest.fn() },
            subjectTeacherAssignment: {
              findMany: jest.fn().mockResolvedValue([]),
            },
            $transaction: jest.fn((promises: unknown[]) =>
              Promise.all(promises),
            ),
          },
        },
        {
          provide: AuditService,
          useValue: { record: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<CasRecordsService>(CasRecordsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const validDto = {
      academicYearId: 'year-1',
      classId: 'class-1',
      subjectId: 'subject-1',
      studentId: 'student-1',
      category: 'Participation',
      score: 4,
      maxScore: 5,
      observedOn: '2026-05-11',
    };

    function mockValidScope() {
      (prisma.academicYear.findFirst as jest.Mock).mockResolvedValue({
        id: 'year-1',
      });
      (prisma.class.findFirst as jest.Mock).mockResolvedValue({
        id: 'class-1',
      });
      (prisma.subject.findFirst as jest.Mock).mockResolvedValue({
        id: 'subject-1',
      });
      (prisma.student.findFirst as jest.Mock).mockResolvedValue({
        id: 'student-1',
      });
    }

    it('rejects if score exceeds maxScore', async () => {
      mockValidScope();

      await expect(
        service.create({ ...validDto, score: 10, maxScore: 5 }, mockActor),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects if score is negative', async () => {
      mockValidScope();

      await expect(
        service.create({ ...validDto, score: -1 }, mockActor),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects student from another tenant/class', async () => {
      (prisma.academicYear.findFirst as jest.Mock).mockResolvedValue({
        id: 'year-1',
      });
      (prisma.class.findFirst as jest.Mock).mockResolvedValue({
        id: 'class-1',
      });
      (prisma.subject.findFirst as jest.Mock).mockResolvedValue({
        id: 'subject-1',
      });
      (prisma.student.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.create(validDto, mockActor)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('denies create for a teacher without MARKS_ENTER assignment', async () => {
      mockValidScope();
      (prisma.section.findFirst as jest.Mock).mockResolvedValue({
        id: 'section-1',
      });
      (prisma.student.findFirst as jest.Mock).mockResolvedValue({
        id: 'student-1',
        sectionId: 'section-1',
      });
      teacherAssignments = [
        teacherAssignmentFixture({
          tenantId: 'tenant-1',
          staffId: 'staff-1',
          assignmentType: 'SUBJECT_TEACHER',
          classId: 'class-1',
          sectionId: 'section-1',
          subjectId: 'subject-other',
        }),
      ];

      await expect(
        service.create({ ...validDto, sectionId: 'section-1' }, {
          ...teacherActor,
          permissions: ['academics:enter_marks'],
        } as AuthContext),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows create for a teacher with matching MARKS_ENTER assignment', async () => {
      mockValidScope();
      (prisma.section.findFirst as jest.Mock).mockResolvedValue({
        id: 'section-1',
      });
      (prisma.student.findFirst as jest.Mock).mockResolvedValue({
        id: 'student-1',
        sectionId: 'section-1',
      });
      teacherAssignments = [
        teacherAssignmentFixture({
          tenantId: 'tenant-1',
          staffId: 'staff-1',
          assignmentType: 'SUBJECT_TEACHER',
          classId: 'class-1',
          sectionId: 'section-1',
          subjectId: 'subject-1',
        }),
      ];
      (prisma.casRecord.create as jest.Mock).mockResolvedValue({
        id: 'cas-new',
        ...validDto,
        tenantId: 'tenant-1',
        sectionId: 'section-1',
        observedOn: new Date('2026-05-11'),
        note: null,
      });

      await expect(
        service.create({ ...validDto, sectionId: 'section-1' }, {
          ...teacherActor,
          permissions: ['academics:enter_marks'],
        } as AuthContext),
      ).resolves.toBeDefined();
    });
  });

  describe('list', () => {
    it('returns paginated results with tenant isolation', async () => {
      (prisma.casRecord.findMany as jest.Mock).mockResolvedValue([
        { id: 'cas-1' },
      ]);
      (prisma.casRecord.count as jest.Mock).mockResolvedValue(1);

      const result = await service.list(mockActor, {
        page: 1,
        limit: 10,
      });

      expect(result.items).toHaveLength(1);
      expect(prisma.casRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: mockActor.tenantId }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('returns CAS detail with only the narrow student identity projection', async () => {
      const student = {
        id: 'student-1',
        firstNameEn: 'Asha',
        lastNameEn: 'Tamang',
        studentSystemId: 'STD-001',
      };
      (prisma.casRecord.findFirst as jest.Mock).mockResolvedValue({
        id: 'cas-1',
        classId: 'class-1',
        sectionId: 'section-1',
        student,
      });

      const result = await service.findOne('cas-1', mockActor);

      expect(prisma.casRecord.findFirst).toHaveBeenCalledWith({
        where: { id: 'cas-1', tenantId: mockActor.tenantId },
        include: {
          student: {
            select: {
              id: true,
              firstNameEn: true,
              lastNameEn: true,
              studentSystemId: true,
            },
          },
          subject: true,
          class: true,
          section: true,
          academicYear: true,
        },
      });
      expect(result.student).toEqual(student);
    });
  });

  describe('teacher scoping (confirmed gap: previously tenant-wide for any cas-records:read holder)', () => {
    it('scopes list() to the teacher own assigned class/section', async () => {
      (prisma.staff.findFirst as jest.Mock).mockResolvedValue({
        id: 'staff-1',
      });
      teacherAssignments = [
        teacherAssignmentFixture({
          tenantId: 'tenant-1',
          staffId: 'staff-1',
          assignmentType: 'SUBJECT_TEACHER',
          classId: 'class-1',
          sectionId: 'section-1',
        }),
      ];
      (prisma.casRecord.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.casRecord.count as jest.Mock).mockResolvedValue(0);

      await service.list(teacherActor, {});

      expect(prisma.casRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: teacherActor.tenantId,
            OR: [
              { classId: 'class-1', sectionId: 'section-1' },
              { classId: 'class-1', sectionId: null },
            ],
          }),
        }),
      );
    });

    it('returns an empty page for a teacher with no active assignment', async () => {
      (prisma.staff.findFirst as jest.Mock).mockResolvedValue({
        id: 'staff-1',
      });
      teacherAssignments = [];

      const result = await service.list(teacherActor, {});

      expect(result).toEqual(expect.objectContaining({ items: [], total: 0 }));
      expect(prisma.casRecord.findMany).not.toHaveBeenCalled();
    });

    it('blocks a teacher from viewing a CAS record outside their scope', async () => {
      (prisma.casRecord.findFirst as jest.Mock).mockResolvedValue({
        id: 'cas-1',
        classId: 'class-9',
        sectionId: 'section-9',
      });
      (prisma.staff.findFirst as jest.Mock).mockResolvedValue({
        id: 'staff-1',
      });
      teacherAssignments = [
        teacherAssignmentFixture({
          tenantId: 'tenant-1',
          staffId: 'staff-1',
          assignmentType: 'SUBJECT_TEACHER',
          classId: 'class-1',
          sectionId: 'section-1',
        }),
      ];

      await expect(service.findOne('cas-1', teacherActor)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows a teacher to view a CAS record within their scope', async () => {
      (prisma.casRecord.findFirst as jest.Mock).mockResolvedValue({
        id: 'cas-1',
        classId: 'class-1',
        sectionId: 'section-1',
      });
      (prisma.staff.findFirst as jest.Mock).mockResolvedValue({
        id: 'staff-1',
      });
      teacherAssignments = [
        teacherAssignmentFixture({
          tenantId: 'tenant-1',
          staffId: 'staff-1',
          assignmentType: 'SUBJECT_TEACHER',
          classId: 'class-1',
          sectionId: 'section-1',
        }),
      ];

      await expect(
        service.findOne('cas-1', teacherActor),
      ).resolves.toBeDefined();
    });

    it('allows a section-specific teacher to view a whole-class (sectionId: null) CAS record for their class -- regression for an asymmetric wildcard check found via live edge-case testing', async () => {
      (prisma.casRecord.findFirst as jest.Mock).mockResolvedValue({
        id: 'cas-1',
        classId: 'class-1',
        sectionId: null,
      });
      (prisma.staff.findFirst as jest.Mock).mockResolvedValue({
        id: 'staff-1',
      });
      teacherAssignments = [
        teacherAssignmentFixture({
          tenantId: 'tenant-1',
          staffId: 'staff-1',
          assignmentType: 'SUBJECT_TEACHER',
          classId: 'class-1',
          sectionId: 'section-1',
        }),
      ];

      await expect(
        service.findOne('cas-1', teacherActor),
      ).resolves.toBeDefined();
    });
  });

  describe('bulkUpsert', () => {
    it('rejects duplicate student IDs in the same request', async () => {
      (prisma.academicYear.findFirst as jest.Mock).mockResolvedValue({
        id: 'year-1',
      });
      (prisma.class.findFirst as jest.Mock).mockResolvedValue({
        id: 'class-1',
      });

      const dto = {
        academicYearId: 'year-1',
        classId: 'class-1',
        category: 'Sports',
        maxScore: 10,
        observedOn: '2026-05-11',
        entries: [
          { studentId: 's1', score: 5 },
          { studentId: 's1', score: 6 },
        ],
      };

      await expect(service.bulkUpsert(dto, mockActor)).rejects.toThrow(
        ConflictException,
      );
    });

    it('denies bulkUpsert for a teacher without assignment scope', async () => {
      (prisma.academicYear.findFirst as jest.Mock).mockResolvedValue({
        id: 'year-1',
      });
      (prisma.class.findFirst as jest.Mock).mockResolvedValue({
        id: 'class-1',
      });
      (prisma.subject.findFirst as jest.Mock).mockResolvedValue({
        id: 'subject-1',
      });
      (prisma.section.findFirst as jest.Mock).mockResolvedValue({
        id: 'section-1',
      });
      (prisma.student.findMany as jest.Mock).mockResolvedValue([
        { id: 's1', sectionId: 'section-1' },
      ]);
      teacherAssignments = [
        teacherAssignmentFixture({
          tenantId: 'tenant-1',
          staffId: 'staff-1',
          assignmentType: 'SUBJECT_TEACHER',
          classId: 'class-1',
          sectionId: 'section-1',
          subjectId: 'subject-other',
        }),
      ];

      await expect(
        service.bulkUpsert(
          {
            academicYearId: 'year-1',
            classId: 'class-1',
            sectionId: 'section-1',
            subjectId: 'subject-1',
            category: 'Sports',
            maxScore: 10,
            observedOn: '2026-05-11',
            entries: [{ studentId: 's1', score: 5 }],
          },
          {
            ...teacherActor,
            permissions: ['academics:enter_marks'],
          } as AuthContext,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
