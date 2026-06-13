import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  StudentLifecycleStatus,
  StudentQrStatus,
} from '@prisma/client';
import { StudentQrResolvePurpose } from '@schoolos/core';
import { hashToken, hmacToken } from '../auth/auth.utils';
import { StudentQrService } from './student-qr.service';

const issuedAt = new Date('2026-05-13T00:00:00.000Z');

function createService() {
  const prisma = {
    student: {
      findFirst: jest.fn(),
    },
    studentQrCredential: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(async (callback) => callback(prisma)),
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
    user: {
      findMany: jest.fn(),
    },
    auditLog: {
      findMany: jest.fn(),
    },
  };

  const auditService = {
    record: jest.fn(),
  };

  const configService = {
    tokenHashPepper: 'mock-pepper-for-tests-at-least-32-chars-long-12345',
  };

  const service = new StudentQrService(
    prisma as any,
    auditService as any,
    configService as any,
  );

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
  createdById: 'user-admin',
  updatedById: 'user-admin',
  expiresAt: null,
  createdAt: issuedAt,
  rotatedAt: null,
  revokedAt: null,
  rotateReason: null,
  revokeReason: null,
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
    prisma.studentQrCredential.findFirst.mockResolvedValue(null);
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
    expect(
      prisma.studentQrCredential.create.mock.calls[0][0].data,
    ).not.toHaveProperty('token');
    expect(
      prisma.studentQrCredential.create.mock.calls[0][0].data,
    ).not.toHaveProperty('rawToken');
    expect(result).toHaveProperty('rawToken');
    expect(result.rawToken).toBeDefined();
    expect(result.credential).not.toHaveProperty('tokenHash');
    expect(result.qrImageAvailable).toBe(true);
    expect(result.qrImageSvg).toContain('<svg');
  });

  it('does not expose a printable image for an already-active credential', async () => {
    const { service, prisma } = createService();
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    prisma.studentQrCredential.findFirst.mockResolvedValue(baseCredential);

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
    prisma.studentQrCredential.findFirst.mockResolvedValue({
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

  it('rotates by preserving old credential history and creating a new active credential transactionally', async () => {
    const { service, prisma, auditService } = createService();
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    prisma.studentQrCredential.findFirst.mockResolvedValue(baseCredential);
    prisma.studentQrCredential.update.mockResolvedValue({
      ...baseCredential,
      status: StudentQrStatus.ROTATED,
      rotatedAt: new Date('2026-05-13T01:00:00.000Z'),
      rotateReason: 'Lost printed card',
    });
    prisma.studentQrCredential.create.mockImplementation(async ({ data }) => ({
      ...baseCredential,
      ...data,
      id: 'qr-new',
      createdAt: new Date('2026-05-13T01:00:00.000Z'),
      rotatedAt: null,
      revokedAt: null,
      rotateReason: null,
      revokeReason: null,
      lastScannedAt: null,
    }));

    const result = await service.rotateQr(
      'tenant-1',
      'student-1',
      adminAuth,
      'Lost printed card',
    );

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.studentQrCredential.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'qr-1' },
        data: expect.objectContaining({
          status: StudentQrStatus.ROTATED,
          rotateReason: 'Lost printed card',
          updatedById: adminAuth.userId,
        }),
      }),
    );
    expect(prisma.studentQrCredential.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        studentId: 'student-1',
        status: StudentQrStatus.ACTIVE,
        createdById: adminAuth.userId,
        tokenHash: expect.any(String),
      }),
    });
    expect(result.credential.id).toBe('qr-new');
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'QR_ROTATED',
        resource: 'student_qr',
        after: expect.objectContaining({ reason: 'Lost printed card' }),
      }),
    );
  });

  it('returns safe QR status history without token hashes', async () => {
    const { service, prisma } = createService();
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    prisma.studentQrCredential.findMany.mockResolvedValue([
      baseCredential,
      {
        ...baseCredential,
        id: 'qr-old',
        status: StudentQrStatus.ROTATED,
        rotatedAt: new Date('2026-05-13T01:00:00.000Z'),
        rotateReason: 'Lost printed card',
      },
    ]);

    const result = await service.getQrStatus('tenant-1', 'student-1');

    expect(result.activeCredential?.id).toBe('qr-1');
    expect(result.history).toHaveLength(2);
    expect(result.history[0]).not.toHaveProperty('tokenHash');
  });

  it('summarizes QR operational analytics from tenant-scoped audit logs', async () => {
    const { service, prisma } = createService();
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    prisma.studentQrCredential.findMany.mockResolvedValue([
      {
        ...baseCredential,
        lastScannedAt: new Date('2026-05-13T02:00:00.000Z'),
      },
      {
        ...baseCredential,
        id: 'qr-old',
        status: StudentQrStatus.REVOKED,
        createdAt: new Date('2026-05-12T00:00:00.000Z'),
      },
    ]);
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'audit-1',
        action: 'QR_RESOLVED',
        userId: 'user-admin',
        after: { purpose: StudentQrResolvePurpose.ATTENDANCE },
        createdAt: new Date('2026-05-13T02:00:00.000Z'),
      },
      {
        id: 'audit-2',
        action: 'QR_RESOLVE_FAILED',
        userId: 'user-admin',
        after: {
          purpose: StudentQrResolvePurpose.ATTENDANCE,
          failureCode: 'revoked',
        },
        createdAt: new Date('2026-05-13T03:00:00.000Z'),
      },
    ]);

    const result = await service.getQrAnalytics(
      'tenant-1',
      'student-1',
      adminAuth,
    );

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          resource: 'student_qr',
          resourceId: { in: ['qr-1', 'qr-old'] },
        }),
      }),
    );
    expect(result).toMatchObject({
      studentId: 'student-1',
      credentialCount: 2,
      activeCredentialCount: 1,
      revokedCredentialCount: 1,
      successfulScans: 1,
      failedScans: 1,
      failuresByCode: [{ failureCode: 'revoked', count: 1 }],
    });
    expect(result).not.toHaveProperty('tokenHash');
  });

  it('keeps QR scans tenant-scoped', async () => {
    const { service, prisma } = createService();
    prisma.studentQrCredential.findFirst.mockResolvedValue(null);

    await expect(
      service.resolveQr(
        'tenant-1',
        'qr-token',
        StudentQrResolvePurpose.GENERAL_STUDENT_LOOKUP,
        adminAuth,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.studentQrCredential.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-1',
          tokenHash: {
            in: [
              hmacToken(
                'qr-token',
                'mock-pepper-for-tests-at-least-32-chars-long-12345',
              ),
              hashToken('qr-token'),
            ],
          },
        },
      }),
    );
    expect(prisma.studentQrCredential.update).not.toHaveBeenCalled();
  });

  it('limits canteen response shape to purpose-specific safe fields', async () => {
    const { service, prisma } = createService();
    prisma.studentQrCredential.findFirst.mockResolvedValue({
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
    prisma.studentQrCredential.findFirst.mockResolvedValue({
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
    prisma.studentQrCredential.findFirst.mockResolvedValue({
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
    prisma.studentQrCredential.findFirst.mockResolvedValue(null);
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
    prisma.studentQrCredential.findFirst.mockResolvedValue(baseCredential);
    prisma.studentQrCredential.update.mockImplementation(async ({ data }) => ({
      ...baseCredential,
      ...data,
      id: baseCredential.id,
    }));
    prisma.studentQrCredential.create.mockImplementation(async ({ data }) => ({
      ...baseCredential,
      ...data,
      id: 'qr-rotated-new',
      createdAt: new Date('2026-05-13T01:00:00.000Z'),
      rotatedAt: null,
      revokedAt: null,
      rotateReason: null,
      revokeReason: null,
      lastScannedAt: null,
    }));

    await service.rotateQr(
      'tenant-1',
      'student-1',
      adminAuth,
      'Card lost by student',
    );

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
    prisma.studentQrCredential.findFirst.mockResolvedValue(baseCredential);
    prisma.studentQrCredential.update.mockResolvedValue({
      ...baseCredential,
      status: StudentQrStatus.REVOKED,
      revokedAt: new Date(),
      revokeReason: 'Disciplinary action',
    });

    await service.revokeQr(
      'tenant-1',
      'student-1',
      adminAuth,
      'Disciplinary action',
    );

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
    prisma.studentQrCredential.findFirst.mockResolvedValue({
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

  it('returns complete QR status/scan log including generation, rotation, and revocation events', async () => {
    const { service, prisma } = createService();
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    prisma.studentQrCredential.findMany.mockResolvedValue([baseCredential]);
    prisma.user.findMany.mockResolvedValue([
      { id: adminAuth.userId, email: adminAuth.email },
    ]);
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'audit-1',
        action: 'QR_GENERATED',
        resource: 'student_qr',
        resourceId: 'qr-1',
        tenantId: 'tenant-1',
        userId: adminAuth.userId,
        createdAt: new Date('2026-05-12T00:00:00.000Z'),
        after: { studentId: 'student-1' },
      },
      {
        id: 'audit-2',
        action: 'QR_ROTATED',
        resource: 'student_qr',
        resourceId: 'qr-1',
        tenantId: 'tenant-1',
        userId: adminAuth.userId,
        createdAt: new Date('2026-05-13T00:00:00.000Z'),
        after: { studentId: 'student-1', reason: 'Lost printed card' },
      },
      {
        id: 'audit-3',
        action: 'QR_RESOLVED',
        resource: 'student_qr',
        resourceId: 'qr-1',
        tenantId: 'tenant-1',
        userId: adminAuth.userId,
        createdAt: new Date('2026-05-14T00:00:00.000Z'),
        after: {
          studentId: 'student-1',
          purpose: StudentQrResolvePurpose.GENERAL_STUDENT_LOOKUP,
        },
      },
    ]);

    const result = await service.getQrScanHistory(
      'tenant-1',
      'student-1',
      adminAuth,
    );

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(
      expect.objectContaining({
        action: 'QR_GENERATED',
        performedBy: adminAuth.userId,
        performedByEmail: adminAuth.email,
        success: true,
      }),
    );
    expect(result[1]).toEqual(
      expect.objectContaining({
        action: 'QR_ROTATED',
        reason: 'Lost printed card',
        success: true,
      }),
    );
    expect(result[2]).toEqual(
      expect.objectContaining({
        action: 'QR_RESOLVED',
        purpose: StudentQrResolvePurpose.GENERAL_STUDENT_LOOKUP,
        success: true,
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

  it('cannot return QR status history for a student outside the actor tenant', async () => {
    const { service, prisma } = createService();
    prisma.student.findFirst.mockResolvedValue(null);

    await expect(
      service.getQrStatus('tenant-1', 'student-in-tenant-2'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.student.findFirst).toHaveBeenCalledWith({
      where: { id: 'student-in-tenant-2', tenantId: 'tenant-1' },
      select: { id: true },
    });
    expect(prisma.studentQrCredential.findMany).not.toHaveBeenCalled();
  });

  it('cannot rotate a QR credential for a student outside the actor tenant', async () => {
    const { service, prisma } = createService();
    prisma.student.findFirst.mockResolvedValue(null);

    await expect(
      service.rotateQr(
        'tenant-1',
        'student-in-tenant-2',
        adminAuth,
        'Card lost',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.student.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'student-in-tenant-2',
        tenantId: 'tenant-1',
        lifecycleStatus: StudentLifecycleStatus.ACTIVE,
      },
      select: { id: true },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.studentQrCredential.update).not.toHaveBeenCalled();
    expect(prisma.studentQrCredential.create).not.toHaveBeenCalled();
  });

  it('cannot revoke a QR credential outside the actor tenant', async () => {
    const { service, prisma, auditService } = createService();
    prisma.studentQrCredential.findFirst.mockResolvedValue(null);

    await expect(
      service.revokeQr(
        'tenant-1',
        'student-in-tenant-2',
        adminAuth,
        'Card compromised',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.studentQrCredential.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        studentId: 'student-in-tenant-2',
        status: StudentQrStatus.ACTIVE,
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(prisma.studentQrCredential.update).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });

  // --- Rotate invalidation ---

  it('rotate replaces the old token hash (previous QR becomes invalid)', async () => {
    const { service, prisma } = createService();
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    prisma.studentQrCredential.findFirst.mockResolvedValue(baseCredential);

    const oldTokenHash = baseCredential.tokenHash;

    prisma.studentQrCredential.update.mockImplementation(async ({ data }) => ({
      ...baseCredential,
      ...data,
      id: baseCredential.id,
    }));
    prisma.studentQrCredential.create.mockImplementation(async ({ data }) => ({
      ...baseCredential,
      ...data,
      id: 'qr-new-after-rotate',
      createdAt: new Date('2026-05-13T01:00:00.000Z'),
      rotatedAt: null,
      revokedAt: null,
      rotateReason: null,
      revokeReason: null,
      lastScannedAt: null,
    }));

    const result = await service.rotateQr(
      'tenant-1',
      'student-1',
      adminAuth,
      'Card lost',
    );

    const updateCall = prisma.studentQrCredential.update.mock.calls[0][0];
    expect(updateCall.data.status).toBe(StudentQrStatus.ROTATED);
    expect(updateCall.data.tokenHash).toBeUndefined();
    const createCall = prisma.studentQrCredential.create.mock.calls[0][0];
    expect(createCall.data.tokenHash).toBeDefined();
    expect(createCall.data.tokenHash).not.toBe(oldTokenHash);
    expect(createCall.data.status).toBe(StudentQrStatus.ACTIVE);
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
    prisma.studentQrCredential.findFirst.mockResolvedValue({
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
    prisma.studentQrCredential.findFirst.mockResolvedValue({
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

  it('rejects rotated QR scans (rotated/revoked QR cannot resolve as active)', async () => {
    const { service, prisma } = createService();
    prisma.studentQrCredential.findFirst.mockResolvedValue({
      ...baseCredential,
      status: StudentQrStatus.ROTATED,
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

  it('rejects active QR scans for inactive students without updating scan metadata', async () => {
    const { service, prisma, auditService } = createService();
    prisma.studentQrCredential.findFirst.mockResolvedValue({
      ...baseCredential,
      student: {
        ...activeStudent,
        lifecycleStatus: StudentLifecycleStatus.ARCHIVED,
      },
    });

    await expect(
      service.resolveQr(
        'tenant-1',
        'qr-token',
        StudentQrResolvePurpose.GENERAL_STUDENT_LOOKUP,
        adminAuth,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.studentQrCredential.update).not.toHaveBeenCalled();
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'QR_RESOLVE_FAILED',
        after: expect.objectContaining({
          failureCode: 'inactive_student',
          studentId: 'student-1',
        }),
      }),
    );
  });

  it('allows multi-role parent and teacher users to resolve QR codes if they pass either ownership check', async () => {
    const { service, prisma } = createService();
    prisma.studentQrCredential.findFirst.mockResolvedValue({
      ...baseCredential,
      student: activeStudent,
    });
    prisma.studentQrCredential.update.mockResolvedValue(baseCredential);

    // Case A: User is parent of the child but not their teacher
    prisma.subjectTeacherAssignment.findFirst.mockResolvedValue(null);

    const resultParentOnly = await service.resolveQr(
      'tenant-1',
      'qr-token',
      StudentQrResolvePurpose.GENERAL_STUDENT_LOOKUP,
      {
        ...adminAuth,
        userId: 'guardian-user-1',
        roles: ['parent', 'teacher'],
        permissions: ['students:qr:resolve', 'students:read'],
      },
    );
    expect(resultParentOnly).toBeDefined();
    expect(resultParentOnly.studentId).toBe('student-1');

    // Case B: User is teacher of the child but not their parent
    prisma.subjectTeacherAssignment.findFirst.mockResolvedValue({
      id: 'assignment-1',
    });

    const resultTeacherOnly = await service.resolveQr(
      'tenant-1',
      'qr-token',
      StudentQrResolvePurpose.GENERAL_STUDENT_LOOKUP,
      {
        ...adminAuth,
        userId: 'teacher-user-1',
        roles: ['parent', 'teacher'],
        permissions: ['students:qr:resolve', 'students:read'],
      },
    );
    expect(resultTeacherOnly).toBeDefined();
    expect(resultTeacherOnly.studentId).toBe('student-1');

    // Case C: User is neither parent nor teacher of the child
    prisma.subjectTeacherAssignment.findFirst.mockResolvedValue(null);

    await expect(
      service.resolveQr(
        'tenant-1',
        'qr-token',
        StudentQrResolvePurpose.GENERAL_STUDENT_LOOKUP,
        {
          ...adminAuth,
          userId: 'other-user',
          roles: ['parent', 'teacher'],
          permissions: ['students:qr:resolve', 'students:read'],
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects expired QR scans', async () => {
    const { service, prisma, auditService } = createService();
    prisma.studentQrCredential.findFirst.mockResolvedValue({
      ...baseCredential,
      expiresAt: new Date(Date.now() - 10000), // 10 seconds ago
      student: activeStudent,
    });

    await expect(
      service.resolveQr(
        'tenant-1',
        'qr-token',
        StudentQrResolvePurpose.GENERAL_STUDENT_LOOKUP,
        adminAuth,
      ),
    ).rejects.toThrow('QR token has expired');

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'QR_RESOLVE_FAILED',
        after: expect.objectContaining({
          failureCode: 'expired',
        }),
      }),
    );
  });
});
