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
} from '@prisma/client';
import { randomBytes } from 'crypto';
import QRCode from 'qrcode';
import { StudentQrResolvePurpose } from '@schoolos/core';
import { AuditService } from '../audit/audit.service';
import { AuthContext } from '../auth/auth.types';
import { hashToken } from '../auth/auth.utils';
import { PrismaService } from '../prisma/prisma.service';

type QrCredentialRecord = {
  id: string;
  tenantId: string;
  studentId: string;
  tokenHash: string;
  status: StudentQrStatus;
  createdAt: Date;
  rotatedAt: Date | null;
  revokedAt: Date | null;
  lastScannedAt: Date | null;
};

type SafeQrCredential = {
  id: string;
  studentId: string;
  status: StudentQrStatus;
  createdAt: string;
  rotatedAt: string | null;
  revokedAt: string | null;
  lastScannedAt: string | null;
};

type PrintableQrResult = {
  credential: SafeQrCredential;
  qrImageSvg?: string;
  qrImageAvailable: boolean;
  qrImageMessage?: string;
};

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

    const existing = await this.prisma.studentQrCredential.findUnique({
      where: { tenantId_studentId: { tenantId, studentId } },
    });

    if (existing && existing.status === StudentQrStatus.ACTIVE) {
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

    const issued = await this.issueCredential(tenantId, studentId, existing?.id);

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
    };
  }

  async rotateQr(
    tenantId: string,
    studentId: string,
    auth: AuthContext,
    reason?: string,
  ): Promise<PrintableQrResult> {
    if (!reason?.trim()) {
      throw new BadRequestException('A reason is required to rotate a student QR');
    }

    await this.assertActiveStudent(tenantId, studentId);

    const existing = await this.prisma.studentQrCredential.findUnique({
      where: { tenantId_studentId: { tenantId, studentId } },
    });

    if (!existing) {
      throw new NotFoundException('QR credential not found');
    }

    const issued = await this.issueCredential(tenantId, studentId, existing.id, {
      rotatedAt: new Date(),
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
    };
  }

  async revokeQr(
    tenantId: string,
    studentId: string,
    auth: AuthContext,
    reason?: string,
  ) {
    if (!reason?.trim()) {
      throw new BadRequestException('A reason is required to revoke a student QR');
    }

    const existing = await this.prisma.studentQrCredential.findUnique({
      where: { tenantId_studentId: { tenantId, studentId } },
    });

    if (!existing || existing.tenantId !== tenantId) {
      throw new NotFoundException('QR credential not found');
    }

    const credential = await this.prisma.studentQrCredential.update({
      where: { id: existing.id },
      data: {
        status: StudentQrStatus.REVOKED,
        revokedAt: new Date(),
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

  async resolveQr(
    tenantId: string,
    token: string,
    purpose: StudentQrResolvePurpose,
    auth: AuthContext,
  ) {
    this.assertPurposeAccess(purpose, auth);

    const tokenHash = hashToken(token);
    const credential = await this.prisma.studentQrCredential.findUnique({
      where: { tokenHash },
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

    if (
      !credential ||
      credential.tenantId !== tenantId ||
      credential.status !== StudentQrStatus.ACTIVE ||
      credential.student.lifecycleStatus !== StudentLifecycleStatus.ACTIVE
    ) {
      await this.auditService.record({
        action: 'QR_RESOLVE_FAILED',
        resource: 'student_qr',
        tenantId,
        userId: auth.userId,
        after: {
          purpose,
          reason: !credential
            ? 'not_found'
            : credential.tenantId !== tenantId
              ? 'wrong_tenant'
              : credential.status !== StudentQrStatus.ACTIVE
                ? 'revoked'
                : 'inactive_student',
        },
      });
      throw new ForbiddenException('Invalid or revoked QR token');
    }

    const student = credential.student;

    if (auth.roles.includes('parent')) {
      const isLinked = student.guardianLinks.some(
        (link) => link.guardian.userId === auth.userId,
      );
      if (!isLinked) {
        await this.recordResolveDenied(
          tenantId,
          auth,
          student.id,
          purpose,
          'unrelated_parent',
        );
        throw new ForbiddenException('Parent cannot resolve unrelated child');
      }
    }

    if (
      auth.roles.includes('teacher') &&
      !this.hasPermission(auth, 'students:qr:resolve_all')
    ) {
      const isAssigned = await this.prisma.subjectTeacherAssignment.findFirst({
        where: {
          tenantId,
          staff: { userId: auth.userId },
          classId: student.classId,
          OR: [{ sectionId: student.sectionId }, { sectionId: null }],
        },
      });

      if (!isAssigned) {
        await this.recordResolveDenied(
          tenantId,
          auth,
          student.id,
          purpose,
          'unassigned_teacher',
        );
        throw new ForbiddenException('Teacher not assigned to this student');
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
      after: { studentId: credential.studentId, purpose },
    });

    const baseResponse = {
      studentId: student.id,
      studentCode: student.studentSystemId,
      name: `${student.firstNameEn} ${student.lastNameEn}`.trim(),
      classSection: `${student.class.name}${
        student.sectionRef ? ` - ${student.sectionRef.name}` : ''
      }`,
      photoUrl: student.photoUrl || null,
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
        const wallet = await this.prisma.canteenWallet.findUnique({
          where: { tenantId_studentId: { tenantId, studentId: student.id } },
        });

        return {
          ...baseResponse,
          walletBalance: wallet?.balance?.toString() ?? '0.00',
          allergyWarnings: student.severeAllergies
            ? student.severeAllergies.split(',').map((item) => item.trim())
            : [],
          canPurchase: (wallet?.balance ?? new Prisma.Decimal(0)).gt(0),
        };
      }
      case StudentQrResolvePurpose.TRANSPORT:
      case StudentQrResolvePurpose.ATTENDANCE:
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

  private async issueCredential(
    tenantId: string,
    studentId: string,
    existingId?: string,
    extra?: { rotatedAt?: Date },
  ) {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);

    const credential = existingId
      ? await this.prisma.studentQrCredential.update({
          where: { id: existingId },
          data: {
            tokenHash,
            status: StudentQrStatus.ACTIVE,
            revokedAt: null,
            rotatedAt: extra?.rotatedAt ?? null,
          },
        })
      : await this.prisma.studentQrCredential.create({
          data: {
            tenantId,
            studentId,
            tokenHash,
            status: StudentQrStatus.ACTIVE,
          },
        });

    return { credential, rawToken };
  }

  private sanitizeCredential(credential: QrCredentialRecord): SafeQrCredential {
    return {
      id: credential.id,
      studentId: credential.studentId,
      status: credential.status,
      createdAt: credential.createdAt.toISOString(),
      rotatedAt: credential.rotatedAt?.toISOString() ?? null,
      revokedAt: credential.revokedAt?.toISOString() ?? null,
      lastScannedAt: credential.lastScannedAt?.toISOString() ?? null,
    };
  }

  private assertPurposeAccess(
    purpose: StudentQrResolvePurpose,
    auth: AuthContext,
  ) {
    const allowedPermissions = PURPOSE_PERMISSIONS[purpose] ?? [];
    const allowed = allowedPermissions.some((permission) =>
      this.hasPermission(auth, permission),
    );

    if (!allowed) {
      throw new ForbiddenException(
        `You do not have permission to resolve QR scans for ${purpose}`,
      );
    }
  }

  private hasPermission(auth: AuthContext, permission: string) {
    return auth.permissions.includes(permission);
  }

  private recordResolveDenied(
    tenantId: string,
    auth: AuthContext,
    studentId: string,
    purpose: StudentQrResolvePurpose,
    reason: string,
  ) {
    return this.auditService.record({
      action: 'QR_RESOLVE_FAILED',
      resource: 'student_qr',
      tenantId,
      userId: auth.userId,
      after: { studentId, purpose, reason },
    });
  }
}
