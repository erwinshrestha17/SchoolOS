import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { GradeCalculatorService } from './grade-calculator.service';
import { ResultsService, StudentPreviewResult } from './results.service';
import { AuthContext } from '../auth/auth.types';

describe('ResultsService', () => {
  let service: ResultsService;
  let prisma: PrismaService;

  const mockActor = {
    tenantId: 'tenant-1',
    userId: 'user-1',
    roles: ['admin'],
    permissions: ['results:read'],
  } as unknown as AuthContext;

  const teacherActor = {
    tenantId: 'tenant-1',
    userId: 'teacher-user-1',
    roles: ['teacher'],
    permissions: ['results:read', 'academics:read'],
  } as unknown as AuthContext;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResultsService,
        GradeCalculatorService,
        {
          provide: PrismaService,
          useValue: {
            student: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
            },
            examTerm: {
              findFirst: jest.fn(),
            },
            class: {
              findFirst: jest.fn(),
            },
            section: {
              findFirst: jest.fn(),
              findMany: jest.fn().mockResolvedValue([]),
            },
            assessmentComponent: {
              findMany: jest.fn(),
            },
            markEntry: {
              findMany: jest.fn(),
            },
            casRecord: {
              findMany: jest.fn(),
            },
            staff: {
              findFirst: jest.fn(),
            },
            subjectTeacherAssignment: {
              findMany: jest.fn().mockResolvedValue([]),
            },
          },
        },
      ],
    }).compile();

    service = module.get<ResultsService>(ResultsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('previewStudentResult', () => {
    it('rejects if student belongs to another tenant', async () => {
      (prisma.student.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.previewStudentResult('other-student', mockActor, {
          examTermId: 'term-1',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects if exam term belongs to another tenant', async () => {
      (prisma.student.findFirst as jest.Mock).mockResolvedValue({
        id: 's1',
        tenantId: 'tenant-1',
        class: { name: '10' },
      });
      (prisma.examTerm.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.previewStudentResult('s1', mockActor, {
          examTermId: 'other-term',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('loads marks and calculates preview for a student', async () => {
      (prisma.student.findFirst as jest.Mock).mockResolvedValue({
        id: 's1',
        tenantId: 'tenant-1',
        studentSystemId: 'SID001',
        firstNameEn: 'John',
        lastNameEn: 'Doe',
        classId: 'c1',
        class: { id: 'c1', name: 'Class 10' },
        sectionRef: { id: 'sec1', name: 'A' },
        rollNumber: 1,
      });
      (prisma.examTerm.findFirst as jest.Mock).mockResolvedValue({
        id: 'term-1',
        name: 'First Term',
        tenantId: 'tenant-1',
      });
      (prisma.assessmentComponent.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'comp1',
          name: 'Theory',
          subjectId: 'sub1',
          type: 'THEORY',
          maxMarks: 100,
          weightPercent: 100,
          subject: { id: 'sub1', name: 'Math', code: 'M101' },
        },
      ]);
      (prisma.markEntry.findMany as jest.Mock).mockResolvedValue([
        {
          assessmentComponentId: 'comp1',
          marksObtained: 85,
          status: 'SUBMITTED',
        },
      ]);

      const result = await service.previewStudentResult('s1', mockActor, {
        examTermId: 'term-1',
      });

      expect(result.student.name).toBe('John Doe');
      expect(result.subjects).toHaveLength(1);
      expect(result.subjects[0].percentage).toBe(85);
      expect(result.summary.percentage).toBe(85);
      expect(result.summary.resultStatus).toBe('PASS');
    });

    it('includes CAS records when includeCas is true', async () => {
      (prisma.student.findFirst as jest.Mock).mockResolvedValue({
        id: 's1',
        tenantId: 'tenant-1',
        class: { name: '10' },
      });
      (prisma.examTerm.findFirst as jest.Mock).mockResolvedValue({
        id: 'term-1',
        academicYearId: 'ay1',
        tenantId: 'tenant-1',
      });
      (prisma.assessmentComponent.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.markEntry.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.casRecord.findMany as jest.Mock).mockResolvedValue([
        {
          subjectId: 'sub1',
          category: 'HW',
          score: 10,
          maxScore: 10,
          subject: { name: 'Math' },
        },
      ]);

      const result = await service.previewStudentResult('s1', mockActor, {
        examTermId: 'term-1',
        includeCas: true,
      });

      expect(result.casSummaries).toHaveLength(1);
      expect(result.casSummaries[0].totalScore).toBe(10);
    });
  });

  describe('previewClassResults', () => {
    it('validates class and section ownership', async () => {
      (prisma.examTerm.findFirst as jest.Mock).mockResolvedValue({
        id: 'term-1',
      });
      (prisma.class.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.previewClassResults(mockActor, {
          examTermId: 'term-1',
          classId: 'other-class',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('paginates students in class preview', async () => {
      (prisma.examTerm.findFirst as jest.Mock).mockResolvedValue({
        id: 'term-1',
        tenantId: 'tenant-1',
      });
      (prisma.class.findFirst as jest.Mock).mockResolvedValue({
        id: 'c1',
        tenantId: 'tenant-1',
      });
      (prisma.student.count as jest.Mock).mockResolvedValue(10);
      (prisma.student.findMany as jest.Mock).mockResolvedValue([
        { id: 's1', firstNameEn: 'A', lastNameEn: 'B', class: { name: '10' } },
      ]);

      // Mock previewStudentResult internal calls
      jest.spyOn(service, 'previewStudentResult').mockResolvedValue({
        student: { name: 'A B' },
        summary: { percentage: 80 },
      } as unknown as StudentPreviewResult);

      const result = await service.previewClassResults(mockActor, {
        examTermId: 'term-1',
        classId: 'c1',
        page: 1,
        limit: 1,
      });

      expect(result.items).toHaveLength(1);
      expect(result.meta.total).toBe(10);
    });
  });

  describe('teacher scoping (confirmed gap: previously any results:read holder could preview any student/class)', () => {
    it('blocks a teacher from previewing a student outside their teaching scope', async () => {
      (prisma.student.findFirst as jest.Mock).mockResolvedValue({
        id: 's1',
        tenantId: 'tenant-1',
        classId: 'class-9',
        sectionId: 'section-9',
        class: { name: '10' },
      });
      (prisma.staff.findFirst as jest.Mock).mockResolvedValue({
        id: 'staff-1',
      });
      (prisma.subjectTeacherAssignment.findMany as jest.Mock).mockResolvedValue(
        [{ classId: 'class-1', sectionId: 'section-1' }],
      );

      await expect(
        service.previewStudentResult('s1', teacherActor, {
          examTermId: 'term-1',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows a teacher to preview a student within their teaching scope', async () => {
      (prisma.student.findFirst as jest.Mock).mockResolvedValue({
        id: 's1',
        tenantId: 'tenant-1',
        studentSystemId: 'SID001',
        firstNameEn: 'John',
        lastNameEn: 'Doe',
        classId: 'class-1',
        sectionId: 'section-1',
        class: { id: 'class-1', name: 'Class 10' },
        sectionRef: { id: 'section-1', name: 'A' },
        rollNumber: 1,
      });
      (prisma.examTerm.findFirst as jest.Mock).mockResolvedValue({
        id: 'term-1',
        name: 'First Term',
        tenantId: 'tenant-1',
      });
      (prisma.assessmentComponent.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.markEntry.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.staff.findFirst as jest.Mock).mockResolvedValue({
        id: 'staff-1',
      });
      (prisma.subjectTeacherAssignment.findMany as jest.Mock).mockResolvedValue(
        [{ classId: 'class-1', sectionId: 'section-1' }],
      );

      await expect(
        service.previewStudentResult('s1', teacherActor, {
          examTermId: 'term-1',
        }),
      ).resolves.toBeDefined();
    });

    it('blocks a teacher from previewing a whole class they do not teach', async () => {
      (prisma.staff.findFirst as jest.Mock).mockResolvedValue({
        id: 'staff-1',
      });
      (prisma.subjectTeacherAssignment.findMany as jest.Mock).mockResolvedValue(
        [{ classId: 'class-1', sectionId: 'section-1' }],
      );

      await expect(
        service.previewClassResults(teacherActor, {
          examTermId: 'term-1',
          classId: 'class-9',
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.examTerm.findFirst).not.toHaveBeenCalled();
    });

    it('allows a section-specific teacher to preview a section-agnostic (sectionId: null) student in their class -- regression for an asymmetric wildcard check found via live edge-case testing', async () => {
      (prisma.student.findFirst as jest.Mock).mockResolvedValue({
        id: 's1',
        tenantId: 'tenant-1',
        studentSystemId: 'SID001',
        firstNameEn: 'John',
        lastNameEn: 'Doe',
        classId: 'class-1',
        sectionId: null,
        class: { id: 'class-1', name: 'Class 10' },
        sectionRef: null,
        rollNumber: 1,
      });
      (prisma.examTerm.findFirst as jest.Mock).mockResolvedValue({
        id: 'term-1',
        name: 'First Term',
        tenantId: 'tenant-1',
      });
      (prisma.assessmentComponent.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.markEntry.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.staff.findFirst as jest.Mock).mockResolvedValue({
        id: 'staff-1',
      });
      (prisma.subjectTeacherAssignment.findMany as jest.Mock).mockResolvedValue(
        [{ classId: 'class-1', sectionId: 'section-1' }],
      );

      await expect(
        service.previewStudentResult('s1', teacherActor, {
          examTermId: 'term-1',
        }),
      ).resolves.toBeDefined();
    });
  });
});
