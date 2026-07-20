import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CasRecordsService } from './cas-records.service';

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CasRecordsService,
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
            section: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
            subject: { findFirst: jest.fn() },
            student: { findMany: jest.fn(), findFirst: jest.fn() },
            staff: { findFirst: jest.fn() },
            subjectTeacherAssignment: { findMany: jest.fn().mockResolvedValue([]) },
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

  describe('teacher scoping (confirmed gap: previously tenant-wide for any cas-records:read holder)', () => {
    it('scopes list() to the teacher own assigned class/section', async () => {
      (prisma.staff.findFirst as jest.Mock).mockResolvedValue({ id: 'staff-1' });
      (prisma.subjectTeacherAssignment.findMany as jest.Mock).mockResolvedValue([
        { classId: 'class-1', sectionId: 'section-1' },
      ]);
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
      (prisma.staff.findFirst as jest.Mock).mockResolvedValue({ id: 'staff-1' });
      (prisma.subjectTeacherAssignment.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.list(teacherActor, {});

      expect(result).toEqual(
        expect.objectContaining({ items: [], total: 0 }),
      );
      expect(prisma.casRecord.findMany).not.toHaveBeenCalled();
    });

    it('blocks a teacher from viewing a CAS record outside their scope', async () => {
      (prisma.casRecord.findFirst as jest.Mock).mockResolvedValue({
        id: 'cas-1',
        classId: 'class-9',
        sectionId: 'section-9',
      });
      (prisma.staff.findFirst as jest.Mock).mockResolvedValue({ id: 'staff-1' });
      (prisma.subjectTeacherAssignment.findMany as jest.Mock).mockResolvedValue([
        { classId: 'class-1', sectionId: 'section-1' },
      ]);

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
      (prisma.staff.findFirst as jest.Mock).mockResolvedValue({ id: 'staff-1' });
      (prisma.subjectTeacherAssignment.findMany as jest.Mock).mockResolvedValue([
        { classId: 'class-1', sectionId: 'section-1' },
      ]);

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
  });
});
