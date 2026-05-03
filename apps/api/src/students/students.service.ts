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
import { buildCertificatePdf } from '../common/pdf/simple-pdf';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { UsersService } from '../users/users.service';
import { ArchiveStudentDto } from './dto/archive-student.dto';
import { CreateStudentDto } from './dto/create-student.dto';
import { DeleteStudentDto } from './dto/delete-student.dto';
import { InviteGuardianDto } from './dto/invite-guardian.dto';
import { MergeDuplicateStudentDto } from './dto/merge-duplicate-student.dto';
import { CreateGuardianIdentityVerificationDto } from './dto/create-guardian-identity-verification.dto';
import { RequestStudentTransferDto } from './dto/request-student-transfer.dto';
import { RevokeGeneratedStudentDocumentDto } from './dto/revoke-generated-student-document.dto';
import { ReviewGuardianIdentityVerificationDto } from './dto/review-guardian-identity-verification.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { UpdateStudentGuardianDto } from './dto/update-student-guardian.dto';

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly communicationsService: CommunicationsService,
    private readonly auditService: AuditService,
    private readonly storageService: StorageService,
    private readonly fileRegistryService: FileRegistryService,
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

  async getStudentProfile(studentId: string, actor: AuthContext) {
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        tenantId: actor.tenantId,
      },
      include: {
        class: true,
        sectionRef: true,
        guardianLinks: {
          include: {
            guardian: true,
          },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        },
        documents: {
          orderBy: [{ createdAt: 'desc' }],
        },
        generatedDocuments: {
          orderBy: [{ generatedAt: 'desc' }],
        },
        enrollments: {
          include: {
            academicYear: true,
            class: true,
            section: true,
          },
          orderBy: [{ createdAt: 'desc' }],
        },
        invoices: {
          include: {
            lines: {
              include: {
                feeHead: true,
              },
            },
            payments: {
              include: {
                refunds: true,
                receipt: true,
              },
            },
          },
          orderBy: [{ issuedAt: 'desc' }],
          take: 12,
        },
        attendanceRecords: {
          include: {
            attendanceSession: true,
          },
          orderBy: [{ attendanceSession: { attendanceDate: 'desc' } }],
          take: 30,
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found in this tenant');
    }

    const activityPosts = await this.prisma.activityPost.findMany({
      where: {
        tenantId: actor.tenantId,
        OR: [
          {
            studentTags: {
              some: {
                studentId: student.id,
              },
            },
          },
          {
            audienceType: AudienceType.CLASS,
            classId: student.classId,
          },
          {
            audienceType: AudienceType.SECTION,
            classId: student.classId,
            sectionId: student.sectionId,
          },
        ],
      },
      include: {
        attachments: {
          orderBy: [{ sortOrder: 'asc' }],
        },
        studentTags: {
          include: {
            student: true,
          },
        },
        reactions: true,
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 12,
    });

    const registryDocuments = await this.fileRegistryService.listFilesByEntity(
      actor.tenantId,
      'students',
      student.id,
    );

    const latestEnrollment = student.enrollments[0] ?? null;

    let photoUrl = student.photoUrl;
    if (photoUrl && !photoUrl.startsWith('http')) {
      try {
        const signed = await this.fileRegistryService.getSignedUrl(
          actor.tenantId,
          photoUrl,
        );
        photoUrl = signed;
      } catch (e) {
        photoUrl = null;
      }
    }

    const guardians = student.guardianLinks.map((link) => ({
      id: link.guardian.id,
      fullName: link.guardian.fullName,
      relation: link.relation || link.guardian.relation,
      primaryPhone: link.guardian.primaryPhone,
      secondaryPhone: link.guardian.secondaryPhone,
      email: link.guardian.email,
      occupation: link.guardian.occupation,
      wardNumber: link.guardian.wardNumber,
      isPrimary: link.isPrimary,
      consentedAt:
        link.guardian.privacyConsentAt?.toISOString() ??
        student.privacyConsentAt?.toISOString() ??
        null,
    }));

    return {
      student: {
        id: student.id,
        studentSystemId: student.studentSystemId,
        firstNameEn: student.firstNameEn,
        lastNameEn: student.lastNameEn,
        fullNameEn: `${student.firstNameEn} ${student.lastNameEn}`.trim(),
        fullNameNp:
          [student.firstNameNp, student.lastNameNp].filter(Boolean).join(' ') ||
          null,
        gender: student.gender,
        dateOfBirth: student.dateOfBirth.toISOString(),
        motherTongue: student.motherTongue,
        disabilityFlag: student.disabilityFlag,
        nationalStudentId: student.nationalStudentId,
        photoUrl,
        className: student.class.name,
        sectionName: student.sectionRef?.name ?? student.section,
        class: {
          id: student.class.id,
          name: student.class.name,
        },
        section: student.sectionRef?.name ?? student.section,
        rollNumber: student.rollNumber ?? latestEnrollment?.rollNumber ?? null,
        guardians,
        lifecycleStatus: student.lifecycleStatus,
        medicalConditions: student.medicalConditions,
        severeAllergies: student.severeAllergies,
        medications: student.medications,
        specialNeeds: student.specialNeeds,
        emergencyName: student.emergencyName,
        emergencyPhone: student.emergencyPhone,
        doctorName: student.doctorName,
        doctorPhone: student.doctorPhone,
      },
      guardians,
      enrollments: student.enrollments.map((enrollment) => ({
        id: enrollment.id,
        academicYearId: enrollment.academicYearId,
        academicYear: enrollment.academicYear.name,
        classId: enrollment.classId,
        className: enrollment.class.name,
        sectionId: enrollment.sectionId,
        sectionName: enrollment.section?.name ?? null,
        rollNumber: enrollment.rollNumber,
        status: enrollment.status,
        admissionDate: enrollment.admissionDate.toISOString(),
      })),
      documents: [
        ...student.documents.map((document) => ({
          id: document.id,
          studentId: document.studentId,
          kind: document.kind,
          title: document.title,
          fileName: document.fileName,
          contentType: document.contentType,
          sizeBytes: document.sizeBytes,
          provider: document.provider,
          objectKey: document.objectKey,
          publicUrl: document.publicUrl,
          uploadedAt: document.createdAt.toISOString(),
          isLegacy: true,
        })),
        ...registryDocuments.map((asset) => ({
          id: asset.id,
          studentId: student.id,
          kind: (asset.metadata as any)?.kind || 'OTHER',
          title: (asset.metadata as any)?.title || asset.originalFilename,
          fileName: asset.originalFilename,
          contentType: asset.mimeType,
          sizeBytes: Number(asset.sizeBytes),
          provider: 'REGISTRY',
          objectKey: asset.objectKey,
          publicUrl: null,
          uploadedAt: asset.createdAt.toISOString(),
          isLegacy: false,
        })),
      ],
      generatedDocuments: student.generatedDocuments.map((document) => ({
        id: document.id,
        studentId: document.studentId,
        kind: document.kind,
        title: document.title,
        fileName: document.fileName,
        contentType: document.contentType,
        sizeBytes: document.sizeBytes,
        pdfUrl: document.pdfUrl,
        generatedById: document.generatedById,
        generatedAt: document.generatedAt.toISOString(),
        checksumSha256: document.checksumSha256,
        storageObjectKey: document.storageObjectKey,
        signedAt: document.signedAt?.toISOString() ?? null,
        version: document.version,
        retentionUntil: document.retentionUntil?.toISOString() ?? null,
        revokedAt: document.revokedAt?.toISOString() ?? null,
      })),
      invoices: student.invoices.map((invoice) => {
        const paidAmount = sumStudentProfileNetPaidAmount(invoice.payments);

        return {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          status: invoice.status,
          dueDate: invoice.dueDate.toISOString(),
          totalAmount: Number(invoice.totalAmount),
          paidAmount: Number(paidAmount),
          outstandingAmount: Number(
            invoice.totalAmount.sub(paidAmount).gt(0)
              ? invoice.totalAmount.sub(paidAmount)
              : new Prisma.Decimal(0),
          ),
          issuedAt: invoice.issuedAt.toISOString(),
          lines: invoice.lines.map((line) => ({
            id: line.id,
            feeHeadId: line.feeHeadId,
            feeHeadName: line.feeHead.name,
            description: line.description,
            quantity: line.quantity,
            unitAmount: Number(line.unitAmount),
            vatAmount: Number(line.vatAmount),
            totalAmount: Number(line.totalAmount),
          })),
        };
      }),
      attendanceRecords: student.attendanceRecords.map((record) => ({
        id: record.id,
        attendanceDate: record.attendanceSession.attendanceDate
          .toISOString()
          .slice(0, 10),
        status: record.status,
        remark: record.remark,
        lateAt: record.lateAt?.toISOString() ?? null,
        submittedAt:
          record.attendanceSession.submittedAt?.toISOString() ?? null,
      })),
      activityPosts: activityPosts.map((post) => ({
        id: post.id,
        title: post.title,
        caption: post.caption,
        category: post.category,
        audienceType: post.audienceType,
        classId: post.classId,
        sectionId: post.sectionId,
        publishedAt: post.publishedAt?.toISOString() ?? null,
        attachments: post.attachments.map((attachment) => ({
          id: attachment.id,
          fileName: attachment.fileName,
          contentType: attachment.contentType,
          sizeBytes: attachment.sizeBytes,
          provider: attachment.provider,
          objectKey: attachment.objectKey,
          publicUrl: attachment.publicUrl,
        })),
        studentTags: post.studentTags.map((tag) => ({
          studentId: tag.studentId,
          student: tag.student
            ? {
                id: tag.student.id,
                studentSystemId: tag.student.studentSystemId,
                firstNameEn: tag.student.firstNameEn,
                lastNameEn: tag.student.lastNameEn,
              }
            : undefined,
        })),
        reactions: post.reactions.map((reaction) => ({
          id: reaction.id,
          activityPostId: reaction.activityPostId,
          guardianId: reaction.guardianId,
          studentId: reaction.studentId,
          reaction: reaction.reaction,
          createdAt: reaction.createdAt.toISOString(),
        })),
      })),
    };
  }

  async updateStudent(
    studentId: string,
    dto: UpdateStudentDto,
    actor: AuthContext,
  ) {
    if (
      Object.prototype.hasOwnProperty.call(
        dto as Record<string, unknown>,
        'studentSystemId',
      )
    ) {
      throw new BadRequestException('studentSystemId is immutable');
    }

    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        tenantId: actor.tenantId,
      },
      include: {
        enrollments: {
          where: { status: EnrollmentStatus.ACTIVE },
          orderBy: [{ createdAt: 'desc' }],
          take: 1,
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found in this tenant');
    }

    const latestEnrollment = student.enrollments[0] ?? null;
    const nextClassId = dto.classId ?? student.classId;
    const nextSectionId =
      'sectionId' in dto ? dto.sectionId?.trim() || null : student.sectionId;
    const nextRollNumber =
      'rollNumber' in dto ? (dto.rollNumber ?? null) : student.rollNumber;
    const nextDisabilityFlag =
      'disabilityFlag' in dto
        ? normalizeNullableString(dto.disabilityFlag)
        : student.disabilityFlag;

    if (!nextDisabilityFlag && dto.confirmNoDisability !== true) {
      throw new BadRequestException(
        'You must explicitly confirm "No known disability" (iEMIS requirement) if no disability is specified.',
      );
    }

    const placement = await this.assertStudentPlacementForUpdate(
      {
        studentId,
        classId: nextClassId,
        sectionId: nextSectionId,
        rollNumber: nextRollNumber,
        academicYearId: latestEnrollment?.academicYearId ?? null,
      },
      actor,
    );

    const studentData: Prisma.StudentUncheckedUpdateInput = {
      ...(dto.firstNameEn !== undefined
        ? { firstNameEn: assertNonEmpty(dto.firstNameEn, 'firstNameEn') }
        : {}),
      ...(dto.lastNameEn !== undefined
        ? { lastNameEn: assertNonEmpty(dto.lastNameEn, 'lastNameEn') }
        : {}),
      ...(dto.firstNameNp !== undefined
        ? { firstNameNp: normalizeNullableString(dto.firstNameNp) }
        : {}),
      ...(dto.lastNameNp !== undefined
        ? { lastNameNp: normalizeNullableString(dto.lastNameNp) }
        : {}),
      ...(dto.dateOfBirth !== undefined
        ? { dateOfBirth: new Date(dto.dateOfBirth) }
        : {}),
      ...(dto.gender !== undefined ? { gender: dto.gender } : {}),
      ...(dto.nationality !== undefined
        ? { nationality: assertNonEmpty(dto.nationality, 'nationality') }
        : {}),
      ...(dto.motherTongue !== undefined
        ? { motherTongue: normalizeNullableString(dto.motherTongue) }
        : {}),
      ...(dto.ethnicity !== undefined
        ? { ethnicity: normalizeNullableString(dto.ethnicity) }
        : {}),
      ...(dto.disabilityFlag !== undefined
        ? { disabilityFlag: nextDisabilityFlag }
        : {}),
      ...(dto.nationalStudentId !== undefined
        ? { nationalStudentId: normalizeNullableString(dto.nationalStudentId) }
        : {}),
      ...(dto.admissionNumber !== undefined
        ? { admissionNumber: normalizeNullableString(dto.admissionNumber) }
        : {}),
      ...(dto.classId !== undefined ? { classId: nextClassId } : {}),
      ...('sectionId' in dto
        ? {
            sectionId: nextSectionId,
            section: placement.section?.name ?? null,
          }
        : {}),
      ...('rollNumber' in dto ? { rollNumber: nextRollNumber } : {}),
      ...(dto.mediumOfInstruction !== undefined
        ? {
            mediumOfInstruct: assertNonEmpty(
              dto.mediumOfInstruction,
              'mediumOfInstruction',
            ),
          }
        : {}),
      ...(dto.medicalConditions !== undefined
        ? { medicalConditions: normalizeNullableString(dto.medicalConditions) }
        : {}),
      ...(dto.severeAllergies !== undefined
        ? { severeAllergies: normalizeNullableString(dto.severeAllergies) }
        : {}),
      ...(dto.medications !== undefined
        ? { medications: normalizeNullableString(dto.medications) }
        : {}),
      ...(dto.specialNeeds !== undefined
        ? { specialNeeds: normalizeNullableString(dto.specialNeeds) }
        : {}),
      ...(dto.emergencyName !== undefined
        ? { emergencyName: normalizeNullableString(dto.emergencyName) }
        : {}),
      ...(dto.emergencyPhone !== undefined
        ? { emergencyPhone: normalizeNullableString(dto.emergencyPhone) }
        : {}),
      ...(dto.doctorName !== undefined
        ? { doctorName: normalizeNullableString(dto.doctorName) }
        : {}),
      ...(dto.doctorPhone !== undefined
        ? { doctorPhone: normalizeNullableString(dto.doctorPhone) }
        : {}),
    };

    if (dto.photo && dto.photoFileName) {
      const stored = await this.storageService.saveBase64Object({
        tenantId: actor.tenantId,
        prefix: `students/${student.id}/photo`,
        fileName: dto.photoFileName,
        contentType: 'image/jpeg', // Default to jpeg if not specified, or we could extract from base64
        base64Content: dto.photo,
      });

      const asset = await this.fileRegistryService.registerFile({
        tenantId: actor.tenantId,
        uploadedByUserId: actor.userId,
        originalFilename: dto.photoFileName,
        objectKey: stored.objectKey,
        mimeType: 'image/jpeg',
        sizeBytes: stored.sizeBytes,
        module: 'students',
        entityId: student.id,
        metadata: { kind: 'PHOTO', title: 'Student Photo' },
      });

      studentData.photoUrl = asset.id; // Store asset ID as the photoUrl
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.student.update({
        where: { id: student.id },
        data: studentData,
      });

      if (
        latestEnrollment &&
        (dto.classId !== undefined ||
          'sectionId' in dto ||
          'rollNumber' in dto ||
          dto.mediumOfInstruction !== undefined)
      ) {
        await tx.enrollment.update({
          where: { id: latestEnrollment.id },
          data: {
            classId: nextClassId,
            sectionId: nextSectionId,
            rollNumber: nextRollNumber,
            ...(dto.mediumOfInstruction !== undefined
              ? {
                  mediumOfInstruction: assertNonEmpty(
                    dto.mediumOfInstruction,
                    'mediumOfInstruction',
                  ),
                }
              : {}),
          },
        });
      }
    });

    await this.auditService.record({
      action: 'update',
      resource: 'student',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: student.id,
      before: {
        firstNameEn: student.firstNameEn,
        lastNameEn: student.lastNameEn,
        classId: student.classId,
        sectionId: student.sectionId,
        rollNumber: student.rollNumber,
        disabilityFlag: student.disabilityFlag,
      },
      after: {
        firstNameEn: dto.firstNameEn ?? student.firstNameEn,
        lastNameEn: dto.lastNameEn ?? student.lastNameEn,
        classId: nextClassId,
        sectionId: nextSectionId,
        rollNumber: nextRollNumber,
        disabilityFlag: nextDisabilityFlag,
      },
    });

    return this.getStudentProfile(student.id, actor);
  }

  async updateStudentGuardian(
    studentId: string,
    guardianId: string,
    dto: UpdateStudentGuardianDto,
    actor: AuthContext,
  ) {
    const link = await this.prisma.studentGuardian.findFirst({
      where: {
        tenantId: actor.tenantId,
        studentId,
        guardianId,
      },
      include: {
        guardian: true,
      },
    });

    if (!link) {
      throw new NotFoundException(
        'Guardian link not found for this student in this tenant',
      );
    }

    if (dto.primaryPhone && dto.primaryPhone !== link.guardian.primaryPhone) {
      const phoneOwner = await this.prisma.guardian.findFirst({
        where: {
          tenantId: actor.tenantId,
          primaryPhone: dto.primaryPhone,
          id: { not: guardianId },
        },
      });

      if (phoneOwner) {
        throw new ConflictException(
          'Guardian phone number is already used in this tenant',
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary === true) {
        await tx.studentGuardian.updateMany({
          where: {
            tenantId: actor.tenantId,
            studentId,
            id: { not: link.id },
          },
          data: { isPrimary: false },
        });
      }

      await tx.guardian.update({
        where: { id: guardianId },
        data: {
          ...(dto.fullName !== undefined
            ? { fullName: assertNonEmpty(dto.fullName, 'fullName') }
            : {}),
          ...(dto.relation !== undefined
            ? { relation: assertNonEmpty(dto.relation, 'relation') }
            : {}),
          ...(dto.primaryPhone !== undefined
            ? { primaryPhone: assertNonEmpty(dto.primaryPhone, 'primaryPhone') }
            : {}),
          ...(dto.secondaryPhone !== undefined
            ? { secondaryPhone: normalizeNullableString(dto.secondaryPhone) }
            : {}),
          ...(dto.email !== undefined
            ? { email: normalizeNullableString(dto.email) }
            : {}),
          ...(dto.occupation !== undefined
            ? { occupation: normalizeNullableString(dto.occupation) }
            : {}),
          ...(dto.homeAddress !== undefined
            ? { homeAddress: normalizeNullableString(dto.homeAddress) }
            : {}),
          ...(dto.wardNumber !== undefined
            ? { wardNumber: normalizeNullableString(dto.wardNumber) }
            : {}),
        },
      });

      await tx.studentGuardian.update({
        where: { id: link.id },
        data: {
          ...(dto.relation !== undefined
            ? { relation: assertNonEmpty(dto.relation, 'relation') }
            : {}),
          ...(dto.isPrimary !== undefined ? { isPrimary: dto.isPrimary } : {}),
        },
      });
    });

    await this.auditService.record({
      action: 'update',
      resource: 'student_guardian',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: link.id,
      before: {
        guardianId,
        fullName: link.guardian.fullName,
        relation: link.relation || link.guardian.relation,
        primaryPhone: link.guardian.primaryPhone,
        isPrimary: link.isPrimary,
      },
      after: {
        guardianId,
        fullName: dto.fullName ?? link.guardian.fullName,
        relation: dto.relation ?? link.relation ?? link.guardian.relation,
        primaryPhone: dto.primaryPhone ?? link.guardian.primaryPhone,
        isPrimary: dto.isPrimary ?? link.isPrimary,
      },
    });

    return this.getStudentProfile(studentId, actor);
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
    const clearance = await this.getFeeClearance(studentId, actor);

    if (!clearance.cleared) {
      throw new BadRequestException({
        message: 'Fee clearance is required before student exit or archive.',
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

  async mergeDuplicateStudent(
    dto: MergeDuplicateStudentDto,
    actor: AuthContext,
  ) {
    if (dto.sourceStudentId === dto.targetStudentId) {
      throw new BadRequestException(
        'Source and target students must be different records',
      );
    }

    const [sourceStudent, targetStudent] = await Promise.all([
      this.findTenantStudentForDuplicateMerge(dto.sourceStudentId, actor),
      this.findTenantStudentForDuplicateMerge(dto.targetStudentId, actor),
    ]);

    if (sourceStudent.lifecycleStatus !== StudentLifecycleStatus.ACTIVE) {
      throw new ConflictException(
        'Only active duplicate source records can be merged safely',
      );
    }

    if (targetStudent.lifecycleStatus !== StudentLifecycleStatus.ACTIVE) {
      throw new ConflictException(
        'Duplicate records can only be merged into an active canonical student',
      );
    }

    if (!isProbableDuplicateStudent(sourceStudent, targetStudent)) {
      throw new BadRequestException(
        'The selected student records do not match duplicate identity checks',
      );
    }

    ensureAllowedLifecycleTransition(
      sourceStudent.lifecycleStatus,
      StudentLifecycleStatus.DELETED,
    );

    const mergedAt = new Date();
    const missingGuardianLinks = sourceStudent.guardianLinks
      .filter(
        (sourceLink) =>
          !targetStudent.guardianLinks.some(
            (targetLink) => targetLink.guardianId === sourceLink.guardianId,
          ),
      )
      .map((sourceLink) => ({
        tenantId: actor.tenantId,
        studentId: targetStudent.id,
        guardianId: sourceLink.guardianId,
        relation: sourceLink.relation,
        isPrimary:
          !targetStudent.guardianLinks.some((link) => link.isPrimary) &&
          sourceLink.isPrimary,
        appLoginLinked: sourceLink.appLoginLinked,
      }));

    const mergeCounts = await this.prisma.$transaction(async (tx) => {
      const [
        guardianLinks,
        documents,
        generatedDocuments,
        invoices,
        payments,
        feeWaivers,
        notificationDeliveries,
        developmentalMilestones,
        moodLogs,
        libraryIssues,
        transportEnrollments,
        transportLogs,
        conversations,
        conversationParticipants,
      ] = await Promise.all([
        missingGuardianLinks.length > 0
          ? tx.studentGuardian.createMany({
              data: missingGuardianLinks,
              skipDuplicates: true,
            })
          : Promise.resolve({ count: 0 }),
        tx.studentDocument.updateMany({
          where: {
            tenantId: actor.tenantId,
            studentId: sourceStudent.id,
          },
          data: { studentId: targetStudent.id },
        }),
        tx.generatedStudentDocument.updateMany({
          where: {
            tenantId: actor.tenantId,
            studentId: sourceStudent.id,
          },
          data: { studentId: targetStudent.id },
        }),
        tx.invoice.updateMany({
          where: {
            tenantId: actor.tenantId,
            studentId: sourceStudent.id,
          },
          data: { studentId: targetStudent.id },
        }),
        tx.payment.updateMany({
          where: {
            tenantId: actor.tenantId,
            studentId: sourceStudent.id,
          },
          data: { studentId: targetStudent.id },
        }),
        tx.feeWaiver.updateMany({
          where: {
            tenantId: actor.tenantId,
            studentId: sourceStudent.id,
          },
          data: { studentId: targetStudent.id },
        }),
        tx.notificationDelivery.updateMany({
          where: {
            tenantId: actor.tenantId,
            studentId: sourceStudent.id,
          },
          data: { studentId: targetStudent.id },
        }),
        tx.developmentalMilestone.updateMany({
          where: {
            tenantId: actor.tenantId,
            studentId: sourceStudent.id,
          },
          data: { studentId: targetStudent.id },
        }),
        tx.moodLog.updateMany({
          where: {
            tenantId: actor.tenantId,
            studentId: sourceStudent.id,
          },
          data: { studentId: targetStudent.id },
        }),
        tx.libraryIssue.updateMany({
          where: {
            tenantId: actor.tenantId,
            borrowerStudentId: sourceStudent.id,
          },
          data: { borrowerStudentId: targetStudent.id },
        }),
        tx.transportEnrollment.updateMany({
          where: {
            tenantId: actor.tenantId,
            studentId: sourceStudent.id,
          },
          data: { studentId: targetStudent.id },
        }),
        tx.transportLog.updateMany({
          where: {
            tenantId: actor.tenantId,
            studentId: sourceStudent.id,
          },
          data: { studentId: targetStudent.id },
        }),
        tx.conversation.updateMany({
          where: {
            tenantId: actor.tenantId,
            studentId: sourceStudent.id,
          },
          data: { studentId: targetStudent.id },
        }),
        tx.conversationParticipant.updateMany({
          where: {
            tenantId: actor.tenantId,
            studentId: sourceStudent.id,
          },
          data: { studentId: targetStudent.id },
        }),
      ]);

      await tx.enrollment.updateMany({
        where: {
          tenantId: actor.tenantId,
          studentId: sourceStudent.id,
          status: EnrollmentStatus.ACTIVE,
        },
        data: {
          status: EnrollmentStatus.EXITED,
        },
      });

      await tx.student.update({
        where: { id: sourceStudent.id },
        data: {
          lifecycleStatus: StudentLifecycleStatus.DELETED,
          exitReason: dto.reason,
          exitedAt: mergedAt,
        },
      });

      await tx.studentLifecycleTransition.create({
        data: {
          tenantId: actor.tenantId,
          studentId: sourceStudent.id,
          fromStatus: sourceStudent.lifecycleStatus,
          toStatus: StudentLifecycleStatus.DELETED,
          reason: dto.reason,
          changedById: actor.userId,
          feeClearanceWaived: false,
          metadata: {
            mergeType: 'duplicate_student_merge',
            mergedIntoStudentId: targetStudent.id,
            mergedIntoStudentSystemId: targetStudent.studentSystemId,
            mergedAt: mergedAt.toISOString(),
          } as Prisma.InputJsonValue,
        },
      });

      return {
        guardianLinks: guardianLinks.count,
        documents: documents.count,
        generatedDocuments: generatedDocuments.count,
        invoices: invoices.count,
        payments: payments.count,
        feeWaivers: feeWaivers.count,
        notificationDeliveries: notificationDeliveries.count,
        developmentalMilestones: developmentalMilestones.count,
        moodLogs: moodLogs.count,
        libraryIssues: libraryIssues.count,
        transportEnrollments: transportEnrollments.count,
        transportLogs: transportLogs.count,
        conversations: conversations.count,
        conversationParticipants: conversationParticipants.count,
      };
    });

    await this.auditService.record({
      action: 'merge_duplicate',
      resource: 'student',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: sourceStudent.id,
      before: {
        sourceStudentId: sourceStudent.id,
        sourceStudentSystemId: sourceStudent.studentSystemId,
        targetStudentId: targetStudent.id,
        targetStudentSystemId: targetStudent.studentSystemId,
      },
      after: {
        lifecycleStatus: StudentLifecycleStatus.DELETED,
        mergeCounts,
      },
    });

    return {
      sourceStudent: {
        id: sourceStudent.id,
        studentSystemId: sourceStudent.studentSystemId,
        lifecycleStatus: StudentLifecycleStatus.DELETED,
      },
      targetStudent: {
        id: targetStudent.id,
        studentSystemId: targetStudent.studentSystemId,
        lifecycleStatus: targetStudent.lifecycleStatus,
      },
      mergedAt: mergedAt.toISOString(),
      mergeCounts,
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

  async listGuardianIdentityVerifications(
    guardianId: string,
    actor: AuthContext,
  ) {
    await this.findTenantGuardian(guardianId, actor);

    return this.prisma.guardianIdentityVerification.findMany({
      where: {
        tenantId: actor.tenantId,
        guardianId,
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async createGuardianIdentityVerification(
    guardianId: string,
    dto: CreateGuardianIdentityVerificationDto,
    actor: AuthContext,
  ) {
    await this.findTenantGuardian(guardianId, actor);
    await this.ensureGuardianEvidenceDocument(dto.evidenceDocumentId, actor);

    if (!dto.documentNumber && !dto.evidenceDocumentId) {
      throw new BadRequestException(
        'Guardian identity verification requires a document number or evidence document',
      );
    }

    const verification = await this.prisma.guardianIdentityVerification.create({
      data: {
        tenantId: actor.tenantId,
        guardianId,
        status: 'PENDING',
        documentType: dto.documentType,
        documentNumber: dto.documentNumber ?? null,
        evidenceDocumentId: dto.evidenceDocumentId ?? null,
        notes: dto.notes ?? null,
        submittedById: actor.userId,
      },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'guardian_identity_verification',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: verification.id,
      after: {
        guardianId,
        status: verification.status,
        documentType: verification.documentType,
        evidenceDocumentId: verification.evidenceDocumentId,
      },
    });

    return verification;
  }

  async reviewGuardianIdentityVerification(
    guardianId: string,
    verificationId: string,
    dto: ReviewGuardianIdentityVerificationDto,
    actor: AuthContext,
  ) {
    await this.findTenantGuardian(guardianId, actor);
    const verification =
      await this.prisma.guardianIdentityVerification.findFirst({
        where: {
          id: verificationId,
          tenantId: actor.tenantId,
          guardianId,
        },
      });

    if (!verification) {
      throw new NotFoundException(
        'Guardian identity verification not found in this tenant',
      );
    }

    if (verification.status !== 'PENDING') {
      throw new ConflictException(
        'Only pending guardian identity verifications can be reviewed',
      );
    }

    const reviewedAt = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.status === 'VERIFIED') {
        await tx.guardianIdentityVerification.updateMany({
          where: {
            tenantId: actor.tenantId,
            guardianId,
            status: 'VERIFIED',
            id: { not: verification.id },
          },
          data: {
            status: 'REVOKED',
            reviewedById: actor.userId,
            reviewedAt,
            reviewNote:
              'Automatically revoked because a newer verification was approved.',
          },
        });
      }

      return tx.guardianIdentityVerification.update({
        where: { id: verification.id },
        data: {
          status: dto.status,
          reviewedById: actor.userId,
          reviewedAt,
          reviewNote: dto.reviewNote ?? null,
        },
      });
    });

    await this.auditService.record({
      action: 'review',
      resource: 'guardian_identity_verification',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.id,
      before: {
        status: verification.status,
      },
      after: {
        guardianId,
        status: updated.status,
        reviewedAt: updated.reviewedAt,
        reviewNote: updated.reviewNote,
      },
    });

    return updated;
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

    const headers = buildIemisHeaders();
    const rows = validationResults
      .filter((result) => result.issues.length === 0)
      .map(({ student }) => buildIemisRow(student));

    return {
      formatVersion: 'SCHOLOS-IEMIS-1.0',
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
      headers,
      rows,
      csv: buildCsv(headers, rows),
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

    const fileName = `${student.studentSystemId}-${normalizedKind}.pdf`;
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
    const pdf = buildStudentDocumentPdf({
      student,
      kind: normalizedKind,
      actor,
      issuedAt: signedAt,
      version,
    });
    const checksumSha256 = createHash('sha256').update(pdf).digest('hex');
    const stored = await this.storageService.saveBufferObject({
      tenantId: actor.tenantId,
      prefix: `students/${student.id}/generated-documents/${normalizedKind}`,
      fileName,
      contentType: 'application/pdf',
      content: pdf,
    });
    const pdfUrl =
      stored.publicUrl ??
      `/api/v1/students/${student.id}/documents/${normalizedKind}.pdf`;

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
          sizeBytes: stored.sizeBytes,
          pdfUrl,
          generatedById: actor.userId,
          storageObjectKey: stored.objectKey,
          checksumSha256,
          signedAt,
          signatureMetadata: {
            issuerUserId: actor.userId,
            tenantSlug: actor.tenantSlug,
            generatedAt: signedAt.toISOString(),
            mode: 'internal-issued',
            storageProvider: stored.provider,
            storageObjectKey: stored.objectKey,
            signerName: actor.email ?? actor.userId,
            signerRole: actor.roles[0] ?? 'school_official',
            layoutVersion: 'certificate-v2',
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
            storageProvider: stored.provider,
            layoutVersion: 'certificate-v2',
          } as Prisma.InputJsonValue,
        },
      });

      await this.fileRegistryService.registerFile({
        tenantId: actor.tenantId,
        uploadedByUserId: actor.userId,
        originalFilename: fileName,
        objectKey: stored.objectKey,
        mimeType: 'application/pdf',
        sizeBytes: stored.sizeBytes,
        module: 'students',
        entityId: student.id,
        metadata: {
          kind: normalizedKind,
          title: getStudentDocumentTitle(normalizedKind),
          source: 'generated_student_document',
          version,
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

  async processGeneratedDocumentRetention(now = new Date()) {
    const candidates = await this.prisma.generatedStudentDocument.findMany({
      where: {
        revokedAt: { not: null },
        retentionUntil: { lte: now },
      },
      orderBy: [{ retentionUntil: 'asc' }],
      take: 500,
    });
    const eligibleDocuments = candidates.filter(
      (document) =>
        !(
          document.metadata &&
          typeof document.metadata === 'object' &&
          !Array.isArray(document.metadata) &&
          document.metadata['retentionStatus'] === 'eligible_for_purge'
        ),
    );

    for (const document of eligibleDocuments) {
      const metadata =
        document.metadata &&
        typeof document.metadata === 'object' &&
        !Array.isArray(document.metadata)
          ? document.metadata
          : {};

      await this.prisma.generatedStudentDocument.update({
        where: { id: document.id },
        data: {
          metadata: {
            ...metadata,
            retentionStatus: 'eligible_for_purge',
            retentionReviewedAt: now.toISOString(),
          } as Prisma.InputJsonValue,
        },
      });

      await this.auditService.record({
        action: 'retention_mark_eligible',
        resource: 'generated_student_document',
        tenantId: document.tenantId,
        userId: null,
        resourceId: document.id,
        after: {
          studentId: document.studentId,
          kind: document.kind,
          retentionUntil: document.retentionUntil,
          retentionReviewedAt: now,
        },
      });
    }

    return {
      reviewedAt: now.toISOString(),
      eligibleDocuments: candidates.length,
      markedDocuments: eligibleDocuments.length,
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

  private async assertStudentPlacementForUpdate(
    input: {
      studentId: string;
      classId: string;
      sectionId: string | null;
      rollNumber: number | null;
      academicYearId: string | null;
    },
    actor: AuthContext,
  ) {
    const classroom = await this.prisma.class.findFirst({
      where: {
        id: input.classId,
        tenantId: actor.tenantId,
      },
    });

    if (!classroom) {
      throw new NotFoundException('Class not found in this tenant');
    }

    const section = input.sectionId
      ? await this.prisma.section.findFirst({
          where: {
            id: input.sectionId,
            tenantId: actor.tenantId,
            classId: input.classId,
          },
        })
      : null;

    if (input.sectionId && !section) {
      throw new BadRequestException(
        'Section must belong to the selected class in this tenant',
      );
    }

    if (input.rollNumber && input.academicYearId) {
      const rollConflict = await this.prisma.enrollment.findFirst({
        where: {
          tenantId: actor.tenantId,
          academicYearId: input.academicYearId,
          classId: input.classId,
          sectionId: input.sectionId,
          rollNumber: input.rollNumber,
          status: EnrollmentStatus.ACTIVE,
          studentId: { not: input.studentId },
        },
        include: {
          student: true,
          class: true,
          section: true,
        },
      });

      if (rollConflict) {
        throw new ConflictException({
          message:
            'Roll number is already assigned in this academic year, class, and section.',
          conflict: {
            enrollmentId: rollConflict.id,
            studentId: rollConflict.studentId,
            studentSystemId: rollConflict.student.studentSystemId,
            fullNameEn:
              `${rollConflict.student.firstNameEn} ${rollConflict.student.lastNameEn}`.trim(),
            className: rollConflict.class.name,
            sectionName: rollConflict.section?.name ?? null,
            rollNumber: rollConflict.rollNumber,
          },
        });
      }
    }

    return { classroom, section };
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

  private async findTenantStudentForDuplicateMerge(
    studentId: string,
    actor: AuthContext,
  ) {
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        tenantId: actor.tenantId,
      },
      include: {
        guardianLinks: true,
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found in this tenant');
    }

    return student;
  }

  private async findTenantGuardian(guardianId: string, actor: AuthContext) {
    const guardian = await this.prisma.guardian.findFirst({
      where: {
        id: guardianId,
        tenantId: actor.tenantId,
      },
    });

    if (!guardian) {
      throw new NotFoundException('Guardian not found in this tenant');
    }

    return guardian;
  }

  private async ensureGuardianEvidenceDocument(
    evidenceDocumentId: string | undefined,
    actor: AuthContext,
  ) {
    if (!evidenceDocumentId) {
      return null;
    }

    const document = await this.prisma.studentDocument.findFirst({
      where: {
        id: evidenceDocumentId,
        tenantId: actor.tenantId,
      },
    });

    if (!document) {
      throw new NotFoundException(
        'Evidence document was not found in this tenant',
      );
    }

    return document;
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

function buildStudentDocumentPdf(input: {
  student: StudentDocumentPayload;
  kind: GeneratedStudentDocumentKind;
  actor: AuthContext;
  issuedAt: Date;
  version: number;
}) {
  const { student, kind, actor, issuedAt, version } = input;
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
  const title = getStudentDocumentTitle(kind);
  const referenceNumber = `${student.studentSystemId}-${kind}-v${version}`;
  const fields = [
    { label: 'Student ID', value: student.studentSystemId },
    { label: 'Student Name', value: fullName },
    {
      label: 'Date of Birth',
      value: student.dateOfBirth.toISOString().slice(0, 10),
    },
    { label: 'Class', value: student.class.name },
    { label: 'Section', value: sectionName ?? 'N/A' },
    {
      label: 'Roll Number',
      value: student.rollNumber ?? latestEnrollment?.rollNumber ?? 'N/A',
    },
    { label: 'Guardian', value: primaryGuardian?.fullName ?? 'N/A' },
    { label: 'Guardian Phone', value: primaryGuardian?.primaryPhone ?? 'N/A' },
  ];

  if (kind === 'id-card') {
    return buildCertificatePdf({
      schoolName: student.tenant.name,
      title,
      subtitle: 'Operational student identity document',
      referenceNumber,
      issuedAt,
      fields,
      body: [
        'This card identifies the student as currently enrolled in the school.',
      ],
      footer: [
        'This document is valid only when verified against the current SchoolOS student record.',
      ],
      signature: buildSignatureBlock(actor),
    });
  }

  if (kind === 'transfer-certificate') {
    return buildCertificatePdf({
      schoolName: student.tenant.name,
      title,
      subtitle: 'Issued for official school transfer processing',
      referenceNumber,
      issuedAt,
      fields,
      body: [
        `Admission Date: ${student.admissionDate.toISOString().slice(0, 10)}`,
        'The student has been issued this transfer certificate on school request.',
        'Fee and library clearance should be verified before final handover.',
      ],
      footer: [
        'This certificate is internally signed by SchoolOS and retained under the school document retention policy.',
      ],
      signature: buildSignatureBlock(actor),
    });
  }

  if (kind === 'leaving-certificate') {
    return buildCertificatePdf({
      schoolName: student.tenant.name,
      title,
      subtitle: 'Issued for official student leaving records',
      referenceNumber,
      issuedAt,
      fields,
      body: [
        `Admission Date: ${student.admissionDate.toISOString().slice(0, 10)}`,
        'This certifies that the student has completed the leaving process as recorded by the school.',
      ],
      footer: [
        'This certificate is internally signed by SchoolOS and retained under the school document retention policy.',
      ],
      signature: buildSignatureBlock(actor),
    });
  }

  if (kind === 'enrollment-confirmation') {
    return buildCertificatePdf({
      schoolName: student.tenant.name,
      title,
      subtitle: 'Current enrollment confirmation',
      referenceNumber,
      issuedAt,
      fields,
      body: [
        `Admission Date: ${student.admissionDate.toISOString().slice(0, 10)}`,
        `Academic Year: ${latestEnrollment?.academicYear.name ?? 'N/A'}`,
        'This confirms that the student is enrolled as per school records.',
      ],
      footer: [
        'Enrollment validity depends on current lifecycle, fee, and attendance records in SchoolOS.',
      ],
      signature: buildSignatureBlock(actor),
    });
  }

  return buildCertificatePdf({
    schoolName: student.tenant.name,
    title,
    subtitle: 'Conduct and character certificate',
    referenceNumber,
    issuedAt,
    fields,
    body: [
      'This is to certify that the student has maintained good conduct as per available school records.',
      'Issued for official use by the school administration.',
    ],
    footer: [
      'This certificate is internally signed by SchoolOS and retained under the school document retention policy.',
    ],
    signature: buildSignatureBlock(actor),
  });
}

function buildSignatureBlock(actor: AuthContext) {
  return {
    signerName: actor.email ?? actor.userId,
    signerRole: actor.roles[0] ?? 'school_official',
    verificationText:
      'Digitally issued in SchoolOS. Verify using the stored checksum and generated document metadata.',
  };
}

function sumStudentProfileNetPaidAmount(
  payments: Array<{
    amount: Prisma.Decimal;
    refunds: Array<{ amount: Prisma.Decimal }>;
  }>,
) {
  return payments.reduce((sum, payment) => {
    const refunded = payment.refunds.reduce(
      (refundSum, refund) => refundSum.add(refund.amount),
      new Prisma.Decimal(0),
    );

    return sum.add(payment.amount).sub(refunded);
  }, new Prisma.Decimal(0));
}

function buildIemisHeaders() {
  return [
    'studentSystemId',
    'nationalStudentId',
    'firstNameEn',
    'lastNameEn',
    'firstNameNp',
    'lastNameNp',
    'dateOfBirth',
    'gender',
    'nationality',
    'motherTongue',
    'ethnicity',
    'disabilityFlag',
    'admissionDate',
    'admissionNumber',
    'lifecycleStatus',
    'academicYear',
    'className',
    'sectionName',
    'rollNumber',
    'primaryGuardianName',
    'primaryGuardianRelation',
    'primaryGuardianPhone',
    'primaryGuardianEmail',
    'wardNumber',
    'guardianCount',
  ];
}

function buildIemisRow(student: StudentDocumentPayload) {
  const latestEnrollment = student.enrollments[0] ?? null;
  const primaryGuardianLink =
    student.guardianLinks.find((link) => link.isPrimary) ??
    student.guardianLinks[0] ??
    null;
  const primaryGuardian = primaryGuardianLink?.guardian ?? null;

  return {
    studentSystemId: student.studentSystemId,
    nationalStudentId: student.nationalStudentId ?? '',
    firstNameEn: student.firstNameEn,
    lastNameEn: student.lastNameEn,
    firstNameNp: student.firstNameNp ?? '',
    lastNameNp: student.lastNameNp ?? '',
    dateOfBirth: student.dateOfBirth.toISOString().slice(0, 10),
    gender: student.gender,
    nationality: student.nationality ?? '',
    motherTongue: student.motherTongue ?? '',
    ethnicity: student.ethnicity ?? '',
    disabilityFlag: student.disabilityFlag ?? '',
    admissionDate: student.admissionDate.toISOString().slice(0, 10),
    admissionNumber: student.admissionNumber ?? '',
    lifecycleStatus: student.lifecycleStatus,
    academicYear: latestEnrollment?.academicYear.name ?? '',
    className: student.class.name,
    sectionName:
      latestEnrollment?.section?.name ??
      student.sectionRef?.name ??
      student.section ??
      '',
    rollNumber: student.rollNumber ?? '',
    primaryGuardianName: primaryGuardian?.fullName ?? '',
    primaryGuardianRelation: primaryGuardianLink?.relation ?? '',
    primaryGuardianPhone: primaryGuardian?.primaryPhone ?? '',
    primaryGuardianEmail: primaryGuardian?.email ?? '',
    wardNumber: primaryGuardian?.wardNumber ?? '',
    guardianCount: student.guardianLinks.length,
  };
}

function buildCsv(headers: string[], rows: Array<Record<string, unknown>>) {
  return [
    headers.join(','),
    ...rows.map((row) =>
      headers.map((header) => escapeCsvValue(row[header])).join(','),
    ),
  ].join('\n');
}

function escapeCsvValue(value: unknown) {
  const text =
    value === null || typeof value === 'undefined' ? '' : String(value);

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function normalizeNullableString(value: string | null | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

function assertNonEmpty(value: string, field: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new BadRequestException(`${field} cannot be empty`);
  }

  return trimmed;
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

function isProbableDuplicateStudent(
  sourceStudent: {
    firstNameEn: string;
    lastNameEn: string;
    dateOfBirth: Date;
  },
  targetStudent: {
    firstNameEn: string;
    lastNameEn: string;
    dateOfBirth: Date;
  },
) {
  return (
    normalizeStudentIdentityName(sourceStudent.firstNameEn) ===
      normalizeStudentIdentityName(targetStudent.firstNameEn) &&
    normalizeStudentIdentityName(sourceStudent.lastNameEn) ===
      normalizeStudentIdentityName(targetStudent.lastNameEn) &&
    sourceStudent.dateOfBirth.toISOString().slice(0, 10) ===
      targetStudent.dateOfBirth.toISOString().slice(0, 10)
  );
}

function normalizeStudentIdentityName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
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
  const latestEnrollment = student.enrollments[0] ?? null;
  const hasGuardianContact = student.guardianLinks.some(
    (link) =>
      Boolean(link.guardian.primaryPhone) || Boolean(link.guardian.email),
  );

  if (!student.studentSystemId) {
    issues.push({
      field: 'studentSystemId',
      message: 'School student ID is required',
    });
  }

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
  } else if (student.dateOfBirth > new Date()) {
    issues.push({
      field: 'dateOfBirth',
      message: 'Date of birth cannot be in the future',
    });
  }

  if (!student.gender) {
    issues.push({
      field: 'gender',
      message: 'Gender is required',
    });
  }

  if (!student.nationality) {
    issues.push({
      field: 'nationality',
      message: 'Nationality is required',
    });
  }

  if (!student.admissionDate) {
    issues.push({
      field: 'admissionDate',
      message: 'Admission date is required',
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

  if (!latestEnrollment?.academicYear?.name) {
    issues.push({
      field: 'academicYear',
      message: 'Latest academic year enrollment is required',
    });
  }

  if (!hasGuardianContact) {
    issues.push({
      field: 'guardianContact',
      message: 'At least one guardian phone or email contact is required',
    });
  }

  if (student.lifecycleStatus !== StudentLifecycleStatus.ACTIVE) {
    issues.push({
      field: 'lifecycleStatus',
      message: 'Only active students are exportable to iEMIS',
    });
  }

  return issues;
}
