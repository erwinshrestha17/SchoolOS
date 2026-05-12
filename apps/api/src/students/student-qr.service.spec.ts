import { Test, TestingModule } from '@nestjs/testing';
import { StudentQrService } from './student-qr.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { StudentQrResolvePurpose } from './dto/student-qr.dto';
import type { AuthContext } from '../auth/auth.types';

// Mocking Prisma enums and classes
jest.mock('@prisma/client', () => ({
  StudentQrStatus: {
    ACTIVE: 'ACTIVE',
    REVOKED: 'REVOKED',
  },
  LibraryIssueStatus: {
    ISSUED: 'ISSUED',
  },
  PrismaClient: class {},
}));

import { StudentQrStatus } from '@prisma/client';

describe('StudentQrService', () => {
  let service: StudentQrService;
  let prisma: PrismaService;
  let audit: AuditService;

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
    guardian: {
      findFirst: jest.fn(),
    },
    staff: {
      findFirst: jest.fn(),
    },
    subjectTeacherAssignment: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(async (callback) => callback(mockPrisma)),
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
        tokenHash: 'stored-hash',
      });

      const result = await service.generateQr('t1', 's1', 'u1');

      expect(result.rawToken).toBeDefined();
      expect(JSON.stringify(result.credential)).not.toContain('stored-hash');
      expect(mockPrisma.studentQrCredential.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId_studentId: { tenantId: 't1', studentId: 's1' } },
          create: expect.objectContaining({
            status: StudentQrStatus.ACTIVE,
          }),
        }),
      );
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
        tokenHash: 'stored-hash',
      });

      const result = await service.generateQr('t1', 's1', 'u1');

      expect(result.rawToken).toBeUndefined();
      expect(result.credential.id).toBe('q1');
      expect(JSON.stringify(result.credential)).not.toContain('stored-hash');
    });
  });

  describe('rotate/revoke', () => {
    it('requires a reason before rotating or revoking QR credentials', async () => {
      await expect(service.rotateQr('t1', 's1', 'u1', 'bad')).rejects.toThrow(
        BadRequestException,
      );

      await expect(service.revokeQr('t1', 's1', 'u1', '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rotates QR credentials in a transaction and does not return tokenHash', async () => {
      mockPrisma.studentQrCredential.findUnique.mockResolvedValue({
        id: 'q1',
        tenantId: 't1',
        studentId: 's1',
      });
      mockPrisma.studentQrCredential.update.mockResolvedValue({
        id: 'q1',
        tokenHash: 'new-hash',
        status: StudentQrStatus.ACTIVE,
      });

      const result = await service.rotateQr(
        't1',
        's1',
        'u1',
        'Lost printed ID card',
      );

      expect(result.rawToken).toBeDefined();
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(JSON.stringify(result.credential)).not.toContain('new-hash');
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'QR_ROTATED',
          after: expect.objectContaining({ reason: 'Lost printed ID card' }),
        }),
      );
    });
  });

  describe('resolveQr', () => {
    it('should resolve active QR', async () => {
      const token = 'valid-token';
      const mockCredential = {
        id: 'q1',
        tenantId: 't1',
        studentId: 's1',
        status: StudentQrStatus.ACTIVE,
        student: {
          id: 's1',
          classId: 'class-1',
          sectionId: 'section-1',
          studentSystemId: 'STU001',
          firstNameEn: 'John',
          lastNameEn: 'Doe',
          class: { name: 'Class 1' },
          sectionRef: { name: 'A' },
        },
      };

      mockPrisma.studentQrCredential.findUnique.mockResolvedValue(
        mockCredential,
      );
      mockPrisma.studentQrCredential.update.mockResolvedValue({});

      const result = await service.resolveQr(
        't1',
        token,
        StudentQrResolvePurpose.GENERAL_STUDENT_LOOKUP,
        actor(),
      );

      expect(result.studentId).toBe('s1');
      expect(result.name).toBe('John Doe');
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'QR_RESOLVED',
        }),
      );
    });

    it('should fail for revoked QR', async () => {
      const token = 'revoked-token';
      mockPrisma.studentQrCredential.findUnique.mockResolvedValue({
        id: 'q1',
        tenantId: 't1',
        status: StudentQrStatus.REVOKED,
      });

      await expect(
        service.resolveQr(
          't1',
          token,
          StudentQrResolvePurpose.GENERAL_STUDENT_LOOKUP,
          actor(),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should fail for wrong tenant', async () => {
      const token = 'other-tenant-token';
      mockPrisma.studentQrCredential.findUnique.mockResolvedValue({
        id: 'q1',
        tenantId: 't2',
        status: StudentQrStatus.ACTIVE,
      });

      await expect(
        service.resolveQr(
          't1',
          token,
          StudentQrResolvePurpose.GENERAL_STUDENT_LOOKUP,
          actor(),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects parent scans for unrelated students', async () => {
      mockPrisma.studentQrCredential.findUnique.mockResolvedValue({
        id: 'q1',
        tenantId: 't1',
        studentId: 's2',
        status: StudentQrStatus.ACTIVE,
        student: studentPayload({ id: 's2' }),
      });
      mockPrisma.guardian.findFirst.mockResolvedValue({
        studentLinks: [{ studentId: 's1' }],
      });

      await expect(
        service.resolveQr(
          't1',
          'valid-token',
          StudentQrResolvePurpose.GENERAL_STUDENT_LOOKUP,
          actor({
            roles: ['parent'],
            permissions: ['students:read'],
          }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects teachers who are not assigned to the scanned student', async () => {
      mockPrisma.studentQrCredential.findUnique.mockResolvedValue({
        id: 'q1',
        tenantId: 't1',
        studentId: 's1',
        status: StudentQrStatus.ACTIVE,
        student: studentPayload(),
      });
      mockPrisma.staff.findFirst.mockResolvedValue({ id: 'staff-1' });
      mockPrisma.subjectTeacherAssignment.findFirst.mockResolvedValue(null);

      await expect(
        service.resolveQr(
          't1',
          'valid-token',
          StudentQrResolvePurpose.ATTENDANCE,
          actor({
            roles: ['teacher'],
            permissions: ['students:read', 'attendance:read'],
          }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns purpose-limited canteen data without broad medical fields', async () => {
      mockPrisma.studentQrCredential.findUnique.mockResolvedValue({
        id: 'q1',
        tenantId: 't1',
        studentId: 's1',
        status: StudentQrStatus.ACTIVE,
        student: studentPayload({
          severeAllergies: 'peanut, egg',
          medicalConditions: 'private condition',
        }),
      });
      mockPrisma.studentQrCredential.update.mockResolvedValue({});
      mockPrisma.canteenWallet.findUnique.mockResolvedValue({
        balance: { toString: () => '150.00' },
      });

      const result = await service.resolveQr(
        't1',
        'valid-token',
        StudentQrResolvePurpose.CANTEEN,
        actor({
          permissions: ['canteen:serving:create'],
        }),
      );

      expect(result).toMatchObject({
        studentId: 's1',
        allergyWarnings: ['peanut', 'egg'],
        walletBalance: '150.00',
      });
      expect(JSON.stringify(result)).not.toContain('private condition');
    });
  });
});

function actor(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: 'u1',
    tenantId: 't1',
    tenantSlug: 'school',
    email: 'user@example.com',
    authMethod: 'PASSWORD',
    roles: ['admin'],
    permissions: ['students:read', 'students:qr:resolve'],
    ...overrides,
  };
}

function studentPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 's1',
    classId: 'class-1',
    sectionId: 'section-1',
    studentSystemId: 'STU001',
    firstNameEn: 'John',
    lastNameEn: 'Doe',
    photoUrl: null,
    severeAllergies: null,
    class: { name: 'Class 1' },
    sectionRef: { name: 'A' },
    ...overrides,
  };
}
