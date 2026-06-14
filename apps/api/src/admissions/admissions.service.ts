import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  EnrollmentStatus,
  Prisma,
  StudentLifecycleStatus,
} from '@prisma/client';
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
import { UsageService } from '../usage/usage.service';
import { UsersService } from '../users/users.service';
import {
  buildAdmissionDtoFromCsvRow,
  normalizeAdmissionName,
  parseAdmissionCsv,
} from './admissions.utils';
import {
  ADMISSION_APPLICATION_STATUSES,
  CreateAdmissionApplicationDto,
  ListAdmissionApplicationsDto,
  UpdateAdmissionApplicationStatusDto,
} from './dto/admission-application.dto';
import { BulkAdmissionImportDto } from './dto/bulk-admission-import.dto';
import { ListAdmissionImportBatchesDto } from './dto/list-admission-import-batches.dto';
import { ListAdmissionsDto } from './dto/list-admissions.dto';
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
interface AdmissionCoreWrite {
  student: {
    id: string;
    studentSystemId: string;
    firstNameEn: string;
    lastNameEn: string;
    admissionDate: Date;
    classId: string;
  };
  enrollment: {
    id: string;
    academicYearId: string;
    classId: string;
    sectionId: string | null;
    rollNumber: number | null;
  };
  guardians: Array<{
    relation: string;
    guardian: {
      id: string;
      fullName: string;
      primaryPhone: string;
    };
  }>;
}

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
    private readonly usageService: UsageService,
  ) {}

  async listAdmissions(query: ListAdmissionsDto, actor: AuthContext) {
    const {
      page = 1,
      limit = 50,
      search,
      academicYearId,
      classId,
      status,
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.StudentWhereInput = {
      tenantId: actor.tenantId,
      ...(classId ? { classId } : {}),
      enrollments: {
        some: {
          tenantId: actor.tenantId,
          ...(academicYearId ? { academicYearId } : {}),
          ...(status ? { status } : {}),
        },
      },
      ...(search
        ? {
            OR: [
              { firstNameEn: { contains: search, mode: 'insensitive' } },
              { lastNameEn: { contains: search, mode: 'insensitive' } },
              { studentSystemId: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, students] = await Promise.all([
      this.prisma.student.count({ where }),
      this.prisma.student.findMany({
        where,
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
        skip,
        take: limit,
      }),
    ]);

    return {
      items: students.map((student) => ({
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
      })),
      total,
      page,
      limit,
      hasNextPage: total > skip + students.length,
    };
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
      if (!dto.email || !dto.password) {
        throw new BadRequestException(
          'Email and password are required when creating a student login',
        );
      }

      const managedUser = await this.usersService.createManagedUser({
        tenantId: actor.tenantId,
        email: dto.email,
        password: dto.password,
        phone: dto.phone,
        roleIds: [studentRole.id],
        assignedById: actor.userId,
      });
      linkedUserId = managedUser.id;
    }

    const core = await this.prisma.$transaction(
      (tx) => this.createAdmissionCore(dto, actor, context, linkedUserId, tx),
      { isolationLevel: 'Serializable' },
    );

    return this.completeAdmissionSideEffects(core, dto, actor);
  }

  async checkDuplicateAdmissions(
    dto: CheckAdmissionDuplicateDto,
    actor: AuthContext,
  ) {
    const inputPhones =
      dto.guardianPhones && dto.guardianPhones.length > 0
        ? dto.guardianPhones.map((p) => normalizeGuardianPhone(p))
        : [];

    const candidates = await this.prisma.student.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(dto.excludeStudentId ? { id: { not: dto.excludeStudentId } } : {}),
        OR: [
          // 1. Exact name (English or Nepali) + Date of Birth
          {
            dateOfBirth: new Date(dto.dateOfBirth),
            OR: [
              {
                firstNameEn: {
                  equals: dto.firstNameEn,
                  mode: 'insensitive' as const,
                },
                lastNameEn: {
                  equals: dto.lastNameEn,
                  mode: 'insensitive' as const,
                },
              },
              ...(dto.firstNameNp && dto.lastNameNp
                ? [
                    {
                      firstNameNp: {
                        equals: dto.firstNameNp,
                        mode: 'insensitive' as const,
                      },
                      lastNameNp: {
                        equals: dto.lastNameNp,
                        mode: 'insensitive' as const,
                      },
                    },
                  ]
                : []),
            ],
          },
          // 2. Name (English or Nepali) + Guardian primary/secondary phone
          ...(inputPhones.length > 0
            ? [
                {
                  OR: [
                    {
                      firstNameEn: {
                        equals: dto.firstNameEn,
                        mode: 'insensitive' as const,
                      },
                      lastNameEn: {
                        equals: dto.lastNameEn,
                        mode: 'insensitive' as const,
                      },
                    },
                    ...(dto.firstNameNp && dto.lastNameNp
                      ? [
                          {
                            firstNameNp: {
                              equals: dto.firstNameNp,
                              mode: 'insensitive' as const,
                            },
                            lastNameNp: {
                              equals: dto.lastNameNp,
                              mode: 'insensitive' as const,
                            },
                          },
                        ]
                      : []),
                  ],
                  guardianLinks: {
                    some: {
                      guardian: {
                        OR: [
                          { primaryPhone: { in: inputPhones } },
                          { secondaryPhone: { in: inputPhones } },
                        ],
                      },
                    },
                  },
                },
                // 3. Sibling matching: Same last name + matching guardian phone
                {
                  OR: [
                    {
                      lastNameEn: {
                        equals: dto.lastNameEn,
                        mode: 'insensitive' as const,
                      },
                    },
                    ...(dto.lastNameNp
                      ? [
                          {
                            lastNameNp: {
                              equals: dto.lastNameNp,
                              mode: 'insensitive' as const,
                            },
                          },
                        ]
                      : []),
                  ],
                  guardianLinks: {
                    some: {
                      guardian: {
                        OR: [
                          { primaryPhone: { in: inputPhones } },
                          { secondaryPhone: { in: inputPhones } },
                        ],
                      },
                    },
                  },
                },
              ]
            : []),
        ],
      },
      include: {
        class: true,
        sectionRef: true,
        guardianLinks: {
          include: {
            guardian: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
    });

    const matches = candidates
      .map((candidate) => {
        const matchTypes: string[] = [];

        const dobMatches =
          new Date(candidate.dateOfBirth).getTime() ===
          new Date(dto.dateOfBirth).getTime();

        const nameEnMatches =
          normalizeAdmissionName(candidate.firstNameEn) ===
            normalizeAdmissionName(dto.firstNameEn) &&
          normalizeAdmissionName(candidate.lastNameEn) ===
            normalizeAdmissionName(dto.lastNameEn);

        const nameNpMatches =
          dto.firstNameNp &&
          dto.lastNameNp &&
          candidate.firstNameNp &&
          candidate.lastNameNp
            ? normalizeAdmissionName(candidate.firstNameNp) ===
                normalizeAdmissionName(dto.firstNameNp) &&
              normalizeAdmissionName(candidate.lastNameNp) ===
                normalizeAdmissionName(dto.lastNameNp)
            : false;

        const nameMatches = nameEnMatches || nameNpMatches;

        const candidatePhones = candidate.guardianLinks
          ? candidate.guardianLinks
              .flatMap((link) => [
                link.guardian.primaryPhone,
                link.guardian.secondaryPhone,
              ])
              .filter((p): p is string => !!p)
              .map((p) => normalizeGuardianPhone(p))
          : [];

        const phoneMatches = inputPhones.some((phone) =>
          candidatePhones.includes(phone),
        );

        const lastNameEnMatches =
          normalizeAdmissionName(candidate.lastNameEn) ===
          normalizeAdmissionName(dto.lastNameEn);

        const lastNameNpMatches =
          dto.lastNameNp && candidate.lastNameNp
            ? normalizeAdmissionName(candidate.lastNameNp) ===
              normalizeAdmissionName(dto.lastNameNp)
            : false;

        const lastNameMatches = lastNameEnMatches || lastNameNpMatches;

        if (nameMatches && dobMatches) {
          matchTypes.push('exact_name_dob');
        }
        if (nameMatches && phoneMatches) {
          matchTypes.push('name_phone');
        }
        if (lastNameMatches && phoneMatches && !nameMatches) {
          matchTypes.push('sibling');
        }

        return {
          studentId: candidate.id,
          studentSystemId: candidate.studentSystemId,
          fullNameEn: `${candidate.firstNameEn} ${candidate.lastNameEn}`.trim(),
          dateOfBirth: candidate.dateOfBirth,
          className: candidate.class.name,
          sectionName: candidate.sectionRef?.name ?? candidate.section ?? null,
          rollNumber: candidate.rollNumber,
          matchTypes,
        };
      })
      .filter((match) => match.matchTypes.length > 0);

    return {
      hasWarnings: matches.length > 0,
      matches,
    };
  }

  async listApplications(
    query: ListAdmissionApplicationsDto,
    actor: AuthContext,
  ) {
    const { page = 1, limit = 25, search, status, classId } = query;
    const skip = (page - 1) * limit;
    const where: Prisma.AdmissionApplicationWhereInput = {
      tenantId: actor.tenantId,
      ...(status ? { status } : {}),
      ...(classId ? { classId } : {}),
      ...(search
        ? {
            OR: [
              { firstNameEn: { contains: search, mode: 'insensitive' } },
              { lastNameEn: { contains: search, mode: 'insensitive' } },
              { guardianFullName: { contains: search, mode: 'insensitive' } },
              { guardianPhone: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.admissionApplication.count({ where }),
      this.prisma.admissionApplication.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      items: items.map(formatAdmissionApplication),
      total,
      page,
      limit,
      hasNextPage: total > skip + items.length,
    };
  }

  async createApplication(
    dto: CreateAdmissionApplicationDto,
    actor: AuthContext,
  ) {
    await this.assertOptionalApplicationReferences(dto, actor);

    const duplicateReview =
      dto.dateOfBirth && (dto.guardianPhone || dto.firstNameEn)
        ? await this.checkDuplicateAdmissions(
            {
              firstNameEn: dto.firstNameEn,
              lastNameEn: dto.lastNameEn,
              firstNameNp: dto.firstNameNp,
              lastNameNp: dto.lastNameNp,
              dateOfBirth: dto.dateOfBirth,
              guardianPhones: dto.guardianPhone ? [dto.guardianPhone] : [],
            },
            actor,
          )
        : null;

    const application = await this.prisma.admissionApplication.create({
      data: {
        tenantId: actor.tenantId,
        status: 'INQUIRY',
        firstNameEn: dto.firstNameEn.trim(),
        lastNameEn: dto.lastNameEn.trim(),
        firstNameNp: dto.firstNameNp?.trim() || null,
        lastNameNp: dto.lastNameNp?.trim() || null,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        gender: dto.gender ?? null,
        guardianFullName: dto.guardianFullName?.trim() || null,
        guardianRelation: dto.guardianRelation?.trim() || null,
        guardianPhone: dto.guardianPhone
          ? normalizeGuardianPhone(dto.guardianPhone)
          : null,
        guardianEmail: dto.guardianEmail?.trim() || null,
        academicYearId: dto.academicYearId ?? null,
        classId: dto.classId ?? null,
        sectionId: dto.sectionId ?? null,
        previousSchool: dto.previousSchool?.trim() || null,
        source: dto.source?.trim() || null,
        notes: dto.notes?.trim() || null,
        duplicateReview: duplicateReview
          ? (duplicateReview as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        createdById: actor.userId,
        updatedById: actor.userId,
      },
    });

    await this.auditService.record({
      action: 'admission_application_create',
      resource: 'admission_application',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: application.id,
      after: {
        status: application.status,
        classId: application.classId,
        duplicateWarnings:
          duplicateReview?.matches?.length && duplicateReview.matches.length > 0
            ? duplicateReview.matches.length
            : 0,
      },
    });

    return formatAdmissionApplication(application);
  }

  async updateApplicationStatus(
    applicationId: string,
    dto: UpdateAdmissionApplicationStatusDto,
    actor: AuthContext,
  ) {
    const application = await this.findTenantApplication(applicationId, actor);
    if (!isAllowedApplicationTransition(application.status, dto.status)) {
      throw new BadRequestException(
        `Admission application transition ${application.status} -> ${dto.status} is not allowed`,
      );
    }

    if (dto.status === 'REJECTED' && !dto.reason?.trim()) {
      throw new BadRequestException(
        'A reason is required to reject an admission application',
      );
    }

    if (dto.status === 'ENROLLED') {
      throw new BadRequestException(
        'Use the application enrollment endpoint so a tenant-owned student record is created and linked.',
      );
    }

    const updatedCount = await this.prisma.admissionApplication.updateMany({
      where: {
        id: application.id,
        tenantId: actor.tenantId,
        status: application.status,
      },
      data: {
        status: dto.status,
        rejectedReason:
          dto.status === 'REJECTED' ? (dto.reason?.trim() ?? null) : null,
        updatedById: actor.userId,
      },
    });
    if (updatedCount.count !== 1) {
      throw new ConflictException(
        'Admission application changed while updating status. Refresh and retry.',
      );
    }

    const updated = await this.findTenantApplication(application.id, actor);

    await this.auditService.record({
      action: 'admission_application_status_update',
      resource: 'admission_application',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: application.id,
      before: { status: application.status },
      after: { status: updated.status, reason: dto.reason?.trim() ?? null },
    });

    return formatAdmissionApplication(updated);
  }

  async enrollApplication(
    applicationId: string,
    dto: CreateAdmissionDto,
    actor: AuthContext,
  ) {
    const application = await this.findTenantApplication(applicationId, actor);
    if (application.convertedStudentId || application.status === 'ENROLLED') {
      throw new ConflictException(
        'Admission application is already linked to an enrolled student',
      );
    }
    if (application.status !== 'ACCEPTED') {
      throw new BadRequestException(
        'Only accepted admission applications can be enrolled',
      );
    }

    const admissionDto: CreateAdmissionDto = Object.assign(
      new CreateAdmissionDto(),
      dto,
      { confirmDuplicate: true },
    );
    const context = await this.validateAdmissionForCreate(admissionDto, actor);

    const { core, updated } = await this.prisma.$transaction(
      async (tx) => {
        const claimed = await tx.admissionApplication.updateMany({
          where: {
            id: application.id,
            tenantId: actor.tenantId,
            status: 'ACCEPTED',
            convertedStudentId: null,
          },
          data: { updatedById: actor.userId },
        });
        if (claimed.count !== 1) {
          throw new ConflictException(
            'Admission application was already enrolled or changed while converting.',
          );
        }

        const conversionCore = await this.createAdmissionCore(
          admissionDto,
          actor,
          context,
          null,
          tx,
        );
        const convertedApplication = await tx.admissionApplication.update({
          where: { id: application.id },
          data: {
            status: 'ENROLLED',
            convertedStudentId: conversionCore.student.id,
            updatedById: actor.userId,
          },
        });

        return { core: conversionCore, updated: convertedApplication };
      },
      { isolationLevel: 'Serializable' },
    );
    const admission = await this.completeAdmissionSideEffects(
      core,
      admissionDto,
      actor,
    );

    await this.auditService.record({
      action: 'admission_application_enroll',
      resource: 'admission_application',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: application.id,
      before: { status: application.status },
      after: {
        status: updated.status,
        studentId: admission.student.id,
      },
    });

    return {
      application: formatAdmissionApplication(updated),
      admission,
    };
  }

  async bulkImport(dto: BulkAdmissionImportDto, actor: AuthContext) {
    const rows = parseAdmissionCsv(dto.csvContent);
    const startedAt = new Date();
    const batch = await this.prisma.admissionImportBatch.create({
      data: {
        tenantId: actor.tenantId,
        sourceFileName: dto.sourceFileName?.trim() || null,
        dryRun: dto.dryRun ?? false,
        confirmDuplicates: dto.confirmDuplicates ?? false,
        status: 'PROCESSING',
        totalRows: rows.length,
        createdById: actor.userId,
        startedAt,
        metadata: {
          source: 'admissions.bulk_import',
          hasHeader: dto.csvContent.trim().split(/\r?\n/).length > 1,
        },
      },
    });
    const results: Array<{
      rowNumber: number;
      status: 'created' | 'validated' | 'failed';
      studentId?: string;
      studentSystemId?: string;
      errors?: string[];
      duplicates?: BulkImportDuplicateWarning[];
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
        let duplicates: BulkImportDuplicateWarning[] = [];

        try {
          await this.validateAdmissionForCreate(parsed.dto, actor);
        } catch (error) {
          errors.push(formatImportError(error));
          duplicates = extractImportDuplicates(error);
        }

        results.push({
          rowNumber: row.rowNumber,
          status: errors.length > 0 ? 'failed' : 'validated',
          errors: errors.length > 0 ? errors : undefined,
          duplicates: duplicates.length > 0 ? duplicates : undefined,
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
        const duplicates = extractImportDuplicates(error);
        results.push({
          rowNumber: row.rowNumber,
          status: 'failed',
          errors: [formatImportError(error)],
          duplicates: duplicates.length > 0 ? duplicates : undefined,
        });
      }
    }

    await this.auditService.record({
      action: dto.dryRun ? 'bulk_import_validate' : 'bulk_import',
      resource: 'admission',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: batch.id,
      after: {
        batchId: batch.id,
        totalRows: rows.length,
        dryRun: dto.dryRun ?? false,
        created: results.filter((result) => result.status === 'created').length,
        validated: results.filter((result) => result.status === 'validated')
          .length,
        failed: results.filter((result) => result.status === 'failed').length,
      },
    });

    const errorReportCsv = buildBulkImportErrorCsv(results);
    const created = results.filter(
      (result) => result.status === 'created',
    ).length;
    const validated = results.filter(
      (result) => result.status === 'validated',
    ).length;
    const failed = results.filter(
      (result) => result.status === 'failed',
    ).length;

    await this.prisma.$transaction(async (tx) => {
      if (results.length > 0) {
        await tx.admissionImportRow.createMany({
          data: results.map((result) => {
            const sourceRow = rows.find(
              (row) => row.rowNumber === result.rowNumber,
            );
            return {
              tenantId: actor.tenantId,
              batchId: batch.id,
              rowNumber: result.rowNumber,
              status: result.status.toUpperCase(),
              studentId: result.studentId ?? null,
              studentSystemId: result.studentSystemId ?? null,
              errors: result.errors
                ? toInputJsonValue(result.errors)
                : Prisma.JsonNull,
              duplicates: result.duplicates
                ? toInputJsonValue(result.duplicates)
                : Prisma.JsonNull,
              rawData: sourceRow?.raw
                ? toInputJsonValue(sourceRow.raw)
                : Prisma.JsonNull,
            };
          }),
        });
      }

      await tx.admissionImportBatch.update({
        where: { id: batch.id },
        data: {
          status: failed > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED',
          createdRows: created,
          validatedRows: validated,
          failedRows: failed,
          errorReportCsv,
          completedAt: new Date(),
        },
      });
    });

    return {
      batchId: batch.id,
      totalRows: rows.length,
      created,
      validated,
      failed,
      results,
      errorReportCsv,
    };
  }

  async listImportBatches(
    query: ListAdmissionImportBatchesDto,
    actor: AuthContext,
  ) {
    const { page = 1, limit = 25, status } = query;
    const skip = (page - 1) * limit;
    const where: Prisma.AdmissionImportBatchWhereInput = {
      tenantId: actor.tenantId,
      ...(status ? { status } : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.admissionImportBatch.count({ where }),
      this.prisma.admissionImportBatch.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
        select: {
          id: true,
          sourceFileName: true,
          dryRun: true,
          confirmDuplicates: true,
          status: true,
          totalRows: true,
          createdRows: true,
          validatedRows: true,
          failedRows: true,
          createdById: true,
          startedAt: true,
          completedAt: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        startedAt: item.startedAt.toISOString(),
        completedAt: item.completedAt?.toISOString() ?? null,
        createdAt: item.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
      hasNextPage: total > skip + items.length,
    };
  }

  async getImportBatch(batchId: string, actor: AuthContext) {
    const batch = await this.prisma.admissionImportBatch.findFirst({
      where: { id: batchId, tenantId: actor.tenantId },
      include: {
        rows: {
          orderBy: { rowNumber: 'asc' },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException('Admission import batch not found');
    }

    return {
      id: batch.id,
      sourceFileName: batch.sourceFileName,
      dryRun: batch.dryRun,
      confirmDuplicates: batch.confirmDuplicates,
      status: batch.status,
      totalRows: batch.totalRows,
      created: batch.createdRows,
      validated: batch.validatedRows,
      failed: batch.failedRows,
      errorReportCsv: batch.errorReportCsv ?? '',
      startedAt: batch.startedAt.toISOString(),
      completedAt: batch.completedAt?.toISOString() ?? null,
      rows: batch.rows.map((row) => ({
        rowNumber: row.rowNumber,
        status: row.status.toLowerCase(),
        studentId: row.studentId ?? undefined,
        studentSystemId: row.studentSystemId ?? undefined,
        errors: normalizeJsonArray(row.errors),
        duplicates: normalizeJsonArray(row.duplicates),
        rawData: row.rawData ?? null,
      })),
    };
  }

  private async createAdmissionCore(
    dto: CreateAdmissionDto,
    actor: AuthContext,
    context: AdmissionReferenceContext,
    linkedUserId: string | null,
    tx: Prisma.TransactionClient,
  ): Promise<AdmissionCoreWrite> {
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

    await tx.studentLifecycleTransition.create({
      data: {
        tenantId: actor.tenantId,
        studentId: student.id,
        fromStatus: null,
        toStatus: StudentLifecycleStatus.ACTIVE,
        reason: 'Initial enrollment via admission',
        changedById: actor.userId,
        feeClearanceWaived: false,
        metadata: {
          admissionDate: student.admissionDate.toISOString(),
          classId: student.classId,
        },
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
        provider: stored.provider,
        bucket: stored.bucket,
        checksumSha256: stored.checksumSha256,
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

    const guardianLinks: AdmissionCoreWrite['guardians'] = [];

    for (const guardianInput of dto.guardians) {
      const guardianPhone = normalizeGuardianPhone(guardianInput.primaryPhone);
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
  }

  private async completeAdmissionSideEffects(
    core: AdmissionCoreWrite,
    dto: CreateAdmissionDto,
    actor: AuthContext,
  ) {
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
    } catch {
      // Best effort generation during admission to avoid blocking enrollment
    }

    const documents: Array<
      Awaited<ReturnType<StudentRecordsService['uploadDocument']>>
    > = [];

    for (const documentInput of dto.documents ?? []) {
      documents.push(
        await this.studentRecordsService.uploadDocument(
          Object.assign({}, documentInput, { studentId: core.student.id }),
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

    await this.usageService.incrementUsage(actor.tenantId, 'students.count');

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

  private async validateAdmissionForCreate(
    dto: CreateAdmissionDto,
    actor: AuthContext,
  ): Promise<AdmissionReferenceContext> {
    this.assertGuardianPhoneRequirement(dto.guardians);

    await this.usageService.checkLimit(actor.tenantId, 'students.count', 1);

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

    const guardianPhones = dto.guardians
      ? dto.guardians
          .map((g) =>
            [g.primaryPhone, g.secondaryPhone].filter((p): p is string => !!p),
          )
          .flat()
      : [];

    const duplicateWarnings = await this.checkDuplicateAdmissions(
      {
        firstNameEn: dto.firstNameEn,
        lastNameEn: dto.lastNameEn,
        dateOfBirth: dto.dateOfBirth,
        firstNameNp: dto.firstNameNp,
        lastNameNp: dto.lastNameNp,
        guardianPhones,
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
    const hasValidPrimaryPhone = guardians.some((guardian) => {
      const phone = guardian.primaryPhone;
      if (!phone) return false;
      const clean = phone.trim().replace(/[\s-()]/g, '');
      return /^(9\d{9}|\+?\d{10,15})$/.test(clean);
    });

    if (!hasValidPrimaryPhone) {
      throw new BadRequestException(
        'At least one guardian with a valid primary phone number is required',
      );
    }
  }

  private async assertOptionalApplicationReferences(
    dto: Pick<
      CreateAdmissionApplicationDto,
      'academicYearId' | 'classId' | 'sectionId'
    >,
    actor: AuthContext,
  ) {
    if (!dto.academicYearId && !dto.classId && !dto.sectionId) {
      return;
    }

    const [academicYear, classroom, section] = await Promise.all([
      dto.academicYearId
        ? this.prisma.academicYear.findFirst({
            where: { id: dto.academicYearId, tenantId: actor.tenantId },
            select: { id: true },
          })
        : Promise.resolve({ id: null }),
      dto.classId
        ? this.prisma.class.findFirst({
            where: { id: dto.classId, tenantId: actor.tenantId },
            select: { id: true },
          })
        : Promise.resolve({ id: null }),
      dto.sectionId
        ? this.prisma.section.findFirst({
            where: { id: dto.sectionId, tenantId: actor.tenantId },
            select: { id: true, classId: true },
          })
        : Promise.resolve(null),
    ]);

    if (dto.academicYearId && !academicYear?.id) {
      throw new NotFoundException('Academic year not found in this tenant');
    }
    if (dto.classId && !classroom?.id) {
      throw new NotFoundException('Class not found in this tenant');
    }
    if (dto.sectionId && !section) {
      throw new NotFoundException('Section not found in this tenant');
    }
    if (section && dto.classId && section.classId !== dto.classId) {
      throw new BadRequestException(
        'Section must belong to the selected class in this tenant',
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

  private async findTenantApplication(
    applicationId: string,
    actor: AuthContext,
  ) {
    const application = await this.prisma.admissionApplication.findFirst({
      where: { id: applicationId, tenantId: actor.tenantId },
    });

    if (!application) {
      throw new NotFoundException('Admission application not found');
    }

    return application;
  }
}

function buildBulkImportErrorCsv(
  results: Array<{
    rowNumber: number;
    status: string;
    errors?: string[];
    duplicates?: BulkImportDuplicateWarning[];
  }>,
) {
  const failedRows = results.filter((result) => result.status === 'failed');
  const lines = [
    'rowNumber,status,errors,duplicateCandidates',
    ...failedRows.map((result) =>
      [
        result.rowNumber,
        result.status,
        `"${(result.errors ?? []).join('; ').replace(/"/g, '""')}"`,
        `"${(result.duplicates ?? [])
          .map(
            (duplicate) =>
              `${duplicate.studentSystemId} ${duplicate.fullNameEn}`,
          )
          .join('; ')
          .replace(/"/g, '""')}"`,
      ].join(','),
    ),
  ];

  return lines.join('\n');
}

function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function formatAdmissionApplication(application: {
  id: string;
  status: string;
  firstNameEn: string;
  lastNameEn: string;
  firstNameNp: string | null;
  lastNameNp: string | null;
  dateOfBirth: Date | null;
  gender: string | null;
  guardianFullName: string | null;
  guardianRelation: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  academicYearId: string | null;
  classId: string | null;
  sectionId: string | null;
  previousSchool: string | null;
  source: string | null;
  notes: string | null;
  duplicateReview: Prisma.JsonValue | null;
  convertedStudentId: string | null;
  rejectedReason: string | null;
  createdById: string | null;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...application,
    fullNameEn: `${application.firstNameEn} ${application.lastNameEn}`.trim(),
    dateOfBirth: application.dateOfBirth?.toISOString() ?? null,
    createdAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),
  };
}

function isAllowedApplicationTransition(current: string, next: string) {
  if (!ADMISSION_APPLICATION_STATUSES.includes(next as never)) {
    return false;
  }

  if (current === next) {
    return true;
  }

  if (current === 'ENROLLED' || current === 'REJECTED') {
    return false;
  }

  const allowed: Record<string, string[]> = {
    INQUIRY: ['APPLICATION', 'DOCUMENT_PENDING', 'REJECTED'],
    APPLICATION: [
      'DOCUMENT_PENDING',
      'ENTRANCE_INTERVIEW',
      'ACCEPTED',
      'REJECTED',
    ],
    DOCUMENT_PENDING: [
      'APPLICATION',
      'ENTRANCE_INTERVIEW',
      'ACCEPTED',
      'REJECTED',
    ],
    ENTRANCE_INTERVIEW: ['DOCUMENT_PENDING', 'ACCEPTED', 'REJECTED'],
    ACCEPTED: ['ENROLLED', 'REJECTED'],
  };

  return allowed[current]?.includes(next) ?? false;
}

function normalizeGuardianPhone(phone: string) {
  return phone.trim().replace(/\s+/g, ' ');
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

interface BulkImportDuplicateWarning {
  studentId: string;
  studentSystemId: string;
  fullNameEn: string;
  dateOfBirth: string | Date;
  className: string;
  sectionName: string | null;
  rollNumber: number | null;
  matchTypes?: string[];
}

function extractImportDuplicates(error: unknown): BulkImportDuplicateWarning[] {
  if (!(error instanceof HttpException)) {
    return [];
  }

  const response = error.getResponse();

  if (
    typeof response === 'object' &&
    response !== null &&
    'duplicates' in response &&
    Array.isArray(response.duplicates)
  ) {
    return response.duplicates.filter(isBulkImportDuplicateWarning);
  }

  return [];
}

function normalizeJsonArray(value: Prisma.JsonValue | null) {
  return Array.isArray(value) ? value : [];
}

function isBulkImportDuplicateWarning(
  value: unknown,
): value is BulkImportDuplicateWarning {
  return (
    typeof value === 'object' &&
    value !== null &&
    'studentId' in value &&
    'studentSystemId' in value &&
    'fullNameEn' in value
  );
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
