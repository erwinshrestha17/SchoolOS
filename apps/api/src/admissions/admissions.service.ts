import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EnrollmentStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { encryptSensitiveField } from '../common/security/field-encryption';
import { ConfigService } from '../config/config.service';
import { FinanceService } from '../finance/finance.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { StudentRecordsService } from '../student-records/student-records.service';
import { UsersService } from '../users/users.service';
import {
  buildAdmissionDtoFromCsvRow,
  normalizeAdmissionName,
  parseAdmissionCsv,
} from './admissions.utils';
import { BulkAdmissionImportDto } from './dto/bulk-admission-import.dto';
import { CheckAdmissionDuplicateDto } from './dto/check-admission-duplicate.dto';
import { CreateAdmissionDto } from './dto/create-admission.dto';
import { TransferStudentDto } from './dto/transfer-student.dto';

@Injectable()
export class AdmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly financeService: FinanceService,
    private readonly studentRecordsService: StudentRecordsService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async listAdmissions(actor: AuthContext) {
    const students = await this.prisma.student.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        class: true,
        sectionRef: true,
        guardianLinks: {
          include: {
            guardian: true,
          },
        },
        enrollments: {
          include: {
            academicYear: true,
            section: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        invoices: {
          orderBy: { issuedAt: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            documents: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return students.map((student) => ({
      id: student.id,
      studentSystemId: student.studentSystemId,
      fullNameEn: `${student.firstNameEn} ${student.lastNameEn}`.trim(),
      fullNameNp:
        student.firstNameNp || student.lastNameNp
          ? `${student.firstNameNp ?? ''} ${student.lastNameNp ?? ''}`.trim()
          : null,
      className: student.class.name,
      sectionName: student.sectionRef?.name ?? student.section ?? null,
      rollNumber: student.rollNumber,
      documentCount: student._count.documents,
      guardians: student.guardianLinks.map((link) => ({
        id: link.guardian.id,
        fullName: link.guardian.fullName,
        relation: link.relation,
        primaryPhone: link.guardian.primaryPhone,
        isPrimary: link.isPrimary,
      })),
      latestEnrollment: student.enrollments[0]
        ? {
            id: student.enrollments[0].id,
            academicYear: student.enrollments[0].academicYear.name,
            status: student.enrollments[0].status,
          }
        : null,
      latestInvoice: student.invoices[0]
        ? {
            id: student.invoices[0].id,
            invoiceNumber: student.invoices[0].invoiceNumber,
            status: student.invoices[0].status,
            totalAmount: Number(student.invoices[0].totalAmount),
          }
        : null,
    }));
  }

  async createAdmission(dto: CreateAdmissionDto, actor: AuthContext) {
    const [academicYear, classroom, section] = await Promise.all([
      this.prisma.academicYear.findFirst({
        where: { id: dto.academicYearId, tenantId: actor.tenantId },
      }),
      this.prisma.class.findFirst({
        where: { id: dto.classId, tenantId: actor.tenantId },
      }),
      dto.sectionId
        ? this.prisma.section.findFirst({
            where: { id: dto.sectionId, tenantId: actor.tenantId },
          })
        : Promise.resolve(null),
    ]);

    if (!academicYear) {
      throw new NotFoundException('Academic year not found in this tenant');
    }

    if (!classroom) {
      throw new NotFoundException('Class not found in this tenant');
    }

    if (dto.sectionId && !section) {
      throw new NotFoundException('Section not found in this tenant');
    }

    const duplicateWarnings = await this.checkDuplicateAdmissions(
      {
        firstNameEn: dto.firstNameEn,
        lastNameEn: dto.lastNameEn,
        dateOfBirth: dto.dateOfBirth,
      },
      actor,
    );

    if (duplicateWarnings.matches.length > 0 && !dto.confirmDuplicate) {
      throw new ConflictException({
        message:
          'Possible duplicate admission found. Resubmit with confirmDuplicate=true to continue.',
        duplicates: duplicateWarnings.matches,
      });
    }

    if (dto.rollNumber) {
      const rollConflict = await this.findRollNumberConflict(dto, actor);

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
          dto.studentSystemId ??
          (await this.generateStudentSystemId(actor, academicYear.startsOn)),
        firstNameEn: dto.firstNameEn,
        lastNameEn: dto.lastNameEn,
        firstNameNp: dto.firstNameNp ?? null,
        lastNameNp: dto.lastNameNp ?? null,
        dateOfBirth: new Date(dto.dateOfBirth),
        gender: dto.gender,
        admissionDate: new Date(dto.admissionDate),
        admissionNumber: dto.admissionNumber ?? null,
        classId: dto.classId,
        sectionId: dto.sectionId ?? null,
        section: section?.name ?? null,
        rollNumber: dto.rollNumber ?? null,
        nationality: dto.nationality ?? 'Nepali',
        motherTongue: dto.motherTongue ?? null,
        disabilityFlag: dto.disabilityFlag ?? null,
        mediumOfInstruct: dto.mediumOfInstruction ?? 'English',
        emergencyName: dto.emergencyName ?? null,
        emergencyPhone: dto.emergencyPhone ?? null,
        medicalConditions: encryptSensitiveField(
          dto.medicalConditions,
          this.configService.medicalEncryptionKey,
        ),
        severeAllergies: encryptSensitiveField(
          dto.severeAllergies,
          this.configService.medicalEncryptionKey,
        ),
        medications: encryptSensitiveField(
          dto.medications,
          this.configService.medicalEncryptionKey,
        ),
        specialNeeds: encryptSensitiveField(
          dto.specialNeeds,
          this.configService.medicalEncryptionKey,
        ),
        doctorName: encryptSensitiveField(
          dto.doctorName,
          this.configService.medicalEncryptionKey,
        ),
        doctorPhone: encryptSensitiveField(
          dto.doctorPhone,
          this.configService.medicalEncryptionKey,
        ),
        privacyConsentAt: new Date(),
        dataProcessingConsentedAt: new Date(),
        medicalConsentAt:
          dto.medicalConditions ||
          dto.severeAllergies ||
          dto.medications ||
          dto.specialNeeds
            ? new Date()
            : null,
      },
    });

    const guardianLinks: Array<{
      relation: string;
      guardian: {
        id: string;
        fullName: string;
      };
    }> = [];

    for (const guardianInput of dto.guardians) {
      const guardian = await this.prisma.guardian.upsert({
        where: {
          tenantId_primaryPhone: {
            tenantId: actor.tenantId,
            primaryPhone: guardianInput.primaryPhone,
          },
        },
        update: {
          fullName: guardianInput.fullName,
          relation: guardianInput.relation,
          secondaryPhone: guardianInput.secondaryPhone ?? null,
          email: guardianInput.email ?? null,
          occupation: guardianInput.occupation ?? null,
          homeAddress: guardianInput.homeAddress ?? null,
          wardNumber: guardianInput.wardNumber ?? null,
          receivesAlerts: guardianInput.receivesAlerts ?? false,
          privacyConsentAt: new Date(),
        },
        create: {
          tenantId: actor.tenantId,
          fullName: guardianInput.fullName,
          relation: guardianInput.relation,
          primaryPhone: guardianInput.primaryPhone,
          secondaryPhone: guardianInput.secondaryPhone ?? null,
          email: guardianInput.email ?? null,
          occupation: guardianInput.occupation ?? null,
          homeAddress: guardianInput.homeAddress ?? null,
          wardNumber: guardianInput.wardNumber ?? null,
          receivesAlerts: guardianInput.receivesAlerts ?? false,
          privacyConsentAt: new Date(),
        },
      });

      guardianLinks.push(
        await this.prisma.studentGuardian.create({
          data: {
            tenantId: actor.tenantId,
            studentId: student.id,
            guardianId: guardian.id,
            relation: guardianInput.relation,
            isPrimary: guardianInput.isPrimary ?? false,
          },
          include: {
            guardian: true,
          },
        }),
      );

      if (guardian.email) {
        await this.notificationsService.sendEmail({
          to: guardian.email,
          subject: `${actor.tenantSlug}: admission invitation`,
          text: `${student.firstNameEn} ${student.lastNameEn} has been enrolled in ${classroom.name}.`,
          metadata: {
            purpose: 'guardian_invite',
            studentId: student.id,
          },
        });
      }
    }

    const enrollment = await this.prisma.enrollment.create({
      data: {
        tenantId: actor.tenantId,
        studentId: student.id,
        academicYearId: dto.academicYearId,
        classId: dto.classId,
        sectionId: dto.sectionId ?? null,
        rollNumber: dto.rollNumber ?? null,
        admissionNumber: dto.admissionNumber ?? null,
        admissionDate: new Date(dto.admissionDate),
        mediumOfInstruction: dto.mediumOfInstruction ?? 'English',
      },
    });

    await this.financeService.assignFeePlansForEnrollment({
      tenantId: actor.tenantId,
      studentId: student.id,
      academicYearId: dto.academicYearId,
      classId: dto.classId,
    });

    const initialInvoice = await this.financeService.createInitialInvoice({
      actor,
      studentId: student.id,
      academicYearId: dto.academicYearId,
      enrollmentId: enrollment.id,
      dueDate: new Date(dto.admissionDate),
    });

    const documents: Array<
      Awaited<ReturnType<StudentRecordsService['uploadDocument']>>
    > = [];

    for (const documentInput of dto.documents ?? []) {
      documents.push(
        await this.studentRecordsService.uploadDocument(
          {
            ...documentInput,
            studentId: student.id,
          },
          actor,
        ),
      );
    }

    await this.auditService.record({
      action: 'create',
      resource: 'admission',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: enrollment.id,
      after: {
        studentId: student.id,
        academicYearId: dto.academicYearId,
        classId: dto.classId,
        guardianCount: guardianLinks.length,
        invoiceId: initialInvoice?.id ?? null,
      },
    });

    this.eventEmitter.emit('student.admitted', {
      tenantId: actor.tenantId,
      classId: dto.classId,
      sectionId: dto.sectionId,
      studentId: student.id,
      studentName: `${student.firstNameEn} ${student.lastNameEn}`,
      actor,
    });

    return {
      student: {
        id: student.id,
        studentSystemId: student.studentSystemId,
        fullNameEn: `${student.firstNameEn} ${student.lastNameEn}`.trim(),
      },
      enrollment: {
        id: enrollment.id,
        academicYearId: enrollment.academicYearId,
        classId: enrollment.classId,
        sectionId: enrollment.sectionId,
        rollNumber: enrollment.rollNumber,
      },
      guardians: guardianLinks.map((link) => ({
        id: link.guardian.id,
        fullName: link.guardian.fullName,
        relation: link.relation,
      })),
      documents,
      invoice: initialInvoice
        ? {
            id: initialInvoice.id,
            invoiceNumber: initialInvoice.invoiceNumber,
            totalAmount: Number(initialInvoice.totalAmount),
          }
        : null,
    };
  }

  async checkDuplicateAdmissions(
    dto: CheckAdmissionDuplicateDto,
    actor: AuthContext,
  ) {
    const candidates = await this.prisma.student.findMany({
      where: {
        tenantId: actor.tenantId,
        dateOfBirth: new Date(dto.dateOfBirth),
        ...(dto.excludeStudentId ? { id: { not: dto.excludeStudentId } } : {}),
      },
      include: {
        class: true,
        sectionRef: true,
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    const normalizedFirstName = normalizeAdmissionName(dto.firstNameEn);
    const normalizedLastName = normalizeAdmissionName(dto.lastNameEn);
    const matches = candidates
      .filter(
        (candidate) =>
          normalizeAdmissionName(candidate.firstNameEn) ===
            normalizedFirstName &&
          normalizeAdmissionName(candidate.lastNameEn) === normalizedLastName,
      )
      .map((candidate) => ({
        studentId: candidate.id,
        studentSystemId: candidate.studentSystemId,
        fullNameEn: `${candidate.firstNameEn} ${candidate.lastNameEn}`.trim(),
        dateOfBirth: candidate.dateOfBirth,
        className: candidate.class.name,
        sectionName: candidate.sectionRef?.name ?? candidate.section ?? null,
        rollNumber: candidate.rollNumber,
      }));

    return {
      hasWarnings: matches.length > 0,
      matches,
    };
  }

  async bulkImport(dto: BulkAdmissionImportDto, actor: AuthContext) {
    const rows = parseAdmissionCsv(dto.csvContent);
    const results: Array<{
      rowNumber: number;
      status: 'created' | 'validated' | 'failed';
      studentId?: string;
      studentSystemId?: string;
      errors?: string[];
    }> = [];

    for (const row of rows) {
      const parsed = buildAdmissionDtoFromCsvRow(
        row,
        dto.confirmDuplicates ?? false,
      );

      if (!parsed.dto) {
        results.push({
          rowNumber: row.rowNumber,
          status: 'failed',
          errors: parsed.errors,
        });
        continue;
      }

      if (dto.dryRun) {
        const duplicateWarnings = await this.checkDuplicateAdmissions(
          {
            firstNameEn: parsed.dto.firstNameEn,
            lastNameEn: parsed.dto.lastNameEn,
            dateOfBirth: parsed.dto.dateOfBirth,
          },
          actor,
        );
        const rollConflict = parsed.dto.rollNumber
          ? await this.findRollNumberConflict(parsed.dto, actor)
          : null;
        const errors = [
          ...(duplicateWarnings.matches.length > 0
            ? ['possible duplicate admission']
            : []),
          ...(rollConflict ? ['roll number conflict'] : []),
        ];

        results.push({
          rowNumber: row.rowNumber,
          status: errors.length > 0 ? 'failed' : 'validated',
          errors: errors.length > 0 ? errors : undefined,
        });
        continue;
      }

      try {
        const created = await this.createAdmission(parsed.dto, actor);
        results.push({
          rowNumber: row.rowNumber,
          status: 'created',
          studentId: created.student.id,
          studentSystemId: created.student.studentSystemId,
        });
      } catch (error) {
        results.push({
          rowNumber: row.rowNumber,
          status: 'failed',
          errors: [
            error instanceof Error ? error.message : 'Unknown import error',
          ],
        });
      }
    }

    return {
      totalRows: rows.length,
      created: results.filter((result) => result.status === 'created').length,
      validated: results.filter((result) => result.status === 'validated')
        .length,
      failed: results.filter((result) => result.status === 'failed').length,
      results,
      errorReportCsv: buildBulkImportErrorCsv(results),
    };
  }

  private async generateStudentSystemId(actor: AuthContext, startsOn: Date) {
    const count = await this.prisma.student.count({
      where: { tenantId: actor.tenantId },
    });

    return `SCH-${startsOn.getUTCFullYear()}-${String(count + 1).padStart(4, '0')}`;
  }

  private async findRollNumberConflict(
    dto: Pick<
      CreateAdmissionDto,
      'academicYearId' | 'classId' | 'sectionId' | 'rollNumber'
    >,
    actor: AuthContext,
  ) {
    return this.prisma.enrollment.findFirst({
      where: {
        tenantId: actor.tenantId,
        academicYearId: dto.academicYearId,
        classId: dto.classId,
        sectionId: dto.sectionId ?? null,
        rollNumber: dto.rollNumber,
        status: EnrollmentStatus.ACTIVE,
      },
      include: {
        student: true,
        class: true,
        section: true,
      },
    });
  }

  async inviteGuardian(guardianId: string, actor: AuthContext) {
    const guardian = await this.prisma.guardian.findFirst({
      where: { id: guardianId, tenantId: actor.tenantId },
    });

    if (!guardian) {
      throw new NotFoundException('Guardian not found');
    }

    if (!guardian.email) {
      throw new BadRequestException(
        'Guardian does not have an email address configured',
      );
    }

    await this.notificationsService.sendEmail({
      to: guardian.email,
      subject: `${actor.tenantSlug}: admission invitation`,
      text: `You have been invited to join the parent portal.`,
      metadata: {
        purpose: 'guardian_invite_resend',
      },
    });

    await this.auditService.record({
      action: 'invite',
      resource: 'guardian',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: guardian.id,
    });

    return { success: true };
  }

  async transferStudent(
    studentId: string,
    dto: TransferStudentDto,
    actor: AuthContext,
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId: actor.tenantId },
      include: {
        enrollments: {
          where: { status: EnrollmentStatus.ACTIVE },
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    if (student.enrollments.length === 0) {
      throw new BadRequestException(
        'Student has no active enrollments to transfer',
      );
    }

    if (!dto.waiveFeeCheck) {
      const outstandingInvoices = await this.prisma.invoice.findMany({
        where: {
          tenantId: actor.tenantId,
          studentId: student.id,
          status: { notIn: ['PAID', 'VOID'] },
        },
      });

      if (outstandingInvoices.length > 0) {
        throw new ConflictException({
          message:
            'Cannot generate transfer certificate because the student has outstanding fee balances.',
          outstandingInvoices: outstandingInvoices.map((i) => i.invoiceNumber),
        });
      }
    }

    // Update the active enrollment status
    await this.prisma.enrollment.update({
      where: { id: student.enrollments[0].id },
      data: {
        status: EnrollmentStatus.TRANSFERRED,
      },
    });

    await this.auditService.record({
      action: 'transfer',
      resource: 'student',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: student.id,
      after: {
        reason: dto.reason,
        transferDate: dto.transferDate,
        destinationSchool: dto.destinationSchool,
      },
    });

    this.eventEmitter.emit('student.transferred', {
      tenantId: actor.tenantId,
      studentId: student.id,
      actor,
    });

    return {
      success: true,
      transferCertificateRef: `TC-${new Date().getFullYear()}-${student.studentSystemId}`,
    };
  }

  async exportIemis(actor: AuthContext) {
    const students = await this.prisma.student.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        class: true,
        sectionRef: true,
        guardianLinks: {
          include: { guardian: true },
        },
      },
    });

    // Mock implementation of iEMIS format export
    return students.map((s) => ({
      systemId: s.studentSystemId,
      fullName: `${s.firstNameEn} ${s.lastNameEn}`,
      dob: s.dateOfBirth.toISOString().split('T')[0],
      gender: s.gender,
      class: s.class.name,
      section: s.sectionRef?.name,
      caste: s.nationality,
      motherTongue: s.motherTongue,
      disabilityType: s.disabilityFlag,
    }));
  }

  async deleteStudent(studentId: string, actor: AuthContext) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId: actor.tenantId },
    });

    if (!student) {
      throw new NotFoundException('Student not found in this tenant');
    }

    // Fee balance guard — prevent deletion while outstanding invoices exist
    const outstandingInvoices = await this.prisma.invoice.findMany({
      where: {
        tenantId: actor.tenantId,
        studentId: student.id,
        status: { notIn: ['PAID', 'VOID'] },
      },
    });

    if (outstandingInvoices.length > 0) {
      const totalOutstanding = outstandingInvoices.reduce(
        (sum, inv) => sum + Number(inv.totalAmount),
        0,
      );
      throw new ConflictException({
        message:
          'Cannot delete student with outstanding fee balances. Clear or waive all fees first.',
        outstandingInvoiceCount: outstandingInvoices.length,
        totalOutstandingAmount: totalOutstanding,
        invoiceNumbers: outstandingInvoices.map((i) => i.invoiceNumber),
      });
    }

    // Proceed with soft-delete by marking all enrollments as exited.
    await this.prisma.enrollment.updateMany({
      where: {
        tenantId: actor.tenantId,
        studentId: student.id,
        status: EnrollmentStatus.ACTIVE,
      },
      data: { status: EnrollmentStatus.EXITED },
    });

    await this.auditService.record({
      action: 'delete',
      resource: 'student',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: student.id,
      after: {
        studentSystemId: student.studentSystemId,
        fullNameEn: `${student.firstNameEn} ${student.lastNameEn}`,
      },
    });

    this.eventEmitter.emit('student.withdrawn', {
      tenantId: actor.tenantId,
      studentId: student.id,
      actor,
    });

    return { success: true };
  }

  async archiveAlumni(studentId: string, actor: AuthContext) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId: actor.tenantId },
      include: {
        enrollments: {
          where: { status: EnrollmentStatus.ACTIVE },
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found in this tenant');
    }

    if (student.enrollments.length > 0) {
      throw new ConflictException(
        'Cannot archive a student with active enrollments. Promote or transfer first.',
      );
    }

    // Archive completed promotion records through the existing exit lifecycle.
    await this.prisma.enrollment.updateMany({
      where: {
        tenantId: actor.tenantId,
        studentId: student.id,
        status: { in: [EnrollmentStatus.PROMOTED] },
      },
      data: { status: EnrollmentStatus.EXITED },
    });

    await this.auditService.record({
      action: 'archive_alumni',
      resource: 'student',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: student.id,
      after: { status: 'alumni' },
    });

    return { success: true, status: 'archived_as_alumni' };
  }
}

function buildBulkImportErrorCsv(
  results: Array<{ rowNumber: number; status: string; errors?: string[] }>,
) {
  const failedRows = results.filter((result) => result.status === 'failed');
  const lines = [
    'rowNumber,status,errors',
    ...failedRows.map((result) =>
      [
        result.rowNumber,
        result.status,
        `"${(result.errors ?? []).join('; ').replace(/"/g, '""')}"`,
      ].join(','),
    ),
  ];

  return lines.join('\n');
}
