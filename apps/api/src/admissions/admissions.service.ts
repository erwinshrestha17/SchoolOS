import {
  BadRequestException,
  ConflictException,
  HttpException,
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
import { StorageService } from '../storage/storage.service';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { StudentRecordsService } from '../student-records/student-records.service';
import { StudentsService } from '../students/students.service';
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

interface AdmissionReferenceContext {
  academicYear: { id: string; startsOn: Date };
  classroom: { id: string; name: string };
  section: { id: string; name: string; classId: string } | null;
}

type AdmissionGuardianInput = CreateAdmissionDto['guardians'][number];
type AdmissionPersistenceClient = Prisma.TransactionClient | PrismaService;

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
    private readonly studentsService: StudentsService,
    private readonly storageService: StorageService,
    private readonly fileRegistryService: FileRegistryService,
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
      take: 100,
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
    const context = await this.validateAdmissionForCreate(dto, actor);

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
        email: dto.email as string,
        password: dto.password as string,
        phone: dto.phone,
        roleIds: [studentRole.id],
        assignedById: actor.userId,
      });
      linkedUserId = managedUser.id;
    }

    const core = await this.prisma.$transaction(
      async (tx) => {
        const studentSystemId =
          dto.studentSystemId ??
          (await this.generateStudentSystemId(
            actor,
            context.academicYear.startsOn,
            tx,
          ));

        const student = await tx.student.create({
          data: {
            tenantId: actor.tenantId,
            userId: linkedUserId,
            studentSystemId,
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
            section: context.section?.name ?? null,
            rollNumber: dto.rollNumber ?? null,
            nationality: dto.nationality ?? 'Nepali',
            motherTongue: dto.motherTongue ?? null,
            disabilityFlag: dto.disabilityFlag || 'No known disability',
            bloodGroup: dto.bloodGroup ?? null,
            religion: dto.religion ?? null,
            ethnicity: dto.ethnicity ?? null,
            citizenshipNo: dto.citizenshipNo ?? null,
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

        if (dto.photo && dto.photoFileName) {
          const stored = await this.storageService.saveBase64Object({
            tenantId: actor.tenantId,
            prefix: `students/${student.id}/photo`,
            fileName: dto.photoFileName,
            contentType: 'image/jpeg',
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

          await tx.student.update({
            where: { id: student.id },
            data: { photoUrl: asset.id },
          });
        }

        if (dto.siblingStudentSystemId) {
          const sibling = await tx.student.findFirst({
            where: {
              tenantId: actor.tenantId,
              studentSystemId: dto.siblingStudentSystemId,
            },
            include: {
              siblingMemberships: { include: { siblingGroup: true } },
            },
          });

          if (sibling) {
            let siblingGroupId: string;
            if (sibling.siblingMemberships.length > 0) {
              siblingGroupId = sibling.siblingMemberships[0].siblingGroupId;
            } else {
              const newGroup = await tx.siblingGroup.create({
                data: {
                  tenantId: actor.tenantId,
                  name: `Sibling-${sibling.studentSystemId}`,
                },
              });
              siblingGroupId = newGroup.id;
              await tx.siblingGroupMember.create({
                data: {
                  tenantId: actor.tenantId,
                  studentId: sibling.id,
                  siblingGroupId,
                },
              });
            }

            await tx.siblingGroupMember.create({
              data: {
                tenantId: actor.tenantId,
                studentId: student.id,
                siblingGroupId,
              },
            });
          }
        }

        const guardianLinks: Array<{
          relation: string;
          guardian: {
            id: string;
            fullName: string;
            primaryPhone: string;
          };
        }> = [];

        for (const guardianInput of dto.guardians) {
          const guardianPhone = normalizeGuardianPhone(
            guardianInput.primaryPhone,
          );
          const guardian = await tx.guardian.upsert({
            where: {
              tenantId_primaryPhone: {
                tenantId: actor.tenantId,
                primaryPhone: guardianPhone,
              },
            },
            update: {
              fullName: guardianInput.fullName.trim(),
              relation: guardianInput.relation.trim(),
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
              fullName: guardianInput.fullName.trim(),
              relation: guardianInput.relation.trim(),
              primaryPhone: guardianPhone,
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
            await tx.studentGuardian.create({
              data: {
                tenantId: actor.tenantId,
                studentId: student.id,
                guardianId: guardian.id,
                relation: guardianInput.relation.trim(),
                isPrimary: guardianInput.isPrimary ?? false,
              },
              include: {
                guardian: true,
              },
            }),
          );
        }

        const enrollment = await tx.enrollment.create({
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

        await tx.auditLog.create({
          data: {
            action: 'create',
            resource: 'admission',
            tenantId: actor.tenantId,
            userId: actor.userId,
            resourceId: enrollment.id,
            after: {
              studentId: student.id,
              studentSystemId: student.studentSystemId,
              academicYearId: dto.academicYearId,
              classId: dto.classId,
              sectionId: dto.sectionId ?? null,
              guardianCount: guardianLinks.length,
            },
          },
        });

        return {
          student,
          enrollment,
          guardians: guardianLinks,
        };
      },
      { isolationLevel: 'Serializable' },
    );

    await this.financeService.assignFeePlansForEnrollment({
      tenantId: actor.tenantId,
      studentId: core.student.id,
      academicYearId: dto.academicYearId,
      classId: dto.classId,
    });

    const initialInvoice = await this.financeService.createInitialInvoice({
      actor,
      studentId: core.student.id,
      academicYearId: dto.academicYearId,
      enrollmentId: core.enrollment.id,
      dueDate: new Date(dto.admissionDate),
    });

    try {
      await this.studentsService.generateStudentDocumentPdf(
        core.student.id,
        'ID_CARD',
        actor,
      );
    } catch (e) {
      // Best effort generation during admission to avoid blocking enrollment
    }

    const documents: Array<
      Awaited<ReturnType<StudentRecordsService['uploadDocument']>>
    > = [];

    for (const documentInput of dto.documents ?? []) {
      documents.push(
        await this.studentRecordsService.uploadDocument(
          {
            ...documentInput,
            studentId: core.student.id,
          },
          actor,
        ),
      );
    }

    await this.auditService.record({
      action: 'admission_side_effects',
      resource: 'admission',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: core.enrollment.id,
      after: {
        studentId: core.student.id,
        invoiceId: initialInvoice?.id ?? null,
        documentCount: documents.length,
        guardianInviteCount: core.guardians.length,
      },
    });

    this.eventEmitter.emit('student.admitted', {
      tenantId: actor.tenantId,
      classId: dto.classId,
      sectionId: dto.sectionId,
      studentId: core.student.id,
      studentName: `${core.student.firstNameEn} ${core.student.lastNameEn}`,
      actor,
    });

    return {
      student: {
        id: core.student.id,
        studentSystemId: core.student.studentSystemId,
        fullNameEn:
          `${core.student.firstNameEn} ${core.student.lastNameEn}`.trim(),
      },
      enrollment: {
        id: core.enrollment.id,
        academicYearId: core.enrollment.academicYearId,
        classId: core.enrollment.classId,
        sectionId: core.enrollment.sectionId,
        rollNumber: core.enrollment.rollNumber,
      },
      guardians: core.guardians.map((link) => ({
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
      take: 100,
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
        const errors: string[] = [];

        try {
          await this.validateAdmissionForCreate(parsed.dto, actor);
        } catch (error) {
          errors.push(formatImportError(error));
        }

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
          errors: [formatImportError(error)],
        });
      }
    }

    await this.auditService.record({
      action: dto.dryRun ? 'bulk_import_validate' : 'bulk_import',
      resource: 'admission',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: {
        totalRows: rows.length,
        dryRun: dto.dryRun ?? false,
        created: results.filter((result) => result.status === 'created').length,
        validated: results.filter((result) => result.status === 'validated')
          .length,
        failed: results.filter((result) => result.status === 'failed').length,
      },
    });

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

  private async validateAdmissionForCreate(
    dto: CreateAdmissionDto,
    actor: AuthContext,
  ): Promise<AdmissionReferenceContext> {
    this.assertGuardianPhoneRequirement(dto.guardians);

    const [academicYear, classroom, section] = await Promise.all([
      this.prisma.academicYear.findFirst({
        where: { id: dto.academicYearId, tenantId: actor.tenantId },
        select: { id: true, startsOn: true },
      }),
      this.prisma.class.findFirst({
        where: { id: dto.classId, tenantId: actor.tenantId },
        select: { id: true, name: true },
      }),
      dto.sectionId
        ? this.prisma.section.findFirst({
            where: { id: dto.sectionId, tenantId: actor.tenantId },
            select: { id: true, name: true, classId: true },
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

    if (section && section.classId !== dto.classId) {
      throw new BadRequestException(
        'Section must belong to the selected class in this tenant',
      );
    }

    if (dto.studentSystemId) {
      await this.assertStudentSystemIdAvailable(dto.studentSystemId, actor);
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

    if (!dto.disabilityFlag && !dto.confirmNoDisability) {
      throw new BadRequestException(
        'You must explicitly confirm "No known disability" (iEMIS requirement) if no disability is specified.',
      );
    }

    return { academicYear, classroom, section };
  }

  private assertGuardianPhoneRequirement(guardians: AdmissionGuardianInput[]) {
    const hasValidPrimaryPhone = guardians.some((guardian) =>
      isValidGuardianPhone(guardian.primaryPhone),
    );

    if (!hasValidPrimaryPhone) {
      throw new BadRequestException(
        'At least one guardian with a valid primary phone number is required',
      );
    }
  }

  private async assertStudentSystemIdAvailable(
    studentSystemId: string,
    actor: AuthContext,
  ) {
    if (!/^SCH-\d{4}-\d{4}$/.test(studentSystemId)) {
      throw new BadRequestException(
        'studentSystemId must use the SCH-YYYY-NNNN format',
      );
    }

    const existing = await this.prisma.student.findFirst({
      where: { tenantId: actor.tenantId, studentSystemId },
    });

    if (existing) {
      throw new ConflictException(
        'Student system ID already exists in this tenant',
      );
    }
  }

  private async generateStudentSystemId(
    actor: AuthContext,
    startsOn: Date,
    client: AdmissionPersistenceClient = this.prisma,
  ) {
    const prefix = `SCH-${startsOn.getUTCFullYear()}-`;
    const count = await client.student.count({
      where: {
        tenantId: actor.tenantId,
        studentSystemId: {
          startsWith: prefix,
        },
      },
    });

    return `${prefix}${String(count + 1).padStart(4, '0')}`;
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
    return this.studentsService.requestTransfer(
      studentId,
      {
        reason: dto.reason,
        destinationSchool: dto.destinationSchool,
        exitedAt: dto.transferDate,
        waiveFeeClearance: dto.waiveFeeCheck,
      },
      actor,
    );
  }

  async exportIemis(actor: AuthContext) {
    return this.studentsService.exportIemis(actor);
  }

  async deleteStudent(studentId: string, actor: AuthContext) {
    return this.studentsService.deleteStudent(
      studentId,
      {
        reason: 'Deleted via admissions compatibility route',
      },
      actor,
    );
  }

  async archiveAlumni(studentId: string, actor: AuthContext) {
    return this.studentsService.archiveAlumni(
      studentId,
      {
        reason: 'Archived via admissions compatibility route',
      },
      actor,
    );
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

function normalizeGuardianPhone(phone: string) {
  return phone.trim().replace(/\s+/g, ' ');
}

function isValidGuardianPhone(phone: string | undefined) {
  if (!phone) {
    return false;
  }

  return /^\+?[0-9][0-9\s-]{6,19}$/.test(normalizeGuardianPhone(phone));
}

function formatImportError(error: unknown) {
  if (error instanceof HttpException) {
    const response = error.getResponse();

    if (typeof response === 'string') {
      return response;
    }

    if (isErrorResponse(response)) {
      return Array.isArray(response.message)
        ? response.message.join('; ')
        : response.message;
    }
  }

  return error instanceof Error ? error.message : 'Unknown import error';
}

function isErrorResponse(
  response: unknown,
): response is { message: string | string[] } {
  return (
    typeof response === 'object' &&
    response !== null &&
    'message' in response &&
    (typeof response.message === 'string' || Array.isArray(response.message))
  );
}
