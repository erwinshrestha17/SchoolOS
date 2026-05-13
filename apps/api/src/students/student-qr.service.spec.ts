import { Test, TestingModule } from '@nestjs/testing';
import { StudentQrService } from './student-qr.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { StudentQrResolvePurpose } from '@schoolos/core';
import { AuthContext } from '../auth/auth.types';
import { StudentQrStatus, LibraryIssueStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';

describe('StudentQrService', () => {
  let service: StudentQrService;
  let prisma: PrismaService;
  let audit: AuditService;

  const mockAuth: AuthContext = {
    userId: 'u1',
    tenantId: 't1',
    tenantSlug: 'test-school',
    email: 'admin@test.com',
    authMethod: 'PASSWORD',
    roles: ['admin'],
    permissions: ['student:qr:manage', 'student:qr:resolve'],
  };

  const mockPrisma = {
    student: {
      findFirst: jest.fn(),
    },
    studentQrCredential: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    libraryIssue: {
      count: jest.fn(),
    },
    canteenWallet: {
      findUnique: jest.fn(),
    },
    subjectTeacherAssignment: {
      findFirst: jest.fn(),
    },
  };

  const mockAudit = {
    record: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentQrService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<StudentQrService>(StudentQrService);
    prisma = module.get<PrismaService>(PrismaService);
    audit = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateQr', () => {
    it('should generate a new QR if none exists', async () => {
      mockPrisma.student.findFirst.mockResolvedValue({
        id: 's1',
        tenantId: 't1',
      });
      mockPrisma.studentQrCredential.findUnique.mockResolvedValue(null);
      mockPrisma.studentQrCredential.upsert.mockResolvedValue({
        id: 'q1',
        status: StudentQrStatus.ACTIVE,
      });

      const result = await service.generateQr('t1', 's1', mockAuth);

      expect(result.rawToken).toBeDefined();
      expect(mockPrisma.studentQrCredential.upsert).toHaveBeenCalled();
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'QR_GENERATED',
        }),
      );
    });

    it('should return existing if active', async () => {
      mockPrisma.student.findFirst.mockResolvedValue({
        id: 's1',
        tenantId: 't1',
      });
      mockPrisma.studentQrCredential.findUnique.mockResolvedValue({
        id: 'q1',
        status: StudentQrStatus.ACTIVE,
      });

      const result = await service.generateQr('t1', 's1', mockAuth);

      expect(result.rawToken).toBeUndefined();
      expect(result.credential.id).toBe('q1');
    });
  });

  describe('resolveQr', () => {
    const validToken = 'valid-token';
    const mockStudent = {
      id: 's1',
      studentSystemId: 'STU001',
      firstNameEn: 'John',
      lastNameEn: 'Doe',
      classId: 'c1',
      sectionId: 'sec1',
      class: { name: 'Class 1' },
      sectionRef: { name: 'A' },
      guardianLinks: [
        {
          guardian: { userId: 'p1' },
        },
      ],
      severeAllergies: 'Peanuts',
    };

    const mockCredential = {
      id: 'q1',
      tenantId: 't1',
      studentId: 's1',
      status: StudentQrStatus.ACTIVE,
      student: mockStudent,
    };

    it('should resolve active QR for admin', async () => {
      mockPrisma.studentQrCredential.findUnique.mockResolvedValue(mockCredential);
      mockPrisma.studentQrCredential.update.mockResolvedValue({});

      const result = await service.resolveQr(
        't1',
        validToken,
        StudentQrResolvePurpose.GENERAL_STUDENT_LOOKUP,
        mockAuth,
      );

      expect(result.studentId).toBe('s1');
      expect(result.name).toBe('John Doe');
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'QR_RESOLVED' }),
      );
    });

    it('should allow parent to resolve their child', async () => {
      const parentAuth = { ...mockAuth, userId: 'p1', roles: ['parent'] };
      mockPrisma.studentQrCredential.findUnique.mockResolvedValue(mockCredential);

      const result = await service.resolveQr(
        't1',
        validToken,
        StudentQrResolvePurpose.GENERAL_STUDENT_LOOKUP,
        parentAuth,
      );

      expect(result.studentId).toBe('s1');
    });

    it('should fail for unrelated parent', async () => {
      const otherParentAuth = { ...mockAuth, userId: 'p2', roles: ['parent'] };
      mockPrisma.studentQrCredential.findUnique.mockResolvedValue(mockCredential);

      await expect(
        service.resolveQr(
          't1',
          validToken,
          StudentQrResolvePurpose.GENERAL_STUDENT_LOOKUP,
          otherParentAuth,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should fail for unassigned teacher', async () => {
      const teacherAuth = { ...mockAuth, userId: 't1', roles: ['teacher'], permissions: [] };
      mockPrisma.studentQrCredential.findUnique.mockResolvedValue(mockCredential);
      mockPrisma.subjectTeacherAssignment.findFirst.mockResolvedValue(null);

      await expect(
        service.resolveQr(
          't1',
          validToken,
          StudentQrResolvePurpose.GENERAL_STUDENT_LOOKUP,
          teacherAuth,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow assigned teacher to resolve', async () => {
      const teacherAuth = { ...mockAuth, userId: 't1', roles: ['teacher'], permissions: [] };
      mockPrisma.studentQrCredential.findUnique.mockResolvedValue(mockCredential);
      mockPrisma.subjectTeacherAssignment.findFirst.mockResolvedValue({ id: 'asgn1' });

      const result = await service.resolveQr(
        't1',
        validToken,
        StudentQrResolvePurpose.GENERAL_STUDENT_LOOKUP,
        teacherAuth,
      );

      expect(result.studentId).toBe('s1');
    });

    it('should shape response for CANTEEN with allergies', async () => {
      mockPrisma.studentQrCredential.findUnique.mockResolvedValue(mockCredential);
      mockPrisma.canteenWallet.findUnique.mockResolvedValue({
        balance: new Prisma.Decimal(100),
      });

      const result = await service.resolveQr(
        't1',
        validToken,
        StudentQrResolvePurpose.CANTEEN,
        mockAuth,
      );

      expect(result.walletBalance).toBe('100');
      expect(result.allergyWarnings).toContain('Peanuts');
    });

    it('should not include wallet balance in GENERAL_STUDENT_LOOKUP', async () => {
      mockPrisma.studentQrCredential.findUnique.mockResolvedValue(mockCredential);

      const result = await service.resolveQr(
        't1',
        validToken,
        StudentQrResolvePurpose.GENERAL_STUDENT_LOOKUP,
        mockAuth,
      );

      expect(result).not.toHaveProperty('walletBalance');
    });
  });
});

