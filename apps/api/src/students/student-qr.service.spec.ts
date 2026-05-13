import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma, StudentLifecycleStatus, StudentQrStatus } from '@prisma/client';
import { StudentQrResolvePurpose } from '@schoolos/core';
import { hashToken } from '../auth/auth.utils';
import { StudentQrService } from './student-qr.service';

const issuedAt = new Date('2026-05-13T00:00:00.000Z');

function createService() {
  const prisma = {
    student: {
      findFirst: jest.fn(),
    },
    studentQrCredential: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    subjectTeacherAssignment: {
      findFirst: jest.fn(),
    },
    libraryIssue: {
      count: jest.fn(),
    },
    canteenWallet: {
      findUnique: jest.fn(),
    },
    canteenSpendingControl: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
  };

  const auditService = {
    record: jest.fn(),
  };

  const service = new StudentQrService(prisma as any, auditService as any);

  return { service, prisma, auditService };
}

const adminAuth = {
  userId: 'user-admin',
  tenantId: 'tenant-1',
  tenantSlug: 'demo-school',
  email: 'admin@example.com',
  authMethod: 'PASSWORD' as any,
  roles: ['admin'],
  permissions: [
    'students:qr:generate',
    'students:qr:rotate',
    'students:qr:revoke',
    'students:qr:resolve',
    'students:qr:resolve_all',
    'students:read',
  ],
};

const baseCredential = {
  id: 'qr-1',
  tenantId: 'tenant-1',
  studentId: 'student-1',
  tokenHash: hashToken('qr-token'),
  status: StudentQrStatus.ACTIVE,
  createdAt: issuedAt,
  rotatedAt: null,
  revokedAt: null,
  lastScannedAt: null,
};

const activeStudent = {
  id: 'student-1',
  tenantId: 'tenant-1',
  studentSystemId: 'STU-0001',
  firstNameEn: 'Aarav',
  lastNameEn: 'KC',
  classId: 'class-1',
  sectionId: 'section-1',
  photoUrl: null,
  lifecycleStatus: StudentLifecycleStatus.ACTIVE,
  severeAllergies: 'Peanut',
  class: { id: 'class-1', name: 'Grade 1' },
  sectionRef: { id: 'section-1', name: 'A' },
  guardianLinks: [
    {
      guardian: {
        id: 'guardian-1',
        userId: 'guardian-user-1',
      },
    },
  ],
};

