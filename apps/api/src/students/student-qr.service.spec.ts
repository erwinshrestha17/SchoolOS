import { Test, TestingModule } from '@nestjs/testing';
import { StudentQrService } from './student-qr.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { StudentQrResolvePurpose } from './dto/student-qr.dto';
import { hashToken } from '../auth/auth.utils';

// Mocking Prisma enums and classes
jest.mock('@prisma/client', () => ({
  StudentQrStatus: {
    ACTIVE: 'ACTIVE',
    REVOKED: 'REVOKED',
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

      const result = await service.generateQr('t1', 's1', 'u1');

      expect(result.rawToken).toBeDefined();
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
      });

      const result = await service.generateQr('t1', 's1', 'u1');

      expect(result.rawToken).toBeUndefined();
      expect(result.credential.id).toBe('q1');
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
        'u1',
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
          'u1',
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
          'u1',
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
