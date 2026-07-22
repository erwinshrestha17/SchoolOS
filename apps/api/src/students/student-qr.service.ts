import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  LibraryIssueStatus,
  Prisma,
  StudentLifecycleStatus,
  StudentQrStatus,
  TransportEnrollmentStatus,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import {
  formatBsDateOnly,
  getNepalSchoolDay,
  NEPAL_TIME_ZONE,
  STUDENT_QR_REASON_MAX_LENGTH,
  STUDENT_QR_REASON_MIN_LENGTH,
  StudentQrResolvePurpose,
  type StudentQrWorkspaceSummary,
} from '@schoolos/core';
import { AuditService } from '../audit/audit.service';
import { AuthContext } from '../auth/auth.types';
import { hashToken, hmacToken } from '../auth/auth.utils';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '../config/config.service';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { buildIdCardPdf } from '../common/pdf/simple-pdf';

interface QrCredentialRecord {
  id: string;
  tenantId: string;
  studentId: string;
  tokenHash: string;
  fileAssetId: string | null;
  status: StudentQrStatus;
  createdById: string | null;
  updatedById: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  rotatedAt: Date | null;
  revokedAt: Date | null;
  rotateReason: string | null;
  revokeReason: string | null;
  lastScannedAt: Date | null;
}

export interface SafeQrCredential {
  id: string;
  studentId: string;
  status: StudentQrStatus;
  createdById: string | null;
  updatedById: string | null;
  expiresAt: string | null;
  createdAt: string;
  rotatedAt: string | null;
  revokedAt: string | null;
  rotateReason: string | null;
  revokeReason: string | null;
  lastScannedAt: string | null;
  fileAssetId: string | null;
}

export interface StudentCredentialArtifactResult {
  credential: SafeQrCredential;
  fileAssetId: string | null;
  fileName: string | null;
  fileAvailable: boolean;
  fileMessage?: string;
}

export interface StudentQrStatusHistory {
  activeCredential: SafeQrCredential | null;
  history: SafeQrCredential[];
}

const PURPOSE_PERMISSIONS: Record<StudentQrResolvePurpose, string[]> = {
  [StudentQrResolvePurpose.GENERAL_STUDENT_LOOKUP]: [
    'students:read',
    'students:qr:resolve_all',
  ],
  [StudentQrResolvePurpose.LIBRARY]: [
    'library:read',
    'library:issues:read',
    'library:issues:create',
    'students:qr:resolve_all',
  ],
  [StudentQrResolvePurpose.CANTEEN]: [
    'canteen:serving:read',
    'canteen:serving:create',
    'canteen:pos:create',
    'students:qr:resolve_all',
  ],
  [StudentQrResolvePurpose.TRANSPORT]: [
    'transport:read',
    'transport:operate',
    'transport:trips:read',
    'transport:trips:update',
    'students:qr:resolve_all',
  ],
  [StudentQrResolvePurpose.ATTENDANCE]: [
    'attendance:mark',
    'attendance:read',
    'attendance:manage_all',
    'students:qr:resolve_all',
  ],
};

