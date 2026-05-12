import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { randomBytes } from 'crypto';
import { hashToken } from '../auth/auth.utils';
import { LibraryIssueStatus, StudentQrStatus } from '@prisma/client';
import { StudentQrResolvePurpose } from './dto/student-qr.dto';
import type { AuthContext } from '../auth/auth.types';
import {
  getParentStudentIds,
  getStudentOwnId,
  isParentOnly,
  isStudentOnly,
} from '../common/security/parent-scope';
import { toString as qrToString } from 'qrcode';

@Injectable()
export class StudentQrService {
  private readonly logger = new Logger(StudentQrService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Generates a new QR credential for a student if one doesn't exist or is revoked.
   * If an active one exists, it returns the existing one (idempotent).
   */
  async generateQr(tenantId: string, studentId: string, actorUserId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const existing = await this.prisma.studentQrCredential.findUnique({
      where: { tenantId_studentId: { tenantId, studentId } },
    });

    if (existing && existing.status === StudentQrStatus.ACTIVE) {
      return { credential: sanitizeQrCredential(existing) };
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);

    const credential = await this.prisma.studentQrCredential.upsert({
      where: { tenantId_studentId: { tenantId, studentId } },
      update: {
        tokenHash,
        status: StudentQrStatus.ACTIVE,
        revokedAt: null,
        rotatedAt: null,
      },
      create: {
        tenantId,
        studentId,
        tokenHash,
        status: StudentQrStatus.ACTIVE,
      },
    });

    await this.auditService.record({
      action: 'QR_GENERATED',
      resource: 'student_qr',
      tenantId,
      userId: actorUserId,
      after: { studentId },
    });

    return { credential: sanitizeQrCredential(credential), rawToken: token };
  }

  /**
   * Rotates a student's QR credential (e.g. for lost card).
   * Invalidates the old token and generates a new one.
   */
  async rotateQr(
    tenantId: string,
    studentId: string,
    actorUserId: string,
    reason?: string,
  ) {
    const normalizedReason = requireQrReason(reason, 'QR rotation reason');
    const existing = await this.prisma.studentQrCredential.findUnique({
      where: { tenantId_studentId: { tenantId, studentId } },
    });

    if (!existing) {
      throw new NotFoundException('QR credential not found');
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);

    const credential = await this.prisma.$transaction(async (tx) => {
      return tx.studentQrCredential.update({
        where: { id: existing.id },
        data: {
          tokenHash,
          status: StudentQrStatus.ACTIVE,
          rotatedAt: new Date(),
          revokedAt: null,
        },
      });
    });

    await this.auditService.record({
      action: 'QR_ROTATED',
      resource: 'student_qr',
      tenantId,
      userId: actorUserId,
      after: { studentId, reason: normalizedReason },
    });

    return { credential: sanitizeQrCredential(credential), rawToken: token };
  }

  /**
   * Revokes a student's QR credential.
   */
  async revokeQr(
    tenantId: string,
    studentId: string,
    actorUserId: string,
    reason?: string,
  ) {
    const normalizedReason = requireQrReason(reason, 'QR revocation reason');
    const existing = await this.prisma.studentQrCredential.findUnique({
      where: { tenantId_studentId: { tenantId, studentId } },
    });

    if (!existing) {
      throw new NotFoundException('QR credential not found');
    }

    const credential = await this.prisma.$transaction(async (tx) => {
      return tx.studentQrCredential.update({
        where: { id: existing.id },
        data: {
          status: StudentQrStatus.REVOKED,
          revokedAt: new Date(),
        },
      });
    });

    await this.auditService.record({
      action: 'QR_REVOKED',
      resource: 'student_qr',
      tenantId,
      userId: actorUserId,
      after: { studentId, reason: normalizedReason },
    });

    return sanitizeQrCredential(credential);
  }

  /**
   * Resolves a scanned QR token for a specific purpose.
   */
  async resolveQr(
    tenantId: string,
    token: string,
    purpose: StudentQrResolvePurpose,
    actor: AuthContext,
  ) {
    const tokenHash = hashToken(token);
    const credential = await this.prisma.studentQrCredential.findUnique({
      where: { tokenHash },
      include: {
        student: {
          include: {
            class: true,
            sectionRef: true,
          },
        },
      },
    });

    if (
      !credential ||
      credential.tenantId !== tenantId ||
      credential.status !== StudentQrStatus.ACTIVE
    ) {
      await this.auditService.record({
        action: 'QR_RESOLVE_FAILED',
        resource: 'student_qr',
        tenantId,
        userId: actor.userId,
        after: {
          purpose,
          reason: !credential
            ? 'not_found'
            : credential.tenantId !== tenantId
              ? 'wrong_tenant'
              : 'revoked',
        },
      });
      throw new ForbiddenException('Invalid or revoked QR token');
    }

    await this.assertPurposeAccess(actor, credential.student, purpose);

    await this.prisma.studentQrCredential.update({
      where: { id: credential.id },
      data: { lastScannedAt: new Date() },
    });

    await this.auditService.record({
      action: 'QR_RESOLVED',
      resource: 'student_qr',
      tenantId,
      userId: actor.userId,
      after: { studentId: credential.studentId, purpose },
    });

    const student = credential.student;
    const baseResponse = {
      studentId: student.id,
      studentCode: student.studentSystemId,
      name: `${student.firstNameEn} ${student.lastNameEn}`,
      classSection: `${student.class.name}${student.sectionRef ? ' - ' + student.sectionRef.name : ''}`,
      photoUrl: student.photoUrl || null,
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
          canBorrow: activeIssues < 5, // Default limit if we can't get config
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
            ? student.severeAllergies.split(',').map((s) => s.trim())
            : [],
          canPurchase: Number(wallet?.balance?.toString() ?? '0') > 0,
        };
      }
      case StudentQrResolvePurpose.TRANSPORT:
        return {
          ...baseResponse,
          // Placeholder: Transport integration needed
        };
      case StudentQrResolvePurpose.ATTENDANCE:
        return {
          ...baseResponse,
          // Placeholder: Attendance integration needed
        };
      case StudentQrResolvePurpose.GENERAL_STUDENT_LOOKUP:
      default:
        return baseResponse;
    }
  }

  // Raw QR tokens are never persisted; this verifies a one-time token before rendering.
  async getQrImage(
    tenantId: string,
    studentId: string,
    token: string,
    actorUserId: string,
  ) {
    const credential = await this.prisma.studentQrCredential.findUnique({
      where: {
        tenantId_studentId: {
          tenantId,
          studentId,
        },
      },
      select: { status: true, tokenHash: true },
    });

    if (!credential || credential.status !== StudentQrStatus.ACTIVE) {
      throw new NotFoundException('Active QR credential not found');
    }

    if (credential.tokenHash !== hashToken(token)) {
      throw new ForbiddenException('QR token does not match this student');
    }

    await this.auditService.record({
      action: 'QR_IMAGE_GENERATED',
      resource: 'student_qr',
      tenantId,
      userId: actorUserId,
      after: { studentId },
    });

    return qrToString(token, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 192,
    });
  }

  private async assertPurposeAccess(
    actor: AuthContext,
    student: {
      id: string;
      classId: string;
      sectionId?: string | null;
    },
    purpose: StudentQrResolvePurpose,
  ) {
    if (actor.roles.includes('platform_super_admin')) return;

    if (isParentOnly(actor)) {
      const allowedStudentIds = await getParentStudentIds(this.prisma, actor);
      if (!allowedStudentIds?.includes(student.id)) {
        throw new ForbiddenException('QR scan is not allowed for this student');
      }
    }

    if (isStudentOnly(actor)) {
      const ownStudentId = await getStudentOwnId(this.prisma, actor);
      if (ownStudentId !== student.id) {
        throw new ForbiddenException('QR scan is not allowed for this student');
      }
    }

    if (
      isTeacherRole(actor) &&
      !hasAnyPermission(actor, ['students:qr:resolve'])
    ) {
      await this.assertTeacherAssignedToStudent(actor, student);
    }

    const allowed = await this.hasPurposePermission(actor, student.id, purpose);
    if (!allowed) {
      throw new ForbiddenException('QR scan purpose is not permitted');
    }
  }

  private async hasPurposePermission(
    actor: AuthContext,
    studentId: string,
    purpose: StudentQrResolvePurpose,
  ) {
    switch (purpose) {
      case StudentQrResolvePurpose.LIBRARY:
        return hasAnyPermission(actor, [
          'students:qr:resolve',
          'library:manage',
          'library:issues:create',
          'library:issues:read',
        ]);
      case StudentQrResolvePurpose.CANTEEN:
        return hasAnyPermission(actor, [
          'students:qr:resolve',
          'canteen:serving:create',
          'canteen:serving:read',
          'canteen:pos:create',
          'canteen:pos:read',
        ]);
      case StudentQrResolvePurpose.TRANSPORT:
        return (
          hasAnyPermission(actor, [
            'students:qr:resolve',
            'transport:operate',
            'transport:manage',
            'transport:read',
          ]) ||
          (hasAnyPermission(actor, ['transport:tracking:parent']) &&
            (await this.isOwnChild(actor, studentId)))
        );
      case StudentQrResolvePurpose.ATTENDANCE:
        return hasAnyPermission(actor, [
          'students:qr:resolve',
          'attendance:mark',
          'attendance:read',
        ]);
      case StudentQrResolvePurpose.GENERAL_STUDENT_LOOKUP:
      default:
        return hasAnyPermission(actor, [
          'students:qr:resolve',
          'students:read',
        ]);
    }
  }

  private async isOwnChild(actor: AuthContext, studentId: string) {
    const allowedStudentIds = await getParentStudentIds(this.prisma, actor);
    return allowedStudentIds?.includes(studentId) ?? false;
  }

  private async assertTeacherAssignedToStudent(
    actor: AuthContext,
    student: { id: string; classId: string; sectionId?: string | null },
  ) {
    const staff = await this.prisma.staff.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.userId },
      select: { id: true },
    });

    if (!staff) {
      throw new ForbiddenException('No staff profile linked to this account');
    }

    const assignment = await this.prisma.subjectTeacherAssignment.findFirst({
      where: {
        tenantId: actor.tenantId,
        staffId: staff.id,
        classId: student.classId,
        OR: [{ sectionId: student.sectionId ?? null }, { sectionId: null }],
      },
      select: { id: true },
    });

    if (!assignment) {
      throw new ForbiddenException('Teacher is not assigned to this student');
    }
  }
}

function sanitizeQrCredential<T extends { tokenHash?: string }>(credential: T) {
  const { tokenHash: _tokenHash, ...safeCredential } = credential;
  return safeCredential;
}

function requireQrReason(reason: string | undefined, label: string) {
  const normalized = reason?.trim();
  if (!normalized || normalized.length < 5) {
    throw new BadRequestException(`${label} must be at least 5 characters`);
  }
  return normalized;
}

function isTeacherRole(actor: AuthContext) {
  return (
    (actor.roles.includes('teacher') ||
      actor.roles.includes('subject_teacher')) &&
    !actor.roles.some((role) =>
      ['admin', 'principal', 'platform_super_admin'].includes(role),
    )
  );
}

function hasAnyPermission(actor: AuthContext, permissions: string[]) {
  return permissions.some((permission) =>
    actor.permissions.includes(permission),
  );
}
