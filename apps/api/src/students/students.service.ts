import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  AudienceType,
  EnrollmentStatus,
  NotificationChannel,
  Prisma,
  StudentLifecycleStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthContext } from '../auth/auth.types';
import { CommunicationsService } from '../communications/communications.service';
import { buildSimplePdf } from '../common/pdf/simple-pdf';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { ArchiveStudentDto } from './dto/archive-student.dto';
import { CreateStudentDto } from './dto/create-student.dto';
import { DeleteStudentDto } from './dto/delete-student.dto';
import { InviteGuardianDto } from './dto/invite-guardian.dto';
import { RequestStudentTransferDto } from './dto/request-student-transfer.dto';
import { RevokeGeneratedStudentDocumentDto } from './dto/revoke-generated-student-document.dto';

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly communicationsService: CommunicationsService,
    private readonly auditService: AuditService,
  ) {}

  async createStudent(dto: CreateStudentDto, actor: AuthContext) {
    const classroom = await this.prisma.class.findFirst({
      where: {
        id: dto.classId,
        tenantId: actor.tenantId,
      },
    });

    if (!classroom) {
      throw new NotFoundException('Class not found in this tenant');
    }

    let linkedUserId: string | null = null;

    if (dto.createLogin) {
      const studentRole = await this.prisma.role.findUnique({
        where: {
          tenantId_name: {
            tenantId: actor.tenantId,
            name: 'student',
          },
        },
      });

      if (!studentRole) {
        throw new NotFoundException('Student role not found for this tenant');
      }

      const managedUser = await this.usersService.createManagedUser({
        tenantId: actor.tenantId,
        email: dto.email!,
        password: dto.password!,
        phone: dto.phone,
        roleIds: [studentRole.id],
        assignedById: actor.userId,
      });
      linkedUserId = managedUser.id;
    }

    const student = await this.prisma.student.create({
      data: {
        tenantId: actor.tenantId,
        userId: linkedUserId,
        studentSystemId:
          dto.studentSystemId ?? (await this.generateStudentSystemId(actor)),
        firstNameEn: dto.firstNameEn,
        lastNameEn: dto.lastNameEn,
        firstNameNp: dto.firstNameNp ?? null,
        lastNameNp: dto.lastNameNp ?? null,
        dateOfBirth: new Date(dto.dateOfBirth),
        gender: dto.gender,
        admissionDate: new Date(dto.admissionDate),
        classId: dto.classId,
        section: dto.section ?? null,
        rollNumber: dto.rollNumber ?? null,
        admissionNumber: dto.admissionNumber ?? null,
        nationality: dto.nationality ?? 'Nepali',
        mediumOfInstruct: dto.mediumOfInstruct ?? 'English',
        emergencyName: dto.emergencyName ?? null,
        emergencyPhone: dto.emergencyPhone ?? null,
      },
      include: {
        class: true,
        user: true,
      },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'student',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: student.id,
      after: {
        studentSystemId: student.studentSystemId,
        classId: student.classId,
        hasLogin: Boolean(student.userId),
      },
    });

    return {
      id: student.id,
      studentSystemId: student.studentSystemId,
      firstNameEn: student.firstNameEn,
      lastNameEn: student.lastNameEn,
      class: {
        id: student.class.id,
        name: student.class.name,
      },
      email: student.user?.email ?? null,
      hasLogin: Boolean(student.userId),
    };
  }

  async listStudents(actor: AuthContext) {
    const students = await this.prisma.student.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        class: true,
        user: true,
      },
      orderBy: [{ createdAt: 'desc' }, { firstNameEn: 'asc' }],
    });

    return students.map((student) => ({
      id: student.id,
      studentSystemId: student.studentSystemId,
      firstNameEn: student.firstNameEn,
      lastNameEn: student.lastNameEn,
      class: {
        id: student.class.id,
        name: student.class.name,
      },
      section: student.section,
      rollNumber: student.rollNumber,
      email: student.user?.email ?? null,
      hasLogin: Boolean(student.userId),
      lifecycleStatus: student.lifecycleStatus,
    }));
  }

  async getFeeClearance(studentId: string, actor: AuthContext) {
    const student = await this.findTenantStudent(studentId, actor);
    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId: actor.tenantId,
        studentId,
        status: { not: 'VOID' },
      },
      include: {
        payments: {
          include: { refunds: true },
        },
      },
      orderBy: [{ issuedAt: 'desc' }],
    });

    const invoiceSummaries = invoices.map((invoice) => {
      const paidAmount = invoice.payments.reduce((sum, payment) => {
        const refundedAmount = payment.refunds.reduce(
          (refundSum, refund) => refundSum.add(refund.amount),
          new Prisma.Decimal(0),
        );

        return sum.add(payment.amount).sub(refundedAmount);
      }, new Prisma.Decimal(0));
      const outstandingAmount = invoice.totalAmount.sub(paidAmount);

      return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        totalAmount: Number(invoice.totalAmount),
        paidAmount: Number(paidAmount),
        outstandingAmount: Number(
          outstandingAmount.gt(0) ? outstandingAmount : new Prisma.Decimal(0),
        ),
        dueDate: invoice.dueDate,
      };
    });
    const outstandingAmount = invoiceSummaries.reduce(
      (sum, invoice) => sum + invoice.outstandingAmount,
      0,
    );

    return {
      studentId: student.id,
      studentSystemId: student.studentSystemId,
      cleared: outstandingAmount <= 0 || Boolean(student.feeClearanceWaivedAt),
      outstandingAmount,
      waivedAt: student.feeClearanceWaivedAt,
      invoices: invoiceSummaries,
    };
  }

  async requestTransfer(
    studentId: string,
    dto: RequestStudentTransferDto,
    actor: AuthContext,
  ) {
    const student = await this.findTenantStudent(studentId, actor);
    ensureAllowedLifecycleTransition(
      student.lifecycleStatus,
      StudentLifecycleStatus.TRANSFERRED,
    );
    const clearance = await this.getFeeClearance(studentId, actor);

    if (!clearance.cleared && !dto.waiveFeeClearance) {
      throw new BadRequestException({
        message:
          'Fee clearance is required before transfer or certificate issuance.',
        clearance,
      });
    }

    const exitedAt = dto.exitedAt ? new Date(dto.exitedAt) : new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.enrollment.updateMany({
        where: {
          tenantId: actor.tenantId,
          studentId,
          status: EnrollmentStatus.ACTIVE,
        },
        data: {
          status: EnrollmentStatus.TRANSFERRED,
        },
      });

      return tx.student.update({
        where: { id: student.id },
        data: {
          lifecycleStatus: StudentLifecycleStatus.TRANSFERRED,
          exitReason: dto.reason,
          exitedAt,
          destinationSchool: dto.destinationSchool ?? null,
          conductRemark: dto.conductRemark ?? null,
          ...(dto.waiveFeeClearance
            ? {
                feeClearanceWaivedAt: new Date(),
                feeClearanceWaivedById: actor.userId,
              }
            : {}),
        },
      });
    });
    await this.recordLifecycleTransition(
      student.id,
      student.lifecycleStatus,
      StudentLifecycleStatus.TRANSFERRED,
      dto.reason,
      actor,
      {
        destinationSchool: dto.destinationSchool ?? null,
        conductRemark: dto.conductRemark ?? null,
        exitedAt: exitedAt.toISOString(),
      },
      dto.waiveFeeClearance ?? false,
    );

    await this.auditService.record({
      action: dto.waiveFeeClearance ? 'transfer_with_fee_waiver' : 'transfer',
      resource: 'student',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: student.id,
      after: {
        lifecycleStatus: updated.lifecycleStatus,
        destinationSchool: updated.destinationSchool,
        exitedAt: updated.exitedAt,
      },
    });

    return {
      id: updated.id,
      studentSystemId: updated.studentSystemId,
      lifecycleStatus: updated.lifecycleStatus,
      exitedAt: updated.exitedAt,
      destinationSchool: updated.destinationSchool,
      feeClearance: await this.getFeeClearance(studentId, actor),
    };
  }

  async archiveStudent(
    studentId: string,
    dto: ArchiveStudentDto,
    actor: AuthContext,
  ) {
    const student = await this.findTenantStudent(studentId, actor);
    ensureAllowedLifecycleTransition(
      student.lifecycleStatus,
      StudentLifecycleStatus.EXITED,
    );
    const exitedAt = dto.exitedAt ? new Date(dto.exitedAt) : new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.enrollment.updateMany({
        where: {
          tenantId: actor.tenantId,
          studentId,
          status: EnrollmentStatus.ACTIVE,
        },
        data: {
          status: EnrollmentStatus.EXITED,
        },
      });

      return tx.student.update({
        where: { id: student.id },
        data: {
          lifecycleStatus: StudentLifecycleStatus.EXITED,
          exitReason: dto.reason,
          exitedAt,
        },
      });
    });
    await this.recordLifecycleTransition(
      student.id,
      student.lifecycleStatus,
      StudentLifecycleStatus.EXITED,
      dto.reason,
      actor,
      {
        exitedAt: exitedAt.toISOString(),
      },
    );

    await this.auditService.record({
      action: 'exit',
      resource: 'student',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: student.id,
      after: {
        lifecycleStatus: updated.lifecycleStatus,
        exitedAt: updated.exitedAt,
      },
    });

    return {
      id: updated.id,
      studentSystemId: updated.studentSystemId,
      lifecycleStatus: updated.lifecycleStatus,
      exitedAt: updated.exitedAt,
    };
  }

  async archiveAlumni(
    studentId: string,
    dto: ArchiveStudentDto,
    actor: AuthContext,
  ) {
    const student = await this.findTenantStudent(studentId, actor);
    ensureAllowedLifecycleTransition(
      student.lifecycleStatus,
      StudentLifecycleStatus.ALUMNI,
    );
    const exitedAt = dto.exitedAt ? new Date(dto.exitedAt) : new Date();
    const updated = await this.prisma.student.update({
      where: { id: student.id },
      data: {
        lifecycleStatus: StudentLifecycleStatus.ALUMNI,
        exitReason: dto.reason,
        exitedAt,
      },
    });

    await this.recordLifecycleTransition(
      student.id,
      student.lifecycleStatus,
      StudentLifecycleStatus.ALUMNI,
      dto.reason,
      actor,
      {
        exitedAt: exitedAt.toISOString(),
      },
    );

    await this.auditService.record({
      action: 'archive_alumni',
      resource: 'student',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: student.id,
      after: {
        lifecycleStatus: updated.lifecycleStatus,
        exitedAt: updated.exitedAt,
      },
    });

    return {
      id: updated.id,
      studentSystemId: updated.studentSystemId,
      lifecycleStatus: updated.lifecycleStatus,
      exitedAt: updated.exitedAt,
    };
  }

  async deleteStudent(
    studentId: string,
    dto: DeleteStudentDto,
    actor: AuthContext,
  ) {
    const student = await this.findTenantStudent(studentId, actor);
    ensureAllowedLifecycleTransition(
      student.lifecycleStatus,
      StudentLifecycleStatus.DELETED,
    );

    if (student.lifecycleStatus === StudentLifecycleStatus.ALUMNI) {
      if (!student.exitedAt) {
        throw new BadRequestException(
          'Alumni record must have an exitedAt date',
        );
      }
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      if (student.exitedAt > twelveMonthsAgo) {
        throw new BadRequestException(
          'Alumni must be retained for at least 12 months after graduation/exit before deletion.',
        );
      }
    }

    const clearance = await this.getFeeClearance(studentId, actor);

    if (!clearance.cleared) {
      throw new BadRequestException({
        message:
          'Fee clearance is required before student deletion or withdrawal.',
        clearance,
      });
    }

    const deletedAt = dto.deletedAt ? new Date(dto.deletedAt) : new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.enrollment.updateMany({
        where: {
          tenantId: actor.tenantId,
          studentId,
          status: EnrollmentStatus.ACTIVE,
        },
        data: {
          status: EnrollmentStatus.EXITED,
        },
      });

      return tx.student.update({
        where: { id: student.id },
        data: {
          lifecycleStatus: StudentLifecycleStatus.DELETED,
          exitReason: dto.reason,
          exitedAt: deletedAt,
        },
      });
    });

    await this.recordLifecycleTransition(
      student.id,
      student.lifecycleStatus,
      StudentLifecycleStatus.DELETED,
      dto.reason,
      actor,
      {
        deletedAt: deletedAt.toISOString(),
      },
    );

    await this.auditService.record({
      action: 'delete',
      resource: 'student',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: student.id,
      after: {
        lifecycleStatus: updated.lifecycleStatus,
        exitedAt: updated.exitedAt,
      },
    });

    return {
      id: updated.id,
      studentSystemId: updated.studentSystemId,
      lifecycleStatus: updated.lifecycleStatus,
      exitedAt: updated.exitedAt,
    };
  }

  async inviteGuardians(
    studentId: string,
    dto: InviteGuardianDto,
    actor: AuthContext,
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId: actor.tenantId },
      include: {
        guardianLinks: {
          where: dto.guardianId ? { guardianId: dto.guardianId } : undefined,
          include: { guardian: true },
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found in this tenant');
    }

    if (dto.guardianId && student.guardianLinks.length === 0) {
      throw new NotFoundException('Guardian not linked to this student');
    }

    const title = 'SchoolOS guardian invitation';
    const body =
      dto.message ??
      `You have been invited to connect with ${student.firstNameEn} ${student.lastNameEn} in SchoolOS.`;

    const delivery = await this.communicationsService.recordDeliveryRecords({
      actor,
      sourceType: 'guardian_invitation',
      sourceId: student.id,
      audienceType: AudienceType.ALL,
      studentIds: [student.id],
      guardianIds: dto.guardianId ? [dto.guardianId] : undefined,
      title,
      body,
      channels: [NotificationChannel.SMS],
      requiredConsentTypes: [],
    });

    await this.auditService.record({
      action: 'invite',
      resource: 'guardian',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: student.id,
      after: {
        guardianId: dto.guardianId ?? null,
        delivery,
      },
    });

    return delivery;
  }

  async exportIemis(actor: AuthContext) {
    const students = await this.prisma.student.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        tenant: true,
        class: true,
        sectionRef: true,
        guardianLinks: {
          include: { guardian: true },
        },
        enrollments: {
          include: {
            academicYear: true,
            section: true,
          },
          orderBy: [{ createdAt: 'desc' }],
        },
      },
      orderBy: [{ studentSystemId: 'asc' }],
    });

    const validationResults = students.map((student) => {
      const issues = validateIemisStudent(student);

      return {
        student,
        issues,
      };
    });

    return {
      exportedAt: new Date().toISOString(),
      totalRecords: students.length,
      validRecords: validationResults.filter(
        (result) => result.issues.length === 0,
      ).length,
      invalidRecords: validationResults.filter(
        (result) => result.issues.length > 0,
      ).length,
      issues: validationResults
        .filter((result) => result.issues.length > 0)
        .flatMap((result) =>
          result.issues.map((issue) => ({
            studentId: result.student.id,
            studentSystemId: result.student.studentSystemId,
            field: issue.field,
            message: issue.message,
          })),
        ),
      rows: validationResults
        .filter((result) => result.issues.length === 0)
        .map(({ student }) => ({
          studentSystemId: student.studentSystemId,
          nationalStudentId: student.nationalStudentId,
          firstNameEn: student.firstNameEn,
          lastNameEn: student.lastNameEn,
          firstNameNp: student.firstNameNp,
          lastNameNp: student.lastNameNp,
          dateOfBirth: student.dateOfBirth.toISOString().slice(0, 10),
          gender: student.gender,
          nationality: student.nationality,
          motherTongue: student.motherTongue,
          ethnicity: student.ethnicity,
          disabilityFlag: student.disabilityFlag,
          admissionDate: student.admissionDate.toISOString().slice(0, 10),
          admissionNumber: student.admissionNumber,
          lifecycleStatus: student.lifecycleStatus,
          className: student.class.name,
          sectionName: student.sectionRef?.name ?? student.section,
          rollNumber: student.rollNumber,
          guardians: student.guardianLinks.map((link) => ({
            fullName: link.guardian.fullName,
            relation: link.relation,
            primaryPhone: link.guardian.primaryPhone,
            email: link.guardian.email,
            wardNumber: link.guardian.wardNumber,
            isPrimary: link.isPrimary,
          })),
          latestEnrollment: student.enrollments[0]
            ? {
                academicYear: student.enrollments[0].academicYear.name,
                classId: student.enrollments[0].classId,
                sectionName: student.enrollments[0].section?.name ?? null,
                status: student.enrollments[0].status,
              }
            : null,
        })),
    };
  }

  async generateStudentDocumentPdf(
    studentId: string,
    documentKind: string,
    actor: AuthContext,
  ) {
    const normalizedKind = normalizeStudentDocumentKind(documentKind);
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        tenantId: actor.tenantId,
      },
      include: {
        tenant: true,
        class: true,
        sectionRef: true,
        guardianLinks: {
          include: {
            guardian: true,
          },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        },
        enrollments: {
          include: {
            academicYear: true,
            section: true,
          },
          orderBy: [{ createdAt: 'desc' }],
          take: 1,
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found in this tenant');
    }

    if (requiresFeeClearance(normalizedKind)) {
      const clearance = await this.getFeeClearance(studentId, actor);

      if (!clearance.cleared) {
        throw new BadRequestException({
          message:
            'Fee clearance is required before this student document can be issued.',
          clearance,
        });
      }
    }

    const lines = buildStudentDocumentLines(student, normalizedKind);
    const pdf = buildSimplePdf(lines);
    const fileName = `${student.studentSystemId}-${normalizedKind}.pdf`;
    const pdfUrl = `/api/v1/students/${student.id}/documents/${normalizedKind}.pdf`;
    const checksumSha256 = createHash('sha256').update(pdf).digest('hex');
    const storageObjectKey = `generated-student-documents/${student.id}/${fileName}`;
    const signedAt = new Date();
    const latestVersion = await this.prisma.generatedStudentDocument.findFirst({
      where: {
        tenantId: actor.tenantId,
        studentId: student.id,
        kind: normalizedKind,
      },
      orderBy: [{ version: 'desc' }, { generatedAt: 'desc' }],
    });
    const version = (latestVersion?.version ?? 0) + 1;

    await this.prisma.$transaction(async (tx) => {
      await tx.generatedStudentDocument.updateMany({
        where: {
          tenantId: actor.tenantId,
          studentId: student.id,
          kind: normalizedKind,
          revokedAt: null,
        },
        data: {
          revokedAt: signedAt,
          revokedById: actor.userId,
        },
      });

      await tx.generatedStudentDocument.create({
        data: {
          tenantId: actor.tenantId,
          studentId: student.id,
          kind: normalizedKind,
          title: getStudentDocumentTitle(normalizedKind),
          fileName,
          sizeBytes: pdf.byteLength,
          pdfUrl,
          generatedById: actor.userId,
          storageObjectKey,
          checksumSha256,
          signedAt,
          signatureMetadata: {
            issuerUserId: actor.userId,
            tenantSlug: actor.tenantSlug,
            generatedAt: signedAt.toISOString(),
            mode: 'internal-issued',
          } as Prisma.InputJsonValue,
          version,
          retentionUntil: resolveDocumentRetentionUntil(
            normalizedKind,
            signedAt,
          ),
          metadata: {
            studentSystemId: student.studentSystemId,
            className: student.class.name,
            sectionName: student.sectionRef?.name ?? student.section ?? null,
          } as Prisma.InputJsonValue,
        },
      });
    });

    await this.auditService.record({
      action: 'generate',
      resource: 'student_document_pdf',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: student.id,
      after: {
        kind: normalizedKind,
        fileName,
      },
    });

    return pdf;
  }

  async revokeGeneratedStudentDocument(
    studentId: string,
    documentId: string,
    dto: RevokeGeneratedStudentDocumentDto,
    actor: AuthContext,
  ) {
    await this.findTenantStudent(studentId, actor);
    const document = await this.prisma.generatedStudentDocument.findFirst({
      where: {
        id: documentId,
        studentId,
        tenantId: actor.tenantId,
      },
    });

    if (!document) {
      throw new NotFoundException('Generated student document not found');
    }

    if (document.revokedAt) {
      throw new ConflictException(
        'Generated student document is already revoked',
      );
    }

    if (document.retentionUntil && document.retentionUntil > new Date()) {
      throw new ConflictException(
        'Generated student document cannot be revoked before its retention period ends',
      );
    }

    const revoked = await this.prisma.generatedStudentDocument.update({
      where: { id: document.id },
      data: {
        revokedAt: new Date(),
        revokedById: actor.userId,
        metadata: {
          ...(document.metadata as Record<string, unknown> | null),
          revokeReason: dto.reason,
        } as Prisma.InputJsonValue,
      },
    });

    await this.auditService.record({
      action: 'revoke',
      resource: 'generated_student_document',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: revoked.id,
      after: {
        kind: revoked.kind,
        fileName: revoked.fileName,
        revokeReason: dto.reason,
      },
    });

    return {
      id: revoked.id,
      revokedAt: revoked.revokedAt,
      revokedById: revoked.revokedById,
    };
  }

  private async recordLifecycleTransition(
    studentId: string,
    fromStatus: StudentLifecycleStatus,
    toStatus: StudentLifecycleStatus,
    reason: string,
    actor: AuthContext,
    metadata: Record<string, unknown>,
    feeClearanceWaived = false,
  ) {
    await this.prisma.studentLifecycleTransition.create({
      data: {
        tenantId: actor.tenantId,
        studentId,
        fromStatus,
        toStatus,
        reason,
        changedById: actor.userId,
        feeClearanceWaived,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }

  private async generateStudentSystemId(actor: AuthContext) {
    const count = await this.prisma.student.count({
      where: { tenantId: actor.tenantId },
    });

    return `SCH-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
  }

  private async findTenantStudent(studentId: string, actor: AuthContext) {
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        tenantId: actor.tenantId,
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found in this tenant');
    }

    return student;
  }
}

type GeneratedStudentDocumentKind =
  | 'id-card'
  | 'transfer-certificate'
  | 'leaving-certificate'
  | 'character-certificate'
  | 'enrollment-confirmation';

type StudentDocumentPayload = Prisma.StudentGetPayload<{
  include: {
    tenant: true;
    class: true;
    sectionRef: true;
    guardianLinks: {
      include: {
        guardian: true;
      };
    };
    enrollments: {
      include: {
        academicYear: true;
        section: true;
      };
    };
  };
}>;

function normalizeStudentDocumentKind(
  kind: string,
): GeneratedStudentDocumentKind {
  const normalized = kind.toLowerCase().replace(/_/g, '-');

  if (
    normalized === 'id-card' ||
    normalized === 'transfer-certificate' ||
    normalized === 'leaving-certificate' ||
    normalized === 'character-certificate' ||
    normalized === 'enrollment-confirmation'
  ) {
    return normalized;
  }

  throw new BadRequestException(
    'Document kind must be id-card, transfer-certificate, leaving-certificate, character-certificate, or enrollment-confirmation',
  );
}

function getStudentDocumentTitle(kind: GeneratedStudentDocumentKind) {
  switch (kind) {
    case 'id-card':
      return 'Student ID Card';
    case 'transfer-certificate':
      return 'Transfer Certificate';
    case 'leaving-certificate':
      return 'Leaving Certificate';
    case 'character-certificate':
      return 'Character Certificate';
    case 'enrollment-confirmation':
      return 'Enrollment Confirmation';
  }
}

function requiresFeeClearance(kind: GeneratedStudentDocumentKind) {
  return (
    kind === 'transfer-certificate' ||
    kind === 'leaving-certificate' ||
    kind === 'character-certificate'
  );
}

function buildStudentDocumentLines(
  student: StudentDocumentPayload,
  kind: GeneratedStudentDocumentKind,
) {
  const latestEnrollment = student.enrollments[0];
  const primaryGuardian =
    student.guardianLinks.find((link) => link.isPrimary)?.guardian ??
    student.guardianLinks[0]?.guardian ??
    null;
  const fullName = `${student.firstNameEn} ${student.lastNameEn}`.trim();
  const sectionName =
    latestEnrollment?.section?.name ??
    student.sectionRef?.name ??
    student.section;
  const baseLines = [
    student.tenant.name,
    getStudentDocumentTitle(kind),
    `Generated: ${new Date().toISOString().slice(0, 10)}`,
    `Student ID: ${student.studentSystemId}`,
    `Name: ${fullName}`,
    `Date of Birth: ${student.dateOfBirth.toISOString().slice(0, 10)}`,
    `Class: ${student.class.name}`,
    `Section: ${sectionName ?? 'N/A'}`,
    `Roll No: ${student.rollNumber ?? latestEnrollment?.rollNumber ?? 'N/A'}`,
    `Guardian: ${primaryGuardian?.fullName ?? 'N/A'}`,
    `Guardian Phone: ${primaryGuardian?.primaryPhone ?? 'N/A'}`,
  ];

  if (kind === 'id-card') {
    return [
      ...baseLines,
      'This card identifies the student as currently enrolled in the school.',
    ];
  }

  if (kind === 'transfer-certificate') {
    return [
      ...baseLines,
      `Admission Date: ${student.admissionDate.toISOString().slice(0, 10)}`,
      'The student has been issued this transfer certificate on school request.',
      'Fee and library clearance should be verified before final handover.',
    ];
  }

  if (kind === 'leaving-certificate') {
    return [
      ...baseLines,
      `Admission Date: ${student.admissionDate.toISOString().slice(0, 10)}`,
      'This certifies that the student has completed the leaving process as recorded by the school.',
    ];
  }

  if (kind === 'enrollment-confirmation') {
    return [
      ...baseLines,
      `Admission Date: ${student.admissionDate.toISOString().slice(0, 10)}`,
      `Academic Year: ${latestEnrollment?.academicYear.name ?? 'N/A'}`,
      'This confirms that the student is enrolled as per school records.',
    ];
  }

  return [
    ...baseLines,
    'This is to certify that the student has maintained good conduct as per available school records.',
    'Issued for official use by the school administration.',
  ];
}

function ensureAllowedLifecycleTransition(
  currentStatus: StudentLifecycleStatus,
  nextStatus: StudentLifecycleStatus,
) {
  const allowedTransitions: Record<
    StudentLifecycleStatus,
    StudentLifecycleStatus[]
  > = {
    [StudentLifecycleStatus.ACTIVE]: [
      StudentLifecycleStatus.TRANSFERRED,
      StudentLifecycleStatus.EXITED,
      StudentLifecycleStatus.DELETED,
    ],
    [StudentLifecycleStatus.TRANSFERRED]: [StudentLifecycleStatus.ALUMNI],
    [StudentLifecycleStatus.EXITED]: [StudentLifecycleStatus.ALUMNI],
    [StudentLifecycleStatus.ALUMNI]: [],
    [StudentLifecycleStatus.DELETED]: [],
  };

  if (!allowedTransitions[currentStatus].includes(nextStatus)) {
    throw new ConflictException(
      `Student lifecycle transition ${currentStatus} -> ${nextStatus} is not allowed`,
    );
  }
}

function resolveDocumentRetentionUntil(
  kind: GeneratedStudentDocumentKind,
  generatedAt: Date,
) {
  const retentionDays =
    kind === 'id-card' ? 180 : kind === 'enrollment-confirmation' ? 365 : 3650;

  return new Date(generatedAt.getTime() + retentionDays * 86_400_000);
}

function validateIemisStudent(student: StudentDocumentPayload) {
  const issues: Array<{ field: string; message: string }> = [];
  const hasGuardianContact = student.guardianLinks.some(
    (link) =>
      Boolean(link.guardian.primaryPhone) || Boolean(link.guardian.email),
  );

  if (!student.firstNameEn || !student.lastNameEn) {
    issues.push({
      field: 'fullNameEn',
      message: 'English first and last name are required',
    });
  }

  if (!student.firstNameNp || !student.lastNameNp) {
    issues.push({
      field: 'fullNameNp',
      message: 'Nepali first and last name are required',
    });
  }

  if (!student.dateOfBirth) {
    issues.push({
      field: 'dateOfBirth',
      message: 'Date of birth is required',
    });
  }

  if (!student.gender) {
    issues.push({
      field: 'gender',
      message: 'Gender is required',
    });
  }

  if (!student.classId) {
    issues.push({
      field: 'classId',
      message: 'Class assignment is required',
    });
  }

  if (!student.sectionRef?.name && !student.section) {
    issues.push({
      field: 'section',
      message: 'Section assignment is required',
    });
  }

  if (!hasGuardianContact) {
    issues.push({
      field: 'guardianContact',
      message: 'At least one guardian phone or email contact is required',
    });
  }

  if (student.lifecycleStatus === StudentLifecycleStatus.DELETED) {
    issues.push({
      field: 'lifecycleStatus',
      message: 'Deleted students are not exportable to iEMIS',
    });
  }

  return issues;
}