@Injectable()
export class StudentQrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
    private readonly fileRegistryService: FileRegistryService,
  ) {}

  async getQrWorkspaceSummary(
    tenantId: string,
    now = new Date(),
  ): Promise<StudentQrWorkspaceSummary> {
    const day = getNepalSchoolDay(now);
    const [
      activeCredentials,
      replacementFilesNeeded,
      inactiveCredentials,
      successfulScansToday,
    ] = await Promise.all([
      this.prisma.studentQrCredential.count({
        where: { tenantId, status: StudentQrStatus.ACTIVE },
      }),
      this.prisma.studentQrCredential.count({
        where: {
          tenantId,
          status: StudentQrStatus.ACTIVE,
          fileAssetId: null,
        },
      }),
      this.prisma.studentQrCredential.count({
        where: {
          tenantId,
          status: { in: [StudentQrStatus.ROTATED, StudentQrStatus.REVOKED] },
        },
      }),
      this.prisma.auditLog.count({
        where: {
          tenantId,
          resource: 'student_qr',
          action: 'QR_RESOLVED',
          createdAt: {
            gte: day.startUtc,
            lt: day.endExclusiveUtc,
          },
        },
      }),
    ]);

    return {
      activeCredentials,
      replacementFilesNeeded,
      inactiveCredentials,
      successfulScansToday,
      period: {
        bsDate: formatBsDateOnly(day.bsDate, { preset: 'short' }),
        startUtc: day.startUtc.toISOString(),
        endExclusiveUtc: day.endExclusiveUtc.toISOString(),
        timeZone: NEPAL_TIME_ZONE,
      },
    };
  }

  /**
   * Generates a new QR credential for an active student when no active credential
   * exists. Raw tokens and token hashes are never returned from the API response.
   * The printable SVG is returned only in the same request that creates a new
   * credential, because the raw token is intentionally never persisted.
   */
  async generateQr(
    tenantId: string,
    studentId: string,
    auth: AuthContext,
  ): Promise<StudentCredentialArtifactResult> {
    await this.assertPersonaStudentScope(tenantId, studentId, auth);
    await this.assertActiveStudent(tenantId, studentId);

    const existing = await this.prisma.studentQrCredential.findFirst({
      where: { tenantId, studentId, status: StudentQrStatus.ACTIVE },
      orderBy: { createdAt: 'desc' },
    });

    if (existing?.status === StudentQrStatus.ACTIVE) {
      await this.auditService.record({
        action: 'QR_GENERATE_SKIPPED_EXISTING_ACTIVE',
        resource: 'student_qr',
        tenantId,
        userId: auth.userId,
        resourceId: existing.id,
        after: { studentId },
      });

      return {
        credential: this.sanitizeCredential(existing),
        fileAssetId: existing.fileAssetId ?? null,
        fileName: existing.fileAssetId
          ? this.artifactFileName(studentId)
          : null,
        fileAvailable: Boolean(existing.fileAssetId),
        fileMessage: existing.fileAssetId
          ? undefined
          : 'The protected credential artifact is unavailable. Rotate the credential to generate a replacement.',
      };
    }

    let issued: Awaited<ReturnType<StudentQrService['issueCredential']>>;
    try {
      issued = await this.prisma.$transaction((tx) =>
        this.issueCredential(tenantId, studentId, auth.userId, tx),
      );
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        const active = await this.prisma.studentQrCredential.findFirst({
          where: { tenantId, studentId, status: StudentQrStatus.ACTIVE },
          orderBy: { createdAt: 'desc' },
        });
        if (active) {
          return {
            credential: this.sanitizeCredential(active),
            fileAssetId: active.fileAssetId ?? null,
            fileName: active.fileAssetId
              ? this.artifactFileName(studentId)
              : null,
            fileAvailable: Boolean(active.fileAssetId),
            fileMessage: active.fileAssetId
              ? undefined
              : 'Credential generation is already in progress.',
          };
        }
      }
      throw error;
    }

    const completed = await this.completeCredentialArtifact(
      tenantId,
      studentId,
      auth,
      issued,
    );

    await this.auditService.record({
      action: 'QR_GENERATED',
      resource: 'student_qr',
      tenantId,
      userId: auth.userId,
      resourceId: completed.credential.id,
      after: { studentId, fileAssetId: completed.fileAssetId },
    });

    return {
      credential: this.sanitizeCredential(completed.credential),
      fileAssetId: completed.fileAssetId,
      fileName: completed.fileName,
      fileAvailable: true,
    };
  }

  async rotateQr(
    tenantId: string,
    studentId: string,
    auth: AuthContext,
    reason?: string,
  ): Promise<StudentCredentialArtifactResult> {
    const normalizedReason = this.normalizeQrMutationReason(reason, 'rotate');

    await this.assertPersonaStudentScope(tenantId, studentId, auth);
    await this.assertActiveStudent(tenantId, studentId);

    const existing = await this.prisma.studentQrCredential.findFirst({
      where: { tenantId, studentId, status: StudentQrStatus.ACTIVE },
      orderBy: { createdAt: 'desc' },
    });

    if (!existing) {
      throw new NotFoundException('QR credential not found');
    }

    const rotatedAt = new Date();
    const issued = await this.prisma.$transaction(async (tx) => {
      const invalidated = await tx.studentQrCredential.updateMany({
        where: {
          id: existing.id,
          tenantId,
          studentId,
          status: StudentQrStatus.ACTIVE,
        },
        data: {
          status: StudentQrStatus.ROTATED,
          rotatedAt,
          updatedById: auth.userId,
          rotateReason: normalizedReason,
        },
      });

      if (invalidated.count !== 1) {
        throw new ConflictException(
          'The QR credential changed before rotation completed. Refresh and try again.',
        );
      }

      return this.issueCredential(tenantId, studentId, auth.userId, tx);
    });

    const completed = await this.completeCredentialArtifact(
      tenantId,
      studentId,
      auth,
      issued,
    );

    if (existing.fileAssetId) {
      await this.fileRegistryService.softDeleteFile(
        tenantId,
        existing.fileAssetId,
        auth.userId,
      );
    }

    await this.auditService.record({
      action: 'QR_ROTATED',
      resource: 'student_qr',
      tenantId,
      userId: auth.userId,
      resourceId: completed.credential.id,
      before: {
        status: existing.status,
        rotatedAt: existing.rotatedAt,
        revokedAt: existing.revokedAt,
      },
      after: {
        studentId,
        reason: normalizedReason,
        fileAssetId: completed.fileAssetId,
      },
    });

    return {
      credential: this.sanitizeCredential(completed.credential),
      fileAssetId: completed.fileAssetId,
      fileName: completed.fileName,
      fileAvailable: true,
    };
  }

  async revokeQr(
    tenantId: string,
    studentId: string,
    auth: AuthContext,
    reason?: string,
  ) {
    const normalizedReason = this.normalizeQrMutationReason(reason, 'revoke');

    await this.assertPersonaStudentScope(tenantId, studentId, auth);

    const existing = await this.prisma.studentQrCredential.findFirst({
      where: { tenantId, studentId, status: StudentQrStatus.ACTIVE },
      orderBy: { createdAt: 'desc' },
    });

    if (existing?.tenantId !== tenantId) {
      throw new NotFoundException('QR credential not found');
    }

    const revokedAt = new Date();
    const credential = await this.prisma.$transaction(async (tx) => {
      const revoked = await tx.studentQrCredential.updateMany({
        where: {
          id: existing.id,
          tenantId,
          studentId,
          status: StudentQrStatus.ACTIVE,
        },
        data: {
          status: StudentQrStatus.REVOKED,
          revokedAt,
          updatedById: auth.userId,
          revokeReason: normalizedReason,
        },
      });

      if (revoked.count !== 1) {
        throw new ConflictException(
          'The QR credential changed before revocation completed. Refresh and try again.',
        );
      }

      const revokedCredential: QrCredentialRecord = {
        ...existing,
        status: StudentQrStatus.REVOKED,
        revokedAt,
        updatedById: auth.userId,
        revokeReason: normalizedReason,
      };

      await this.auditService.record(
        {
          action: 'QR_REVOKED',
          resource: 'student_qr',
          tenantId,
          userId: auth.userId,
          resourceId: revokedCredential.id,
          before: {
            status: existing.status,
            rotatedAt: existing.rotatedAt,
            revokedAt: existing.revokedAt,
          },
          after: { studentId, reason: normalizedReason },
        },
        tx,
      );

      return revokedCredential;
    });

    if (existing.fileAssetId) {
      await this.fileRegistryService.softDeleteFile(
        tenantId,
        existing.fileAssetId,
        auth.userId,
      );
    }

    return this.sanitizeCredential(credential);
  }

  async getQrStatus(
    tenantId: string,
    studentId: string,
    auth: AuthContext,
  ): Promise<StudentQrStatusHistory> {
    await this.assertPersonaStudentScope(tenantId, studentId, auth);
    await this.assertTenantStudent(tenantId, studentId);

    const history = await this.prisma.studentQrCredential.findMany({
      where: { tenantId, studentId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    const active =
      history.find((item) => item.status === StudentQrStatus.ACTIVE) ?? null;

    return {
      activeCredential: active ? this.sanitizeCredential(active) : null,
      history: history.map((item) => this.sanitizeCredential(item)),
    };
  }

  async getQrScanHistory(
    tenantId: string,
    studentId: string,
    _actor: AuthContext,
  ) {
    await this.assertPersonaStudentScope(tenantId, studentId, _actor);
    await this.assertTenantStudent(tenantId, studentId);

    const credentials = await this.prisma.studentQrCredential.findMany({
      where: { tenantId, studentId },
    });
    const credentialIds = credentials.map((c) => c.id);

    const audits = await this.prisma.auditLog.findMany({
      where: {
        tenantId,
        resource: 'student_qr',
        resourceId: { in: credentialIds },
        action: {
          in: [
            'QR_GENERATED',
            'QR_ROTATED',
            'QR_REVOKED',
            'QR_RESOLVED',
            'QR_RESOLVE_FAILED',
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const userIds = audits
      .map((a) => a.userId)
      .filter((id): id is string => Boolean(id));

    const users =
      userIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, email: true },
          })
        : [];
    const userMap = new Map(users.map((u) => [u.id, u.email]));

    return audits.map((a) => {
      const details =
        a.after && typeof a.after === 'object' && !Array.isArray(a.after)
          ? (a.after as Record<string, unknown>)
          : {};
      return {
        id: a.id,
        action: a.action,
        scannedBy: a.userId,
        scannedByEmail: a.userId ? (userMap.get(a.userId) ?? null) : null,
        performedBy: a.userId,
        performedByEmail: a.userId ? (userMap.get(a.userId) ?? null) : null,
        purpose: (details.purpose as string | undefined) ?? null,
        success:
          a.action === 'QR_RESOLVED' ||
          a.action === 'QR_GENERATED' ||
          a.action === 'QR_ROTATED' ||
          a.action === 'QR_REVOKED'
            ? true
            : a.action === 'QR_RESOLVE_FAILED'
              ? false
              : ((details.success as boolean | undefined) ?? null),
        failureCode: (details.failureCode as string | undefined) ?? null,
        reason: (details.reason as string | undefined) ?? null,
        timestamp: a.createdAt.toISOString(),
      };
    });
  }

  async getQrAnalytics(
    tenantId: string,
    studentId: string,
    _actor: AuthContext,
  ) {
    await this.assertPersonaStudentScope(tenantId, studentId, _actor);
    await this.assertTenantStudent(tenantId, studentId);

    const credentials = await this.prisma.studentQrCredential.findMany({
      where: { tenantId, studentId },
      select: {
        id: true,
        status: true,
        createdAt: true,
        rotatedAt: true,
        revokedAt: true,
        lastScannedAt: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    const credentialIds = credentials.map((credential) => credential.id);

    const audits =
      credentialIds.length > 0
        ? await this.prisma.auditLog.findMany({
            where: {
              tenantId,
              resource: 'student_qr',
              resourceId: { in: credentialIds },
              action: {
                in: ['QR_RESOLVED', 'QR_RESOLVE_FAILED'],
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 1000,
          })
        : [];

    const byPurpose = new Map<
      string,
      { purpose: string; successfulScans: number; failedScans: number }
    >();
    const failuresByCode = new Map<string, number>();
    const daily = new Map<
      string,
      { date: string; successfulScans: number; failedScans: number }
    >();

    for (const audit of audits) {
      const details =
        audit.after &&
        typeof audit.after === 'object' &&
        !Array.isArray(audit.after)
          ? (audit.after as Record<string, unknown>)
          : {};
      const purpose =
        typeof details.purpose === 'string' ? details.purpose : 'UNKNOWN';
      const failureCode =
        typeof details.failureCode === 'string'
          ? details.failureCode
          : 'unknown';
      const date = audit.createdAt.toISOString().slice(0, 10);
      const success = audit.action === 'QR_RESOLVED';

      const purposeBucket = byPurpose.get(purpose) ?? {
        purpose,
        successfulScans: 0,
        failedScans: 0,
      };
      const dayBucket = daily.get(date) ?? {
        date,
        successfulScans: 0,
        failedScans: 0,
      };

      if (success) {
        purposeBucket.successfulScans += 1;
        dayBucket.successfulScans += 1;
      } else {
        purposeBucket.failedScans += 1;
        dayBucket.failedScans += 1;
        failuresByCode.set(
          failureCode,
          (failuresByCode.get(failureCode) ?? 0) + 1,
        );
      }

      byPurpose.set(purpose, purposeBucket);
      daily.set(date, dayBucket);
    }

    return {
      studentId,
      credentialCount: credentials.length,
      activeCredentialCount: credentials.filter(
        (credential) => credential.status === StudentQrStatus.ACTIVE,
      ).length,
      rotatedCredentialCount: credentials.filter(
        (credential) => credential.status === StudentQrStatus.ROTATED,
      ).length,
      revokedCredentialCount: credentials.filter(
        (credential) => credential.status === StudentQrStatus.REVOKED,
      ).length,
      firstIssuedAt:
        credentials.length > 0
          ? credentials[credentials.length - 1].createdAt.toISOString()
          : null,
      lastScannedAt:
        credentials
          .map((credential) => credential.lastScannedAt)
          .filter((value): value is Date => Boolean(value))
          .sort((a, b) => b.getTime() - a.getTime())[0]
          ?.toISOString() ?? null,
      successfulScans: audits.filter((audit) => audit.action === 'QR_RESOLVED')
        .length,
      failedScans: audits.filter(
        (audit) => audit.action === 'QR_RESOLVE_FAILED',
      ).length,
      scansByPurpose: [...byPurpose.values()].sort((a, b) =>
        a.purpose.localeCompare(b.purpose),
      ),
      failuresByCode: [...failuresByCode.entries()]
        .map(([failureCode, count]) => ({ failureCode, count }))
        .sort((a, b) => b.count - a.count),
      dailyScans: [...daily.values()].sort((a, b) =>
        a.date.localeCompare(b.date),
      ),
    };
  }

  async resolveQr(
    tenantId: string,
    token: string,
    purpose: StudentQrResolvePurpose,
    auth: AuthContext,
  ) {
    if (!this.canResolvePurpose(purpose, auth)) {
      await this.recordResolveDenied(
        tenantId,
        auth,
        null,
        purpose,
        'unauthorized_purpose',
      );
      throw new ForbiddenException(
        `You do not have permission to resolve QR scans for ${purpose}`,
      );
    }

    const tokenHashV2 = hmacToken(token, this.configService.tokenHashPepper);
    const tokenHashV1 = hashToken(token);
    const credential = await this.prisma.studentQrCredential.findFirst({
      where: {
        tenantId,
        tokenHash: { in: [tokenHashV2, tokenHashV1] },
      },
      include: {
        student: {
          include: {
            class: true,
            sectionRef: true,
            guardianLinks: {
              include: {
                guardian: true,
              },
            },
          },
        },
      },
    });

    const isExpired = Boolean(
      credential?.expiresAt && credential.expiresAt.getTime() <= Date.now(),
    );
    if (
      credential?.tenantId !== tenantId ||
      credential.status !== StudentQrStatus.ACTIVE ||
      credential.student.lifecycleStatus !== StudentLifecycleStatus.ACTIVE ||
      isExpired
    ) {
      let failureCode = 'expired';
      if (!credential) {
        failureCode = 'not_found';
      } else if (credential.tenantId !== tenantId) {
        failureCode = 'wrong_tenant';
      } else if (credential.status !== StudentQrStatus.ACTIVE) {
        failureCode =
          credential.status === StudentQrStatus.ROTATED ? 'rotated' : 'revoked';
      } else if (
        credential.student.lifecycleStatus !== StudentLifecycleStatus.ACTIVE
      ) {
        failureCode = 'inactive_student';
      }

      await this.auditService.record({
        action: 'QR_RESOLVE_FAILED',
        resource: 'student_qr',
        tenantId,
        userId: auth.userId,
        resourceId: credential?.id ?? null,
        after: {
          scannedBy: auth.userId,
          purpose,
          studentId: credential?.studentId ?? null,
          resolvedEntity: credential?.studentId ?? null,
          success: false,
          failureCode,
          reason: failureCode,
          timestamp: new Date().toISOString(),
        },
      });
      throw new ForbiddenException(
        isExpired ? 'QR token has expired' : 'Invalid or revoked QR token',
      );
    }

    const student = credential.student;

    if (!this.hasPermission(auth, 'students:qr:resolve_all')) {
      const isParent = auth.roles.includes('parent');
      const isTeacher = auth.roles.includes('teacher');

      if (isParent || isTeacher) {
        let parentAllowed = false;
        let teacherAllowed = false;

        if (isParent) {
          parentAllowed = student.guardianLinks.some(
            (link) => link.guardian.userId === auth.userId,
          );
        }

        if (isTeacher) {
          const isAssigned =
            await this.prisma.subjectTeacherAssignment.findFirst({
              where: {
                tenantId,
                staff: { userId: auth.userId },
                classId: student.classId,
                OR: [{ sectionId: student.sectionId }, { sectionId: null }],
              },
            });
          teacherAllowed = !!isAssigned;
        }

        const isAllowed =
          (isParent && parentAllowed) || (isTeacher && teacherAllowed);

        if (!isAllowed) {
          if (isParent && !parentAllowed) {
            await this.recordResolveDenied(
              tenantId,
              auth,
              student.id,
              purpose,
              'unrelated_parent',
            );
            throw new ForbiddenException(
              'Parent cannot resolve unrelated child',
            );
          } else {
            await this.recordResolveDenied(
              tenantId,
              auth,
              student.id,
              purpose,
              'unassigned_teacher',
            );
            throw new ForbiddenException(
              'Teacher not assigned to this student',
            );
          }
        }
      }
    }

    await this.prisma.studentQrCredential.update({
      where: { id: credential.id },
      data: { lastScannedAt: new Date() },
    });

    await this.auditService.record({
      action: 'QR_RESOLVED',
      resource: 'student_qr',
      tenantId,
      userId: auth.userId,
      resourceId: credential.id,
      after: {
        scannedBy: auth.userId,
        studentId: credential.studentId,
        resolvedEntity: credential.studentId,
        purpose,
        success: true,
        reason: 'resolved',
        timestamp: new Date().toISOString(),
      },
    });

    const baseResponse = {
      studentId: student.id,
      studentCode: student.studentSystemId,
      name: `${student.firstNameEn} ${student.lastNameEn}`.trim(),
      classSection: `${student.class.name}${
        student.sectionRef ? ` - ${student.sectionRef.name}` : ''
      }`,
      photoVersion: student.photoFileId ?? null,
      lifecycleStatus: student.lifecycleStatus,
      purpose,
    };

    switch (purpose) {
      case StudentQrResolvePurpose.LIBRARY: {
        const [activeIssues, overdueBooks] = await Promise.all([
          this.prisma.libraryIssue.count({
            where: {
              tenantId,
              borrowerStudentId: student.id,
              status: LibraryIssueStatus.ISSUED,
            },
          }),
          this.prisma.libraryIssue.count({
            where: {
              tenantId,
              borrowerStudentId: student.id,
              status: LibraryIssueStatus.ISSUED,
              dueAt: { lt: new Date() },
            },
          }),
        ]);

        return {
          ...baseResponse,
          activeIssues,
          overdueBooks,
          canBorrow: activeIssues < 5,
        };
      }
      case StudentQrResolvePurpose.CANTEEN: {
        const [wallet, control] = await Promise.all([
          this.prisma.canteenWallet.findUnique({
            where: { tenantId_studentId: { tenantId, studentId: student.id } },
          }),
          this.prisma.canteenSpendingControl.findUnique({
            where: {
              tenantId_studentId: { tenantId, studentId: student.id },
              isActive: true,
            },
          }),
        ]);

        const balance = wallet?.balance ?? new Prisma.Decimal(0);
        const threshold =
          wallet?.lowBalanceThreshold ?? new Prisma.Decimal(100);

        return {
          ...baseResponse,
          walletBalance: balance.toString(),
          walletStatus: balance.lte(0)
            ? 'INSUFFICIENT_FUNDS'
            : balance.lte(threshold)
              ? 'LOW_BALANCE'
              : 'ACTIVE',
          allergyWarnings: student.severeAllergies
            ? student.severeAllergies.split(',').map((item) => item.trim())
            : [],
          spendingWarnings: control?.blockedCategories.length
            ? `Blocked: ${control.blockedCategories.join(', ')}`
            : null,
          canPurchase: balance.gt(0),
        };
      }
      case StudentQrResolvePurpose.TRANSPORT: {
        const assignment =
          await this.prisma.transportStudentAssignment.findFirst({
            where: {
              tenantId,
              studentId: student.id,
              status: TransportEnrollmentStatus.ACTIVE,
            },
            include: {
              route: true,
              stop: true,
            },
          });

        return {
          ...baseResponse,
          hasActiveTransport: !!assignment,
          route: assignment?.route.name ?? null,
          stop: assignment?.stop.name ?? null,
        };
      }
      case StudentQrResolvePurpose.ATTENDANCE: {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const record = await this.prisma.attendanceRecord.findFirst({
          where: {
            tenantId,
            studentId: student.id,
            attendanceSession: {
              attendanceDate: {
                gte: today,
                lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
              },
            },
          },
        });

        return {
          ...baseResponse,
          attendanceToday: record?.status ?? 'NOT_MARKED',
          markedAt: record?.createdAt.toISOString() ?? null,
        };
      }
      case StudentQrResolvePurpose.GENERAL_STUDENT_LOOKUP:
      default:
        return baseResponse;
    }
  }

  private async assertActiveStudent(tenantId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        tenantId,
        lifecycleStatus: StudentLifecycleStatus.ACTIVE,
      },
      select: { id: true },
    });

    if (!student) {
      throw new NotFoundException(
        'Active student not found. QR can only be generated for active students.',
      );
    }
  }

  private async assertTenantStudent(tenantId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
      select: { id: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found in this tenant');
    }
  }

  private async assertPersonaStudentScope(
    tenantId: string,
    studentId: string,
    auth: AuthContext,
  ) {
    const isParent = auth.roles.includes('parent');
    const isTeacher =
      auth.roles.includes('teacher') || auth.roles.includes('subject_teacher');
    const isStudent = auth.roles.includes('student');

    if (!isParent && !isTeacher && !isStudent) return;

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
      select: {
        id: true,
        userId: true,
        classId: true,
        sectionId: true,
        guardianLinks: {
          select: { guardian: { select: { userId: true } } },
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found in this tenant');
    }

    if (isStudent && student.userId === auth.userId) return;
    if (
      isParent &&
      student.guardianLinks.some((link) => link.guardian.userId === auth.userId)
    ) {
      return;
    }
    if (isTeacher) {
      const assignment = await this.prisma.subjectTeacherAssignment.findFirst({
        where: {
          tenantId,
          staff: { userId: auth.userId },
          classId: student.classId,
          OR: [{ sectionId: student.sectionId }, { sectionId: null }],
        },
        select: { id: true },
      });
      if (assignment) return;
    }

    throw new ForbiddenException(
      'You do not have access to this student credential',
    );
  }

  private async issueCredential(
    tenantId: string,
    studentId: string,
    actorUserId: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = hmacToken(rawToken, this.configService.tokenHashPepper);

    const credential = await tx.studentQrCredential.create({
      data: {
        tenantId,
        studentId,
        tokenHash,
        status: StudentQrStatus.ACTIVE,
        createdById: actorUserId,
        updatedById: actorUserId,
      },
    });

    return { credential, rawToken };
  }

  private async completeCredentialArtifact(
    tenantId: string,
    studentId: string,
    auth: AuthContext,
    issued: Awaited<ReturnType<StudentQrService['issueCredential']>>,
  ) {
    let registeredFileAssetId: string | null = null;
    try {
      const student = await this.prisma.student.findFirst({
        where: {
          id: studentId,
          tenantId,
          lifecycleStatus: StudentLifecycleStatus.ACTIVE,
        },
        include: {
          tenant: { select: { name: true } },
          class: { select: { name: true } },
          sectionRef: { select: { name: true } },
          guardianLinks: {
            include: { guardian: true },
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
            take: 1,
          },
          enrollments: {
            include: { academicYear: true, section: true },
            orderBy: [{ createdAt: 'desc' }],
            take: 1,
          },
        },
      });

      if (!student) {
        throw new NotFoundException('Active student not found');
      }

      const enrollment = student.enrollments[0] ?? null;
      const guardian = student.guardianLinks[0]?.guardian ?? null;
      const fileName = this.artifactFileName(student.studentSystemId);
      const content = buildIdCardPdf({
        schoolName: student.tenant.name,
        studentName: `${student.firstNameEn} ${student.lastNameEn}`.trim(),
        studentId: student.studentSystemId,
        className: student.class.name,
        sectionName:
          enrollment?.section?.name ??
          student.sectionRef?.name ??
          student.section,
        rollNumber: student.rollNumber ?? enrollment?.rollNumber ?? null,
        bloodGroup: student.bloodGroup,
        guardianName: guardian?.fullName ?? null,
        guardianPhone: guardian?.primaryPhone ?? null,
        academicYear: enrollment?.academicYear?.name ?? null,
        qrToken: issued.rawToken,
      });

      const asset = await this.fileRegistryService.registerGeneratedFile({
        tenantId,
        generatedByUserId: auth.userId,
        originalFilename: fileName,
        content,
        mimeType: 'application/pdf',
        module: 'students',
        entityId: studentId,
        metadata: {
          kind: 'QR_ID_CARD',
          source: 'student_qr_credential',
          credentialId: issued.credential.id,
          studentId,
        },
      });
      registeredFileAssetId = asset.id;

      await this.prisma.studentQrCredential.update({
        where: { id: issued.credential.id },
        data: { fileAssetId: asset.id, updatedById: auth.userId },
      });

      return {
        credential: { ...issued.credential, fileAssetId: asset.id },
        fileAssetId: asset.id,
        fileName,
      };
    } catch {
      if (registeredFileAssetId) {
        try {
          await this.fileRegistryService.softDeleteFile(
            tenantId,
            registeredFileAssetId,
            auth.userId,
          );
        } catch {
          // Credential is revoked below even if artifact cleanup requires retry.
        }
      }
      await this.prisma.studentQrCredential.updateMany({
        where: {
          id: issued.credential.id,
          tenantId,
          studentId,
          status: StudentQrStatus.ACTIVE,
        },
        data: {
          status: StudentQrStatus.REVOKED,
          revokedAt: new Date(),
          updatedById: auth.userId,
          revokeReason: 'Credential artifact generation failed',
        },
      });
      await this.auditService.record({
        action: 'QR_ARTIFACT_GENERATION_FAILED',
        resource: 'student_qr',
        tenantId,
        userId: auth.userId,
        resourceId: issued.credential.id,
        after: { studentId, failureCode: 'artifact_generation_failed' },
      });
      throw new InternalServerErrorException(
        'The protected credential artifact could not be generated. No active credential was issued.',
      );
    }
  }

  private normalizeQrMutationReason(
    reason: string | undefined,
    action: 'rotate' | 'revoke',
  ) {
    const normalized = reason?.trim() ?? '';
    if (
      normalized.length < STUDENT_QR_REASON_MIN_LENGTH ||
      normalized.length > STUDENT_QR_REASON_MAX_LENGTH
    ) {
      throw new BadRequestException(
        `A reason between ${STUDENT_QR_REASON_MIN_LENGTH} and ${STUDENT_QR_REASON_MAX_LENGTH} characters is required to ${action} a student QR credential.`,
      );
    }
    return normalized;
  }

  private artifactFileName(studentReference: string) {
    const safeReference = studentReference.replace(/[^a-zA-Z0-9_-]/g, '-');
    return `${safeReference}-student-id-card.pdf`;
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private sanitizeCredential(credential: QrCredentialRecord): SafeQrCredential {
    return {
      id: credential.id,
      studentId: credential.studentId,
      status: credential.status,
      createdById: credential.createdById ?? null,
      updatedById: credential.updatedById ?? null,
      expiresAt: credential.expiresAt?.toISOString() ?? null,
      createdAt: credential.createdAt.toISOString(),
      rotatedAt: credential.rotatedAt?.toISOString() ?? null,
      revokedAt: credential.revokedAt?.toISOString() ?? null,
      rotateReason: credential.rotateReason ?? null,
      revokeReason: credential.revokeReason ?? null,
      lastScannedAt: credential.lastScannedAt?.toISOString() ?? null,
      fileAssetId: credential.fileAssetId ?? null,
    };
  }

  private canResolvePurpose(
    purpose: StudentQrResolvePurpose,
    auth: AuthContext,
  ) {
    const allowedPermissions = PURPOSE_PERMISSIONS[purpose];
    return allowedPermissions.some((permission) =>
      this.hasPermission(auth, permission),
    );
  }

  private hasPermission(auth: AuthContext, permission: string) {
    return auth.permissions.includes(permission);
  }

  private recordResolveDenied(
    tenantId: string,
    auth: AuthContext,
    studentId: string | null,
    purpose: StudentQrResolvePurpose,
    reason: string,
  ) {
    return this.auditService.record({
      action: 'QR_RESOLVE_FAILED',
      resource: 'student_qr',
      tenantId,
      userId: auth.userId,
      after: {
        scannedBy: auth.userId,
        studentId,
        resolvedEntity: studentId,
        purpose,
        success: false,
        failureCode: reason,
        reason,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
