import {
  BadRequestException,
  ForbiddenException,
  Injectable,
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
import QRCode from 'qrcode';
import { StudentQrResolvePurpose } from '@schoolos/core';
import { AuditService } from '../audit/audit.service';
import { AuthContext } from '../auth/auth.types';
import { hashToken, hmacToken } from '../auth/auth.utils';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '../config/config.service';

interface QrCredentialRecord {
  id: string;
  tenantId: string;
  studentId: string;
  tokenHash: string;
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
}

export interface PrintableQrResult {
  credential: SafeQrCredential;
  qrImageSvg?: string;
  qrImageAvailable: boolean;
  qrImageMessage?: string;
  rawToken?: string;
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
  ) {}

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
  ): Promise<PrintableQrResult> {
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
        qrImageAvailable: false,
        qrImageMessage:
          'An active QR credential already exists. Rotate the QR if a new printable image is required.',
      };
    }

    const issued = await this.issueCredential(tenantId, studentId, auth.userId);

    await this.auditService.record({
      action: 'QR_GENERATED',
      resource: 'student_qr',
      tenantId,
      userId: auth.userId,
      resourceId: issued.credential.id,
      after: { studentId },
    });

    return {
      credential: this.sanitizeCredential(issued.credential),
      qrImageSvg: await this.getQrImage(issued.rawToken),
      qrImageAvailable: true,
      rawToken: issued.rawToken,
    };
  }

  async rotateQr(
    tenantId: string,
    studentId: string,
    auth: AuthContext,
    reason?: string,
  ): Promise<PrintableQrResult> {
    if (!reason?.trim()) {
      throw new BadRequestException(
        'A reason is required to rotate a student QR',
      );
    }

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
      await tx.studentQrCredential.update({
        where: { id: existing.id },
        data: {
          status: StudentQrStatus.ROTATED,
          rotatedAt,
          updatedById: auth.userId,
          rotateReason: reason.trim(),
        },
      });

      return this.issueCredential(tenantId, studentId, auth.userId, tx);
    });

    await this.auditService.record({
      action: 'QR_ROTATED',
      resource: 'student_qr',
      tenantId,
      userId: auth.userId,
      resourceId: issued.credential.id,
      before: {
        status: existing.status,
        rotatedAt: existing.rotatedAt,
        revokedAt: existing.revokedAt,
      },
      after: { studentId, reason: reason.trim() },
    });

    return {
      credential: this.sanitizeCredential(issued.credential),
      qrImageSvg: await this.getQrImage(issued.rawToken),
      qrImageAvailable: true,
      rawToken: issued.rawToken,
    };
  }

  async revokeQr(
    tenantId: string,
    studentId: string,
    auth: AuthContext,
    reason?: string,
  ) {
    if (!reason?.trim()) {
      throw new BadRequestException(
        'A reason is required to revoke a student QR',
      );
    }

    const existing = await this.prisma.studentQrCredential.findFirst({
      where: { tenantId, studentId, status: StudentQrStatus.ACTIVE },
      orderBy: { createdAt: 'desc' },
    });

    if (existing?.tenantId !== tenantId) {
      throw new NotFoundException('QR credential not found');
    }

    const credential = await this.prisma.studentQrCredential.update({
      where: { id: existing.id },
      data: {
        status: StudentQrStatus.REVOKED,
        revokedAt: new Date(),
        updatedById: auth.userId,
        revokeReason: reason.trim(),
      },
    });

    await this.auditService.record({
      action: 'QR_REVOKED',
      resource: 'student_qr',
      tenantId,
      userId: auth.userId,
      resourceId: credential.id,
      before: {
        status: existing.status,
        rotatedAt: existing.rotatedAt,
        revokedAt: existing.revokedAt,
      },
      after: { studentId, reason: reason.trim() },
    });

    return this.sanitizeCredential(credential);
  }

  async getQrStatus(
    tenantId: string,
    studentId: string,
  ): Promise<StudentQrStatusHistory> {
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
      photoUrl: student.photoUrl ?? null,
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

  async getQrImage(token: string) {
    return QRCode.toString(token, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 128,
    });
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
