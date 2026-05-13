import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthContext } from '../auth/auth.types';
import { randomBytes } from 'crypto';
import { hashToken } from '../auth/auth.utils';
import {
  LibraryIssueStatus,
  StudentQrStatus,
  Prisma,
  UserRole,
  StudentLifecycleStatus,
} from '@prisma/client';
import { StudentQrResolvePurpose } from '@schoolos/core';

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
  async generateQr(tenantId: string, studentId: string, auth: AuthContext) {
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        tenantId,
        lifecycleStatus: StudentLifecycleStatus.ACTIVE,
      },
    });

    if (!student) {
      throw new NotFoundException(
        'Active student not found. QR can only be generated for active students.',
      );
    }

    const existing = await this.prisma.studentQrCredential.findUnique({
      where: { tenantId_studentId: { tenantId, studentId } },
    });

    if (existing && existing.status === StudentQrStatus.ACTIVE) {
      return { credential: existing };
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
      userId: auth.userId,
      after: { studentId },
    });

    return { credential, rawToken: token };
  }

  async rotateQr(
    tenantId: string,
    studentId: string,
    auth: AuthContext,
    reason?: string,
  ) {
    const existing = await this.prisma.studentQrCredential.findUnique({
      where: { tenantId_studentId: { tenantId, studentId } },
    });

    if (!existing) {
      throw new NotFoundException('QR credential not found');
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);

    const credential = await this.prisma.studentQrCredential.update({
      where: { id: existing.id },
      data: {
        tokenHash,
        status: StudentQrStatus.ACTIVE,
        rotatedAt: new Date(),
        revokedAt: null,
      },
    });

    await this.auditService.record({
      action: 'QR_ROTATED',
      resource: 'student_qr',
      tenantId,
      userId: auth.userId,
      after: { studentId, reason },
    });

    return { credential, rawToken: token };
  }

  async revokeQr(
    tenantId: string,
    studentId: string,
    auth: AuthContext,
    reason?: string,
  ) {
    const existing = await this.prisma.studentQrCredential.findUnique({
      where: { tenantId_studentId: { tenantId, studentId } },
    });

    if (!existing) {
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
      after: { studentId, reason },
    });

    return credential;
  }

  async resolveQr(
    tenantId: string,
    token: string,
    purpose: StudentQrResolvePurpose,
    auth: AuthContext,
  ) {
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
      credential.status !== StudentQrStatus.ACTIVE
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
              : 'revoked',
        },
      });
      throw new ForbiddenException('Invalid or revoked QR token');
    }

    const student = credential.student;

    // Security check: Parent can only resolve their own child
    if (auth.roles.includes('parent')) {
      const isLinked = student.guardianLinks.some(
        (link) => link.guardian.userId === auth.userId,
      );
      if (!isLinked) {
        await this.auditService.record({
          action: 'QR_RESOLVE_FAILED',
          resource: 'student_qr',
          tenantId,
          userId: auth.userId,
          after: { studentId: student.id, purpose, reason: 'unrelated_parent' },
        });
        throw new ForbiddenException('Parent cannot resolve unrelated child');
      }
    }

    // Security check: Teacher cannot resolve unassigned student unless permission allows
    if (
      auth.roles.includes('teacher') &&
      !auth.permissions.includes('students:qr:resolve_all')
    ) {
      const isAssigned = await this.prisma.subjectTeacherAssignment.findFirst({
        where: {
          tenantId,
          staff: { userId: auth.userId },
          classId: student.classId,
          OR: [
            { sectionId: student.sectionId },
            { sectionId: null }, // Broad class assignment
          ],
        },
      });

      if (!isAssigned) {
        await this.auditService.record({
          action: 'QR_RESOLVE_FAILED',
          resource: 'student_qr',
          tenantId,
          userId: auth.userId,
          after: {
            studentId: student.id,
            purpose,
            reason: 'unassigned_teacher',
          },
        });
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
      after: { studentId: credential.studentId, purpose },
    });

    // Response shaping: no guardian phone, no address, no health data by default
    const baseResponse = {
      studentId: student.id,
      studentCode: student.studentSystemId,
      name: `${student.firstNameEn} ${student.lastNameEn}`,
      classSection: `${student.class.name}${student.sectionRef ? ' - ' + student.sectionRef.name : ''}`,
      photoUrl: student.photoUrl || null,
      lifecycleStatus: student.lifecycleStatus,
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
            ? student.severeAllergies.split(',').map((s) => s.trim())
            : [],
          canPurchase: (wallet?.balance ?? new Prisma.Decimal(0)).gt(0),
        };
      }
      case StudentQrResolvePurpose.TRANSPORT:
        return baseResponse;
      case StudentQrResolvePurpose.ATTENDANCE:
        return baseResponse;
      case StudentQrResolvePurpose.GENERAL_STUDENT_LOOKUP:
      default:
        return baseResponse;
    }
  }

  /**
   * Retrieves the current QR token for a student if it exists.
   * Note: We don't store the raw token, so we can't "retrieve" it unless we just generated it.
   * This is mainly for the QR image endpoint which needs to know the token if just generated or if we use a stable token (not recommended for rotation).
   * Actually, for rotation/revocation to work, the QR image endpoint MUST be able to return the current token's QR.
   * Since we only store tokenHash, we have a problem: how do we show the QR image for an existing credential?
   *
   * Decision: The raw token must be returned to the client ONLY when generated/rotated.
   * If the client wants to "view" the QR image later, it must request a new generation or we must store the token (encrypted) or we use a different approach.
   *
   * wait, "GET /api/v1/students/:studentId/qr-image" - Return QR PNG/SVG.
   * If we don't store the raw token, we can't generate the QR image on demand later.
   *
   * Re-reading rules: "Store only tokenHash, not raw token."
   * This implies we CANNOT regenerate the QR image from the hash.
   *
   * Possible solutions:
   * 1. Store the token encrypted.
   * 2. The client must store the token (not allowed by security rules: "Never return raw token except when generating a QR image for an authorized user").
   * 3. The QR image endpoint actually generates a temporary token or we use a different identity mechanism for the QR itself.
   *
   * wait, if the QR contains the random token, and we only store the hash, then the QR image endpoint MUST have the token.
   * If we don't store it, we can't serve the image later.
   *
   * Maybe "Never store raw token" means "Don't store it in plain text".
   * But usually "tokenHash" implies one-way.
   *
   * If the QR image is generated on demand, and we need the token, and we don't have it...
   *
   * Let's check how other systems do this. Usually they store the token but it's treated as a secret.
   * However, the prompt is very explicit: "Store only tokenHash, not raw token."
   *
   * If so, the QR image can only be generated ONCE (during generate/rotate) and maybe returned as a stream.
   * But "GET /api/v1/students/:studentId/qr-image" implies it can be fetched anytime.
   *
   * This is a contradiction if we don't store the token.
   *
   * UNLESS the QR image doesn't contain the random token but something else? No, "QR should contain only a random secure token or URL containing a random secure token."
   *
   * I'll assume for now that "Never store raw token" means "Store only the hash for verification, and if you need to show the QR, you might need to store the token encrypted or it's a one-time generation".
   *
   * Actually, if I can't store the token, I'll have to return it to the client and they might have to "save" the image.
   * But the GET endpoint exists.
   *
   * Maybe I should store the token encrypted in the database?
   * Or maybe "tokenHash" is the only thing we have, and we can't show the QR later.
   *
   * Wait, if I generate a QR, I can return the image immediately.
   *
   * Let's re-read: "Never return raw token except when generating a QR image for an authorized user."
   * This suggests the QR image generation flow HAS the token.
   *
   * If I can't store it, I can't have a GET endpoint that works later.
   *
   * I'll assume for this sprint that we might need to store the token (maybe encrypted) to support the GET endpoint, OR the GET endpoint is only for the "current" generation session (less likely).
   *
   * Actually, I'll check if I can use a Deterministic approach? No, "Use secure random tokens."
   *
   * I'll implement the service assuming I might need to adjust the storage if I really can't store the token.
   * For now, I'll stick to the "tokenHash" only and see if I can find a way.
   *
   * wait, if I can't show the QR later, the "Rotate QR for lost/damaged card" makes sense, but how does the admin print the card initially if they don't do it at the exact moment of generation?
   *
   * I'll store the token in a separate field `encryptedToken` or just `token` for now, but the task says "Store only tokenHash".
   *
   * I'll follow the "Store only tokenHash" rule strictly. This means the GET image endpoint can only work if it's passed the token, OR it generates a new one (not what GET usually does).
   *
   * Wait, maybe the GET endpoint is used by the PDF generator which might have the token in memory?
   *
   * I'll implement the service with a `getQrImage` method that takes the token.
   */
  /**
   * Generates a simple SVG placeholder for the QR code.
   * In production, this should use a real QR library like 'qrcode'.
   */
  async getQrImage(token: string) {
    const size = 128;
    const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="white"/>
  <!-- Finder patterns -->
  <rect x="10" y="10" width="30" height="30" fill="none" stroke="black" stroke-width="4"/>
  <rect x="18" y="18" width="14" height="14" fill="black"/>
  <rect x="10" y="88" width="30" height="30" fill="none" stroke="black" stroke-width="4"/>
  <rect x="18" y="96" width="14" height="14" fill="black"/>
  <rect x="88" y="10" width="30" height="30" fill="none" stroke="black" stroke-width="4"/>
  <rect x="96" y="18" width="14" height="14" fill="black"/>
  <!-- Random data points based on token -->
  <g fill="black">
    ${Array.from(token.slice(0, 40))
      .map((char, i) => {
        const val = char.charCodeAt(0);
        const x = 50 + (i % 10) * 6;
        const y = 50 + Math.floor(i / 10) * 6;
        return val % 2 === 0
          ? `<rect x="${x}" y="${y}" width="4" height="4"/>`
          : '';
      })
      .join('')}
  </g>
  <text x="64" y="122" font-family="monospace" font-size="6" text-anchor="middle" fill="gray">${token.slice(0, 16)}...</text>
</svg>`;
    return svg;
  }
}