describe('StudentQrService', () => {
  it('stores only tokenHash and never returns raw QR token on generation', async () => {
    const { service, prisma } = createService();
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    prisma.studentQrCredential.findUnique.mockResolvedValue(null);
    prisma.studentQrCredential.create.mockImplementation(async ({ data }) => ({
      ...baseCredential,
      ...data,
      id: 'qr-created',
      createdAt: issuedAt,
      rotatedAt: null,
      revokedAt: null,
      lastScannedAt: null,
    }));

    const result = await service.generateQr('tenant-1', 'student-1', adminAuth);

    expect(prisma.studentQrCredential.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        studentId: 'student-1',
        status: StudentQrStatus.ACTIVE,
        tokenHash: expect.any(String),
      }),
    });
    expect(prisma.studentQrCredential.create.mock.calls[0][0].data).not.toHaveProperty(
      'token',
    );
    expect(prisma.studentQrCredential.create.mock.calls[0][0].data).not.toHaveProperty(
      'rawToken',
    );
    expect(result).toHaveProperty('rawToken');
    expect(result.rawToken).toBeDefined();
    expect(result.credential).not.toHaveProperty('tokenHash');
    expect(result.qrImageAvailable).toBe(true);
    expect(result.qrImageSvg).toContain('<svg');
  });

  it('does not expose a printable image for an already-active credential', async () => {
    const { service, prisma } = createService();
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    prisma.studentQrCredential.findUnique.mockResolvedValue(baseCredential);

    const result = await service.generateQr('tenant-1', 'student-1', adminAuth);

    expect(prisma.studentQrCredential.create).not.toHaveBeenCalled();
    expect(result.qrImageAvailable).toBe(false);
    expect(result).not.toHaveProperty('rawToken');
    expect(result.credential).not.toHaveProperty('tokenHash');
  });

  it('requires a reason when rotating or revoking QR credentials', async () => {
    const { service } = createService();

    await expect(
      service.rotateQr('tenant-1', 'student-1', adminAuth, ''),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.revokeQr('tenant-1', 'student-1', adminAuth, ''),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects revoked QR scans', async () => {
    const { service, prisma } = createService();
    prisma.studentQrCredential.findUnique.mockResolvedValue({
      ...baseCredential,
      status: StudentQrStatus.REVOKED,
      student: activeStudent,
    });

    await expect(
      service.resolveQr(
        'tenant-1',
        'qr-token',
        StudentQrResolvePurpose.GENERAL_STUDENT_LOOKUP,
        adminAuth,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('keeps QR scans tenant-scoped', async () => {
    const { service, prisma } = createService();
    prisma.studentQrCredential.findUnique.mockResolvedValue({
      ...baseCredential,
      tenantId: 'tenant-2',
      student: activeStudent,
    });

    await expect(
      service.resolveQr(
        'tenant-1',
        'qr-token',
        StudentQrResolvePurpose.GENERAL_STUDENT_LOOKUP,
        adminAuth,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('limits canteen response shape to purpose-specific safe fields', async () => {
    const { service, prisma } = createService();
    prisma.studentQrCredential.findUnique.mockResolvedValue({
      ...baseCredential,
      student: activeStudent,
    });
    prisma.studentQrCredential.update.mockResolvedValue(baseCredential);
    prisma.canteenWallet.findUnique.mockResolvedValue({
      balance: new Prisma.Decimal(250),
    });

    const result = await service.resolveQr(
      'tenant-1',
      'qr-token',
      StudentQrResolvePurpose.CANTEEN,
      {
        ...adminAuth,
        permissions: ['students:qr:resolve', 'canteen:serving:create'],
      },
    );

    expect(result).toMatchObject({
      studentId: 'student-1',
      studentCode: 'STU-0001',
      name: 'Aarav KC',
      walletBalance: '250',
      allergyWarnings: ['Peanut'],
      purpose: StudentQrResolvePurpose.CANTEEN,
    });
    expect(result).not.toHaveProperty('guardianLinks');
    expect(result).not.toHaveProperty('emergencyPhone');
    expect(result).not.toHaveProperty('medicalConditions');
  });

  it('blocks parent scan access for unrelated children', async () => {
    const { service, prisma } = createService();
    prisma.studentQrCredential.findUnique.mockResolvedValue({
      ...baseCredential,
      student: activeStudent,
    });

    await expect(
      service.resolveQr(
        'tenant-1',
        'qr-token',
        StudentQrResolvePurpose.GENERAL_STUDENT_LOOKUP,
        {
          ...adminAuth,
          userId: 'unrelated-parent-user',
          roles: ['parent'],
          permissions: ['students:qr:resolve', 'students:read'],
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks teachers from resolving unassigned students', async () => {
    const { service, prisma } = createService();
    prisma.studentQrCredential.findUnique.mockResolvedValue({
      ...baseCredential,
      student: activeStudent,
    });
    prisma.subjectTeacherAssignment.findFirst.mockResolvedValue(null);

    await expect(
      service.resolveQr(
        'tenant-1',
        'qr-token',
        StudentQrResolvePurpose.ATTENDANCE,
        {
          ...adminAuth,
          userId: 'teacher-user',
          roles: ['teacher'],
          permissions: ['students:qr:resolve', 'attendance:mark'],
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  // --- Audit log coverage ---

  it('creates audit log for QR generation', async () => {
    const { service, prisma, auditService } = createService();
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    prisma.studentQrCredential.findUnique.mockResolvedValue(null);
    prisma.studentQrCredential.create.mockImplementation(async ({ data }) => ({
      ...baseCredential,
      ...data,
      id: 'qr-created',
      createdAt: issuedAt,
      rotatedAt: null,
      revokedAt: null,
      lastScannedAt: null,
    }));

    await service.generateQr('tenant-1', 'student-1', adminAuth);

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'QR_GENERATED',
        resource: 'student_qr',
        tenantId: 'tenant-1',
        userId: adminAuth.userId,
        after: expect.objectContaining({ studentId: 'student-1' }),
      }),
    );
    // Audit must NOT contain raw token
    const auditCall = auditService.record.mock.calls.find(
      (c: any) => c[0].action === 'QR_GENERATED',
    );
    expect(auditCall?.[0]?.after?.token).toBeUndefined();
    expect(auditCall?.[0]?.after?.rawToken).toBeUndefined();
    expect(auditCall?.[0]?.after?.tokenHash).toBeUndefined();
  });

  it('creates audit log for QR rotation', async () => {
    const { service, prisma, auditService } = createService();
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    prisma.studentQrCredential.findUnique.mockResolvedValue(baseCredential);
    prisma.studentQrCredential.update.mockImplementation(async ({ data }) => ({
      ...baseCredential,
      ...data,
      id: baseCredential.id,
    }));

    await service.rotateQr('tenant-1', 'student-1', adminAuth, 'Card lost by student');

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'QR_ROTATED',
        resource: 'student_qr',
        tenantId: 'tenant-1',
        userId: adminAuth.userId,
        after: expect.objectContaining({
          studentId: 'student-1',
          reason: 'Card lost by student',
        }),
      }),
    );
  });

  it('creates audit log for QR revocation', async () => {
    const { service, prisma, auditService } = createService();
    prisma.studentQrCredential.findUnique.mockResolvedValue(baseCredential);
    prisma.studentQrCredential.update.mockResolvedValue({
      ...baseCredential,
      status: StudentQrStatus.REVOKED,
      revokedAt: new Date(),
    });

    await service.revokeQr('tenant-1', 'student-1', adminAuth, 'Disciplinary action');

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'QR_REVOKED',
        resource: 'student_qr',
        tenantId: 'tenant-1',
        userId: adminAuth.userId,
        after: expect.objectContaining({
          studentId: 'student-1',
          reason: 'Disciplinary action',
        }),
      }),
    );
  });

  it('creates audit log for QR resolve/scan', async () => {
    const { service, prisma, auditService } = createService();
    prisma.studentQrCredential.findUnique.mockResolvedValue({
      ...baseCredential,
      student: activeStudent,
    });
    prisma.studentQrCredential.update.mockResolvedValue(baseCredential);

    await service.resolveQr(
      'tenant-1',
      'qr-token',
      StudentQrResolvePurpose.GENERAL_STUDENT_LOOKUP,
      adminAuth,
    );

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'QR_RESOLVED',
        resource: 'student_qr',
        tenantId: 'tenant-1',
        userId: adminAuth.userId,
        after: expect.objectContaining({
          studentId: 'student-1',
          purpose: StudentQrResolvePurpose.GENERAL_STUDENT_LOOKUP,
        }),
      }),
    );
  });

  it('audits failed cross-tenant resolve attempts', async () => {
    const { service, prisma, auditService } = createService();
    prisma.studentQrCredential.findUnique.mockResolvedValue({
      ...baseCredential,
      tenantId: 'tenant-2',
      student: activeStudent,
    });

    await expect(
      service.resolveQr(
        'tenant-1',
        'qr-token',
        StudentQrResolvePurpose.GENERAL_STUDENT_LOOKUP,
        adminAuth,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'QR_RESOLVE_FAILED',
        resource: 'student_qr',
        tenantId: 'tenant-1',
        after: expect.objectContaining({
          reason: 'wrong_tenant',
        }),
      }),
    );
  });

  // --- Cross-tenant generate/revoke ---

  it('cannot generate QR for student in another tenant', async () => {
    const { service, prisma } = createService();
    prisma.student.findFirst.mockResolvedValue(null); // No active student found in tenant

    await expect(
      service.generateQr('tenant-1', 'student-in-tenant-2', adminAuth),
    ).rejects.toThrow('Active student not found');
  });

  // --- Rotate invalidation ---

  it('rotate replaces the old token hash (previous QR becomes invalid)', async () => {
    const { service, prisma } = createService();
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    prisma.studentQrCredential.findUnique.mockResolvedValue(baseCredential);

    const oldTokenHash = baseCredential.tokenHash;

    prisma.studentQrCredential.update.mockImplementation(async ({ data }) => ({
      ...baseCredential,
      ...data,
      id: baseCredential.id,
    }));

    const result = await service.rotateQr(
      'tenant-1',
      'student-1',
      adminAuth,
      'Card lost',
    );

    const updateCall = prisma.studentQrCredential.update.mock.calls[0][0];
    expect(updateCall.data.tokenHash).toBeDefined();
    expect(updateCall.data.tokenHash).not.toBe(oldTokenHash);
    expect(updateCall.data.status).toBe(StudentQrStatus.ACTIVE);
    expect(result.qrImageAvailable).toBe(true);
    expect(result.qrImageSvg).toContain('<svg');
  });

  // --- Permission denied ---

  it('denies QR resolve for users without purpose-matching permission', async () => {
    const { service } = createService();

    await expect(
      service.resolveQr(
        'tenant-1',
        'qr-token',
        StudentQrResolvePurpose.LIBRARY,
        {
          ...adminAuth,
          permissions: ['students:qr:resolve'], // Has resolve but not any library permission
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('library response does not leak guardian phone or health data', async () => {
    const { service, prisma } = createService();
    prisma.studentQrCredential.findUnique.mockResolvedValue({
      ...baseCredential,
      student: activeStudent,
    });
    prisma.studentQrCredential.update.mockResolvedValue(baseCredential);
    prisma.libraryIssue.count.mockResolvedValue(2);

    const result = await service.resolveQr(
      'tenant-1',
      'qr-token',
      StudentQrResolvePurpose.LIBRARY,
      {
        ...adminAuth,
        permissions: ['students:qr:resolve', 'library:issues:create'],
      },
    );

    expect(result).toMatchObject({
      studentId: 'student-1',
      purpose: StudentQrResolvePurpose.LIBRARY,
      activeIssues: 2,
      canBorrow: true,
    });
    expect(result).not.toHaveProperty('guardianLinks');
    expect(result).not.toHaveProperty('emergencyPhone');
    expect(result).not.toHaveProperty('medicalConditions');
    expect(result).not.toHaveProperty('severeAllergies');
    expect(result).not.toHaveProperty('walletBalance');
  });

  it('updates lastScannedAt on successful resolve', async () => {
    const { service, prisma } = createService();
    prisma.studentQrCredential.findUnique.mockResolvedValue({
      ...baseCredential,
      student: activeStudent,
    });
    prisma.studentQrCredential.update.mockResolvedValue(baseCredential);

    await service.resolveQr(
      'tenant-1',
      'qr-token',
      StudentQrResolvePurpose.GENERAL_STUDENT_LOOKUP,
      adminAuth,
    );

    expect(prisma.studentQrCredential.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: baseCredential.id },
        data: { lastScannedAt: expect.any(Date) },
      }),
    );
  });
});
