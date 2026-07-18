import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  AttendanceStatus,
  AudienceType,
  EnrollmentStatus,
  NotificationChannel,
  Prisma,
  StudentDuplicateReviewStatus,
  StudentLifecycleStatus,
  StudentQrStatus,
} from '@prisma/client';
import sharp from 'sharp';
import {
  formatBsAcademicYear,
  formatBsDate,
  type StudentIemisReadiness,
  type StudentIemisReadinessIssue,
  StudentAttendanceHistory,
  StudentAttendanceHistorySummary,
  StudentModuleSummary,
  toBsDateFromGregorian,
} from '@schoolos/core';
import { AuditService } from '../audit/audit.service';
import { AuthContext } from '../auth/auth.types';
import { CommunicationsService } from '../communications/communications.service';
import { loadSchoolLogoForPdf } from '../common/pdf/school-logo-loader';
import {
  buildCertificatePdf,
  buildIdCardPdf,
  buildRosterPdf,
  getJpegDimensions,
  PdfImage,
} from '../common/pdf/simple-pdf';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { StudentPhotoService } from './student-photo.service';
import { UsageService } from '../usage/usage.service';
import { UsersService } from '../users/users.service';
import { ArchiveStudentDto } from './dto/archive-student.dto';
import { CreateStudentGuardianDto } from './dto/create-student-guardian.dto';
import { CreateStudentDto } from './dto/create-student.dto';
import { ListStudentsDto } from './dto/list-students.dto';
import { DeleteStudentDto } from './dto/delete-student.dto';
import { InviteGuardianDto } from './dto/invite-guardian.dto';
import { MergeDuplicateStudentDto } from './dto/merge-duplicate-student.dto';
import { MergeDuplicateStudentPreviewDto } from './dto/merge-duplicate-student-preview.dto';
import { CreateGuardianIdentityVerificationDto } from './dto/create-guardian-identity-verification.dto';
import { UpsertDocumentExpiryTemplateDto } from './dto/document-expiry-template.dto';
import { RequestStudentTransferDto } from './dto/request-student-transfer.dto';
import { RevokeGeneratedStudentDocumentDto } from './dto/revoke-generated-student-document.dto';
import { ReviewGuardianIdentityVerificationDto } from './dto/review-guardian-identity-verification.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { UpdateStudentGuardianDto } from './dto/update-student-guardian.dto';
import { UploadStudentDocumentDto } from './dto/upload-student-document.dto';
import { AttendanceHistoryQueryDto } from './dto/attendance-history.dto';
import {
  optionalNepalPhone,
  optionalPersonName,
  optionalProfileEmail,
  parseDateOfBirth,
  requireNepalPhone,
  requirePersonName,
} from '../common/validation/contact-profile';

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly communicationsService: CommunicationsService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
    private readonly storageService: StorageService,
    private readonly fileRegistryService: FileRegistryService,
    private readonly usageService: UsageService,
    private readonly studentPhotoService: StudentPhotoService,
  ) {}

  async createStudent(dto: CreateStudentDto, actor: AuthContext) {
    const firstNameEn = requirePersonName(dto.firstNameEn, 'firstNameEn');
    const lastNameEn = requirePersonName(dto.lastNameEn, 'lastNameEn');
    const dateOfBirth = parseDateOfBirth(dto.dateOfBirth);
    const classroom = await this.prisma.class.findFirst({
      where: {
        id: dto.classId,
        tenantId: actor.tenantId,
      },
    });

    if (!classroom) {
      throw new NotFoundException('Class not found in this tenant');
    }

    const currentCount = await this.prisma.student.count({
      where: { tenantId: actor.tenantId, lifecycleStatus: 'ACTIVE' },
    });
    await this.usageService.verifyLimit(
      actor.tenantId,
      'students.count',
      currentCount,
    );

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

    const student = await this.prisma.student.create({
      data: {
        tenantId: actor.tenantId,
        userId: linkedUserId,
        studentSystemId:
          dto.studentSystemId ?? (await this.generateStudentSystemId(actor)),
        firstNameEn,
        lastNameEn,
        firstNameNp: optionalPersonName(dto.firstNameNp, 'firstNameNp'),
        lastNameNp: optionalPersonName(dto.lastNameNp, 'lastNameNp'),
        dateOfBirth,
        gender: dto.gender,
        admissionDate: new Date(dto.admissionDate),
        classId: dto.classId,
        section: dto.section ?? null,
        rollNumber: dto.rollNumber ?? null,
        admissionNumber: dto.admissionNumber ?? null,
        nationality: dto.nationality ?? 'Nepali',
        mediumOfInstruct: dto.mediumOfInstruct ?? 'English',
        emergencyName: optionalPersonName(dto.emergencyName, 'emergencyName'),
        emergencyPhone: optionalNepalPhone(dto.emergencyPhone),
      },
      include: {
        class: true,
        user: true,
      },
    });

    await this.recordLifecycleTransition(
      student.id,
      null, // Initial state
      StudentLifecycleStatus.ACTIVE,
      'Initial enrollment',
      actor,
      {
        admissionDate: student.admissionDate.toISOString(),
        classId: student.classId,
      },
    );

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

    await this.usageService.incrementUsage(actor.tenantId, 'students.count');

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

  async listStudents(query: ListStudentsDto, actor: AuthContext) {
    const {
      page = 1,
      limit = 50,
      search,
      academicYearId,
      classId,
      sectionId,
      status,
    } = query;
    const skip = (page - 1) * limit;
    const where = this.buildStudentDirectoryWhere(
      {
        search,
        academicYearId,
        classId,
        sectionId,
        status,
      },
      actor,
    );

    const [total, students] = await Promise.all([
      this.prisma.student.count({ where }),
      this.prisma.student.findMany({
        where,
        include: {
          class: true,
          sectionRef: true,
          user: true,
          guardianLinks: {
            include: { guardian: true },
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          },
          qrCredentials: {
            where: { status: StudentQrStatus.ACTIVE },
            orderBy: [{ createdAt: 'desc' }],
            take: 1,
          },
          _count: {
            select: {
              documents: {
                where: { status: { not: 'ARCHIVED' } },
              },
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { firstNameEn: 'asc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      items: students.map((student) => ({
        id: student.id,
        studentSystemId: student.studentSystemId,
        firstNameEn: student.firstNameEn,
        lastNameEn: student.lastNameEn,
        firstNameNp: student.firstNameNp,
        lastNameNp: student.lastNameNp,
        fullNameEn: `${student.firstNameEn} ${student.lastNameEn}`.trim(),
        fullNameNp:
          student.firstNameNp || student.lastNameNp
            ? `${student.firstNameNp ?? ''} ${student.lastNameNp ?? ''}`.trim()
            : null,
        gender: student.gender,
        nationality: student.nationality,
        dateOfBirth: student.dateOfBirth.toISOString().slice(0, 10),
        admissionNumber: student.admissionNumber,
        admissionDate: student.admissionDate.toISOString().slice(0, 10),
        class: {
          id: student.class.id,
          name: student.class.name,
        },
        className: student.class.name,
        section: student.section,
        sectionName: student.sectionRef?.name ?? student.section ?? null,
        rollNumber: student.rollNumber,
        guardians: student.guardianLinks.map((link) => ({
          id: link.guardian.id,
          fullName: link.guardian.fullName,
          relation: link.relation,
          primaryPhone: link.guardian.primaryPhone,
          secondaryPhone: link.guardian.secondaryPhone ?? null,
          email: link.guardian.email ?? null,
          occupation: link.guardian.occupation ?? null,
          wardNumber: link.guardian.wardNumber ?? null,
          isPrimary: link.isPrimary,
          consentedAt:
            link.guardian.privacyConsentAt?.toISOString?.() ??
            link.guardian.privacyConsentAt ??
            null,
        })),
        documentCount: student._count.documents,
        email: student.user?.email ?? null,
        hasLogin: Boolean(student.userId),
        lifecycleStatus: student.lifecycleStatus,
        photoVersion: student.photoFileId ?? null,
        qrCredential: student.qrCredentials[0]
          ? {
              id: student.qrCredentials[0].id,
              status: student.qrCredentials[0].status,
              createdById: student.qrCredentials[0].createdById,
              updatedById: student.qrCredentials[0].updatedById,
              expiresAt:
                student.qrCredentials[0].expiresAt?.toISOString() ?? null,
              createdAt: student.qrCredentials[0].createdAt.toISOString(),
              rotatedAt:
                student.qrCredentials[0].rotatedAt?.toISOString() ?? null,
              revokedAt:
                student.qrCredentials[0].revokedAt?.toISOString() ?? null,
              rotateReason: student.qrCredentials[0].rotateReason ?? null,
              revokeReason: student.qrCredentials[0].revokeReason ?? null,
              lastScannedAt:
                student.qrCredentials[0].lastScannedAt?.toISOString() ?? null,
              fileAssetId: student.qrCredentials[0].fileAssetId ?? null,
            }
          : null,
      })),
      total,
      page,
      limit,
      hasNextPage: total > skip + students.length,
    };
  }

  async getStudentModuleSummary(
    query: ListStudentsDto,
    actor: AuthContext,
  ): Promise<StudentModuleSummary> {
    const { search, academicYearId, classId, sectionId, status } = query;
    const where = this.buildStudentDirectoryWhere(
      {
        search,
        academicYearId,
        classId,
        sectionId,
        status,
      },
      actor,
    );

    const [
      totalStudents,
      statusGroups,
      newAdmissions,
      pendingApplications,
      missingDocuments,
      qrActive,
      iemisStudents,
      duplicateCandidates,
    ] = await Promise.all([
      this.prisma.student.count({ where }),
      this.prisma.student.groupBy({
        by: ['lifecycleStatus'],
        where,
        _count: { _all: true },
      }),
      this.prisma.student.count({
        where: {
          ...where,
          createdAt: { gte: startOfCurrentNepalMonth() },
        },
      }),
      this.prisma.admissionApplication.count({
        where: {
          tenantId: actor.tenantId,
          status: {
            in: [
              'INQUIRY',
              'APPLICATION',
              'DOCUMENT_PENDING',
              'ENTRANCE_INTERVIEW',
              'ACCEPTED',
            ],
          },
          ...(classId ? { classId } : {}),
          ...(academicYearId ? { academicYearId } : {}),
          ...(search
            ? {
                OR: [
                  { firstNameEn: { contains: search, mode: 'insensitive' } },
                  { lastNameEn: { contains: search, mode: 'insensitive' } },
                  {
                    guardianFullName: {
                      contains: search,
                      mode: 'insensitive',
                    },
                  },
                  {
                    guardianPhone: { contains: search, mode: 'insensitive' },
                  },
                ],
              }
            : {}),
        },
      }),
      this.prisma.student.count({
        where: {
          ...where,
          documents: {
            none: { status: { not: 'ARCHIVED' } },
          },
        },
      }),
      this.prisma.studentQrCredential.count({
        where: {
          tenantId: actor.tenantId,
          status: StudentQrStatus.ACTIVE,
          student: where,
        },
      }),
      this.prisma.student.findMany({
        where,
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
              class: true,
              section: true,
            },
            orderBy: [{ createdAt: 'desc' }],
          },
        },
      }),
      this.countDuplicateCandidatePairs(where),
    ]);

    const counts = new Map(
      statusGroups.map((group) => [group.lifecycleStatus, group._count._all]),
    );
    const iemisIssues = iemisStudents.reduce((sum, student) => {
      return (
        sum +
        (validateIemisStudent(student).some((issue) => issue.blocking) ? 1 : 0)
      );
    }, 0);

    return {
      totalStudents,
      activeStudents: counts.get(StudentLifecycleStatus.ACTIVE) ?? 0,
      transferredStudents: counts.get(StudentLifecycleStatus.TRANSFERRED) ?? 0,
      exitedStudents: counts.get(StudentLifecycleStatus.EXITED) ?? 0,
      alumniStudents: counts.get(StudentLifecycleStatus.ALUMNI) ?? 0,
      archivedStudents: counts.get(StudentLifecycleStatus.ARCHIVED) ?? 0,
      mergedStudents: counts.get(StudentLifecycleStatus.MERGED) ?? 0,
      deletedStudents: counts.get(StudentLifecycleStatus.DELETED) ?? 0,
      newAdmissions,
      pendingApplications,
      missingDocuments,
      duplicateCandidates,
      iemisReady: iemisStudents.length - iemisIssues,
      iemisIssues,
      qrActive,
      qrMissing: Math.max(0, totalStudents - qrActive),
      byStatus: statusGroups.map((group) => ({
        status: group.lifecycleStatus,
        count: group._count._all,
      })),
      filters: {
        academicYearId: academicYearId ?? null,
        classId: classId ?? null,
        sectionId: sectionId ?? null,
        status: status ?? null,
        search: search?.trim() || null,
      },
    };
  }

  private buildStudentDirectoryWhere(
    filters: Pick<
      ListStudentsDto,
      'academicYearId' | 'classId' | 'sectionId' | 'status' | 'search'
    >,
    actor: AuthContext,
  ): Prisma.StudentWhereInput {
    const search = filters.search?.trim();

    return {
      tenantId: actor.tenantId,
      ...(filters.status ? { lifecycleStatus: filters.status } : {}),
      ...(filters.classId ? { classId: filters.classId } : {}),
      ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
      ...(filters.academicYearId
        ? {
            enrollments: {
              some: {
                tenantId: actor.tenantId,
                academicYearId: filters.academicYearId,
                ...(filters.classId ? { classId: filters.classId } : {}),
                ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
              },
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { firstNameEn: { contains: search, mode: 'insensitive' } },
              { lastNameEn: { contains: search, mode: 'insensitive' } },
              { firstNameNp: { contains: search, mode: 'insensitive' } },
              { lastNameNp: { contains: search, mode: 'insensitive' } },
              { studentSystemId: { contains: search, mode: 'insensitive' } },
              { admissionNumber: { contains: search, mode: 'insensitive' } },
              {
                guardianLinks: {
                  some: {
                    guardian: {
                      OR: [
                        {
                          fullName: {
                            contains: search,
                            mode: 'insensitive',
                          },
                        },
                        {
                          primaryPhone: {
                            contains: search,
                            mode: 'insensitive',
                          },
                        },
                        {
                          secondaryPhone: {
                            contains: search,
                            mode: 'insensitive',
                          },
                        },
                      ],
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };
  }

  private async countDuplicateCandidatePairs(where: Prisma.StudentWhereInput) {
    const students = await this.prisma.student.findMany({
      where: {
        AND: [
          where,
          { lifecycleStatus: { notIn: [StudentLifecycleStatus.DELETED] } },
        ],
      },
      include: {
        class: true,
        sectionRef: {
          include: {
            classTeacher: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        guardianLinks: { include: { guardian: true } },
        siblingMemberships: true,
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 200,
    });

    const pairs = buildDuplicateCandidatePairs(
      students,
      students,
      Math.min(50, Math.max(1, students.length * 2)),
    );

    return pairs.filter((pair) => !pair.blockedReason).length;
  }

  async getStudentProfile(studentId: string, actor: AuthContext) {
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        tenantId: actor.tenantId,
      },
      include: {
        class: true,
        sectionRef: {
          include: {
            classTeacher: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
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
        identities: true,
        qrCredentials: {
          where: { status: 'ACTIVE' },
          select: {
            id: true,
            status: true,
            createdAt: true,
            rotatedAt: true,
            lastScannedAt: true,
            fileAssetId: true,
          },
          take: 1,
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found in this tenant');
    }

    if (
      actor.roles.some(
        (role) => role === 'teacher' || role === 'subject_teacher',
      ) &&
      !actor.roles.some((role) => role === 'admin' || role === 'principal')
    ) {
      const activeEnrollment = student.enrollments.find(
        (enrollment) => enrollment.status === EnrollmentStatus.ACTIVE,
      );
      const assignment = activeEnrollment
        ? await this.prisma.subjectTeacherAssignment.findFirst({
            where: {
              tenantId: actor.tenantId,
              staff: { userId: actor.userId },
              classId: activeEnrollment.classId,
              OR: [
                { sectionId: activeEnrollment.sectionId },
                { sectionId: null },
              ],
            },
            select: { id: true },
          })
        : null;

      if (!assignment) {
        throw new ForbiddenException(
          'Student profile is outside your teaching scope',
        );
      }
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

    const registryDocuments =
      (await this.fileRegistryService.listFilesByEntity(
        actor.tenantId,
        'students',
        student.id,
      )) || [];

    const latestEnrollment = (student.enrollments || [])[0] ?? null;
    const classTeacher = student.sectionRef?.classTeacher
      ? {
          id: student.sectionRef.classTeacher.id,
          fullName: [
            student.sectionRef.classTeacher.firstName,
            student.sectionRef.classTeacher.lastName,
          ]
            .filter(Boolean)
            .join(' ')
            .trim(),
        }
      : null;

    const photoVersion = student.photoFileId ?? null;

    const guardians = (student.guardianLinks || []).map((link) => ({
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

    const identities = (student.identities || []).filter(
      (id) => id.status === 'ACTIVE',
    );

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
        photoVersion,
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
        studentIdentityCode: student.studentIdentityCode ?? null,
        activeIdentity: identities[0]?.identityCode ?? null,
        qrCredential: (student.qrCredentials ?? [])[0]
          ? {
              id: student.qrCredentials[0].id,
              status: student.qrCredentials[0].status,
              createdAt: student.qrCredentials[0].createdAt.toISOString(),
              rotatedAt:
                student.qrCredentials[0].rotatedAt?.toISOString() ?? null,
              lastScannedAt:
                student.qrCredentials[0].lastScannedAt?.toISOString() ?? null,
              fileAssetId: student.qrCredentials[0].fileAssetId ?? null,
            }
          : null,
        classTeacher,
      },
      guardians,
      enrollments: (student.enrollments || []).map((enrollment) => ({
        id: enrollment.id,
        academicYearId: enrollment.academicYearId,
        academicYear: enrollment.academicYear?.startsOn
          ? formatBsAcademicYear(
              toBsDateFromGregorian(enrollment.academicYear.startsOn),
            )
          : enrollment.academicYear?.name,
        classId: enrollment.classId,
        className: enrollment.class.name,
        sectionId: enrollment.sectionId,
        sectionName: enrollment.section?.name ?? null,
        rollNumber: enrollment.rollNumber,
        status: enrollment.status,
        admissionDate: enrollment.admissionDate.toISOString(),
        classTeacher:
          enrollment.sectionId === student.sectionId ? classTeacher : null,
      })),
      documents: [
        ...(student.documents || []).map((document) => ({
          id: document.id,
          studentId: document.studentId,
          kind: document.kind,
          status: document.status,
          title: document.title,
          fileName: document.fileName,
          contentType: document.contentType,
          sizeBytes: document.sizeBytes,
          provider: document.provider,
          objectKey: document.objectKey,
          publicUrl: document.publicUrl,
          notes: document.notes,
          expiryDate: document.expiryDate?.toISOString() ?? null,
          verifiedAt: document.verifiedAt?.toISOString() ?? null,
          verifiedById: document.verifiedById,
          uploadedById: document.uploadedById,
          uploadedAt: document.createdAt.toISOString(),
          isLegacy: true,
        })),
        ...registryDocuments.map((asset) => {
          const metadata = asset.metadata as Prisma.JsonObject;
          return {
            id: asset.id,
            studentId: student.id,
            kind: (metadata?.kind as string) || 'OTHER',
            title: (metadata?.title as string) || asset.originalFilename,
            fileName: asset.originalFilename,
            contentType: asset.mimeType,
            sizeBytes: Number(asset.sizeBytes),
            provider: 'REGISTRY',
            objectKey: asset.objectKey,
            publicUrl: null,
            uploadedAt: asset.createdAt.toISOString(),
            isLegacy: false,
          };
        }),
      ],
      generatedDocuments: (student.generatedDocuments || []).map(
        (document) => ({
          id: document.id,
          studentId: document.studentId,
          kind: document.kind,
          title: document.title,
          fileName: document.fileName,
          contentType: document.contentType,
          sizeBytes: document.sizeBytes,
          generatedById: document.generatedById,
          generatedAt: document.generatedAt.toISOString(),
          signedAt: document.signedAt?.toISOString() ?? null,
          version: document.version,
          retentionUntil: document.retentionUntil?.toISOString() ?? null,
          revokedAt: document.revokedAt?.toISOString() ?? null,
        }),
      ),
      invoices: (student.invoices || []).map((invoice) => {
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
      attendanceRecords: (student.attendanceRecords || []).map((record) => ({
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

  async getAttendanceHistory(
    studentId: string,
    query: AttendanceHistoryQueryDto,
    actor: AuthContext,
  ): Promise<StudentAttendanceHistory> {
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        tenantId: actor.tenantId,
      },
      include: {
        class: true,
        sectionRef: true,
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found in this tenant');
    }

    const where: Prisma.AttendanceRecordWhereInput = {
      studentId,
      tenantId: actor.tenantId,
      attendanceSession: {
        attendanceDate: {
          gte: query.fromDate ? new Date(query.fromDate) : undefined,
          lte: query.toDate ? new Date(query.toDate) : undefined,
        },
        academicYearId: query.academicYearId,
      },
      status: query.status,
    };

    const records = await this.prisma.attendanceRecord.findMany({
      where,
      include: {
        attendanceSession: {
          include: {
            class: true,
            section: true,
            submittedBy: {
              include: {
                staff: true,
              },
            },
          },
        },
      },
      orderBy: {
        attendanceSession: {
          attendanceDate: 'desc',
        },
      },
    });

    const summary: StudentAttendanceHistorySummary = {
      presentCount: records.filter((r) => r.status === AttendanceStatus.PRESENT)
        .length,
      absentCount: records.filter((r) => r.status === AttendanceStatus.ABSENT)
        .length,
      lateCount: records.filter((r) => r.status === AttendanceStatus.LATE)
        .length,
      leaveCount: records.filter((r) => r.status === AttendanceStatus.LEAVE)
        .length,
      sickLeaveCount: records.filter(
        (r) => r.status === AttendanceStatus.SICK_LEAVE,
      ).length,
      excusedLeaveCount: records.filter(
        (r) => r.status === AttendanceStatus.EXCUSED_LEAVE,
      ).length,
      unexcusedLeaveCount: records.filter(
        (r) => r.status === AttendanceStatus.UNEXCUSED_LEAVE,
      ).length,
      totalRecords: records.length,
      attendancePercentage: records.length
        ? Math.round(
            (records.filter(
              (r) =>
                r.status === AttendanceStatus.PRESENT ||
                r.status === AttendanceStatus.LATE,
            ).length /
              records.length) *
              10000,
          ) / 100
        : 100,
    };

    return {
      student: {
        id: student.id,
        studentSystemId: student.studentSystemId,
        fullNameEn: `${student.firstNameEn} ${student.lastNameEn}`.trim(),
        className: student.class.name,
        sectionName: student.sectionRef?.name ?? student.section ?? null,
      },
      summary,
      records: records.map((record) => ({
        id: record.id,
        sessionId: record.attendanceSessionId,
        date: record.attendanceSession.attendanceDate.toISOString(),
        status: record.status,
        remarks: record.remark,
        className: record.attendanceSession.class.name,
        sectionName: record.attendanceSession.section?.name ?? null,
        markedByUserId: record.attendanceSession.submittedById,
        markedByName: record.attendanceSession.submittedBy?.staff
          ? `${record.attendanceSession.submittedBy.staff.firstName} ${record.attendanceSession.submittedBy.staff.lastName}`.trim()
          : (record.attendanceSession.submittedBy?.email ?? null),
        submittedAt:
          record.attendanceSession.submittedAt?.toISOString() ?? null,
      })),
    };
  }

  async updateStudent(
    studentId: string,
    dto: UpdateStudentDto,
    actor: AuthContext,
  ) {
    if (Object.prototype.hasOwnProperty.call(dto, 'studentSystemId')) {
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
        ? { firstNameEn: requirePersonName(dto.firstNameEn, 'firstNameEn') }
        : {}),
      ...(dto.lastNameEn !== undefined
        ? { lastNameEn: requirePersonName(dto.lastNameEn, 'lastNameEn') }
        : {}),
      ...(dto.firstNameNp !== undefined
        ? { firstNameNp: optionalPersonName(dto.firstNameNp, 'firstNameNp') }
        : {}),
      ...(dto.lastNameNp !== undefined
        ? { lastNameNp: optionalPersonName(dto.lastNameNp, 'lastNameNp') }
        : {}),
      ...(dto.dateOfBirth !== undefined
        ? { dateOfBirth: parseDateOfBirth(dto.dateOfBirth) }
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
        ? {
            emergencyName: optionalPersonName(
              dto.emergencyName,
              'emergencyName',
            ),
          }
        : {}),
      ...(dto.emergencyPhone !== undefined
        ? { emergencyPhone: optionalNepalPhone(dto.emergencyPhone) }
        : {}),
      ...(dto.doctorName !== undefined
        ? { doctorName: normalizeNullableString(dto.doctorName) }
        : {}),
      ...(dto.doctorPhone !== undefined
        ? { doctorPhone: optionalNepalPhone(dto.doctorPhone) }
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
        provider: stored.provider,
        bucket: stored.bucket,
        checksumSha256: stored.checksumSha256,
        module: 'students',
        entityId: student.id,
        metadata: {
          kind: 'PHOTO',
          title: 'Student Photo',
        },
      });

      studentData.photoFileId = asset.id;
      studentData.photoUrl = asset.id; // Keep legacy for now
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

      if (dto.classId !== undefined && dto.classId !== student.classId) {
        await tx.studentLifecycleTransition.create({
          data: {
            tenantId: actor.tenantId,
            studentId: student.id,
            fromStatus: student.lifecycleStatus,
            toStatus: student.lifecycleStatus,
            reason: 'Class placement updated',
            changedById: actor.userId,
            metadata: {
              classChange: true,
              fromClassId: student.classId,
              toClassId: dto.classId,
            },
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

    const siblingLinks = await this.prisma.studentGuardian.findMany({
      where: {
        tenantId: actor.tenantId,
        studentId,
      },
      select: { id: true, guardianId: true, isPrimary: true },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });

    if (dto.isPrimary === false && link.isPrimary) {
      throw new BadRequestException(
        'Choose another primary guardian before removing this one.',
      );
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
            ? { fullName: requirePersonName(dto.fullName, 'fullName') }
            : {}),
          ...(dto.primaryPhone !== undefined
            ? { primaryPhone: requireNepalPhone(dto.primaryPhone) }
            : {}),
          ...(dto.secondaryPhone !== undefined
            ? { secondaryPhone: optionalNepalPhone(dto.secondaryPhone) }
            : {}),
          ...(dto.email !== undefined
            ? { email: optionalProfileEmail(dto.email) }
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
          ...(dto.isPrimary !== undefined
            ? { isPrimary: dto.isPrimary || siblingLinks.length === 1 }
            : {}),
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

  async addStudentGuardian(
    studentId: string,
    dto: CreateStudentGuardianDto,
    actor: AuthContext,
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId: actor.tenantId },
      select: { id: true },
    });
    if (!student) {
      throw new NotFoundException('Student not found in this tenant');
    }

    const existingLinks = await this.prisma.studentGuardian.findMany({
      where: { tenantId: actor.tenantId, studentId },
      select: { id: true, guardianId: true, isPrimary: true },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
    if (existingLinks.length >= 2) {
      throw new BadRequestException('This student already has two guardians.');
    }

    const relation = assertNonEmpty(dto.relation, 'relation');
    const shouldBePrimary =
      existingLinks.length === 0 || dto.isPrimary === true;

    const result = await this.prisma.$transaction(async (tx) => {
      let guardian: {
        id: string;
        fullName: string;
        primaryPhone: string;
        relation: string;
      } | null = null;

      if (dto.guardianId) {
        guardian = await tx.guardian.findFirst({
          where: { id: dto.guardianId, tenantId: actor.tenantId },
          select: {
            id: true,
            fullName: true,
            primaryPhone: true,
            relation: true,
          },
        });
        if (!guardian) {
          throw new NotFoundException('Guardian not found in this tenant');
        }
      }

      if (!guardian) {
        if (!dto.fullName || !dto.primaryPhone) {
          throw new BadRequestException(
            'Guardian full name and primary phone are required.',
          );
        }
        guardian = await tx.guardian.create({
          data: {
            tenantId: actor.tenantId,
            fullName: requirePersonName(dto.fullName, 'fullName'),
            relation,
            primaryPhone: requireNepalPhone(dto.primaryPhone),
            secondaryPhone: optionalNepalPhone(dto.secondaryPhone),
            email: optionalProfileEmail(dto.email),
            occupation: normalizeNullableString(dto.occupation),
            homeAddress: normalizeNullableString(dto.homeAddress),
            wardNumber: normalizeNullableString(dto.wardNumber),
          },
          select: {
            id: true,
            fullName: true,
            primaryPhone: true,
            relation: true,
          },
        });
      }

      if (existingLinks.some((link) => link.guardianId === guardian.id)) {
        throw new ConflictException(
          'This guardian is already linked to the student.',
        );
      }

      if (shouldBePrimary) {
        await tx.studentGuardian.updateMany({
          where: { tenantId: actor.tenantId, studentId },
          data: { isPrimary: false },
        });
      }

      const link = await tx.studentGuardian.create({
        data: {
          tenantId: actor.tenantId,
          studentId,
          guardianId: guardian.id,
          relation,
          isPrimary: shouldBePrimary,
        },
      });

      return { guardian, link };
    });

    await this.auditService.record({
      action: 'create',
      resource: 'student_guardian',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: result.link.id,
      after: {
        studentId,
        guardianId: result.guardian.id,
        relation,
        isPrimary: result.link.isPrimary,
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

  async previewMergeDuplicateStudent(
    dto: MergeDuplicateStudentPreviewDto,
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

    const financialSummary = await this.prisma.student.findUnique({
      where: { id: sourceStudent.id },
      select: {
        _count: {
          select: {
            invoices: true,
            payments: true,
            studentFeeAssignments: true,
            guardianLinks: true,
            documents: true,
            generatedDocuments: true,
            notificationDeliveries: true,
            developmentalMilestones: true,
            moodLogs: true,
            libraryIssues: true,
            transportEnrollments: true,
            transportLogs: true,
            attendanceRecords: true,
            attendanceCorrectionRequests: true,
            canteenEnrollments: true,
            canteenMealServings: true,
            canteenWalletTransactions: true,
          },
        },
      },
    });

    const mergeCounts = {
      guardianLinks: financialSummary?._count.guardianLinks ?? 0,
      documents: financialSummary?._count.documents ?? 0,
      generatedDocuments: financialSummary?._count.generatedDocuments ?? 0,
      invoices: financialSummary?._count.invoices ?? 0,
      payments: financialSummary?._count.payments ?? 0,
      feeWaivers: await this.prisma.feeWaiver.count({
        where: { tenantId: actor.tenantId, studentId: sourceStudent.id },
      }),
      notificationDeliveries:
        financialSummary?._count.notificationDeliveries ?? 0,
      developmentalMilestones:
        financialSummary?._count.developmentalMilestones ?? 0,
      moodLogs: financialSummary?._count.moodLogs ?? 0,
      libraryIssues: financialSummary?._count.libraryIssues ?? 0,
      transportEnrollments: financialSummary?._count.transportEnrollments ?? 0,
      transportLogs: financialSummary?._count.transportLogs ?? 0,
      conversations: await this.prisma.conversation.count({
        where: { tenantId: actor.tenantId, studentId: sourceStudent.id },
      }),
      conversationParticipants: await this.prisma.conversationParticipant.count(
        {
          where: { tenantId: actor.tenantId, studentId: sourceStudent.id },
        },
      ),
      attendanceRecords: financialSummary?._count.attendanceRecords ?? 0,
      attendanceCorrectionRequests:
        financialSummary?._count.attendanceCorrectionRequests ?? 0,
      canteenEnrollments: financialSummary?._count.canteenEnrollments ?? 0,
      canteenMealServings: financialSummary?._count.canteenMealServings ?? 0,
      canteenWalletTransactions:
        financialSummary?._count.canteenWalletTransactions ?? 0,
    };

    return {
      sourceStudent: {
        id: sourceStudent.id,
        studentSystemId: sourceStudent.studentSystemId,
        fullNameEn: `${sourceStudent.firstNameEn} ${sourceStudent.lastNameEn}`,
        lifecycleStatus: sourceStudent.lifecycleStatus,
      },
      targetStudent: {
        id: targetStudent.id,
        studentSystemId: targetStudent.studentSystemId,
        fullNameEn: `${targetStudent.firstNameEn} ${targetStudent.lastNameEn}`,
        lifecycleStatus: targetStudent.lifecycleStatus,
      },
      mergeCounts,
      isProbableDuplicate: isProbableDuplicateStudent(
        sourceStudent,
        targetStudent,
      ),
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

    return this.prisma.$transaction(
      async (tx) => {
        const [sourceStudent, targetStudent] = await Promise.all([
          this.findTenantStudentForDuplicateMerge(
            dto.sourceStudentId,
            actor,
            tx,
          ),
          this.findTenantStudentForDuplicateMerge(
            dto.targetStudentId,
            actor,
            tx,
          ),
        ]);
        const [firstStudentId, secondStudentId] = [
          sourceStudent.id,
          targetStudent.id,
        ].sort();

        if (
          sourceStudent.lifecycleStatus !== StudentLifecycleStatus.ACTIVE &&
          sourceStudent.lifecycleStatus !== StudentLifecycleStatus.ARCHIVED
        ) {
          throw new ConflictException(
            'Only active or archived duplicate source records can be merged safely',
          );
        }

        if (targetStudent.lifecycleStatus !== StudentLifecycleStatus.ACTIVE) {
          throw new ConflictException(
            'Duplicate records can only be merged into an active canonical student',
          );
        }

        if (!isProbableDuplicateStudent(sourceStudent, targetStudent)) {
          throw new BadRequestException(
            'Students do not look like probable duplicate records',
          );
        }

        ensureAllowedLifecycleTransition(
          sourceStudent.lifecycleStatus,
          StudentLifecycleStatus.MERGED,
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

        const duplicateReview = await tx.studentDuplicateReview.findUnique({
          where: {
            tenantId_firstStudentId_secondStudentId: {
              tenantId: actor.tenantId,
              firstStudentId,
              secondStudentId,
            },
          },
        });

        if (
          duplicateReview?.status === StudentDuplicateReviewStatus.NOT_DUPLICATE
        ) {
          throw new ConflictException(
            'These records were marked as not duplicates. Reopen the review before merging.',
          );
        }

        const sourceDocs = await tx.studentDocument.findMany({
          where: { tenantId: actor.tenantId, studentId: sourceStudent.id },
        });

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
          attendanceRecords,
          attendanceCorrectionRequests,
          canteenEnrollments,
          canteenMealServings,
          canteenWalletTransactions,
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
          tx.attendanceRecord.updateMany({
            where: {
              tenantId: actor.tenantId,
              studentId: sourceStudent.id,
            },
            data: { studentId: targetStudent.id },
          }),
          tx.attendanceCorrectionRequest.updateMany({
            where: {
              tenantId: actor.tenantId,
              studentId: sourceStudent.id,
            },
            data: { studentId: targetStudent.id },
          }),
          tx.canteenStudentEnrollment.updateMany({
            where: {
              tenantId: actor.tenantId,
              studentId: sourceStudent.id,
            },
            data: { studentId: targetStudent.id },
          }),
          tx.canteenMealServing.updateMany({
            where: {
              tenantId: actor.tenantId,
              studentId: sourceStudent.id,
            },
            data: { studentId: targetStudent.id },
          }),
          tx.canteenWalletTransaction.updateMany({
            where: {
              tenantId: actor.tenantId,
              studentId: sourceStudent.id,
            },
            data: { studentId: targetStudent.id },
          }),
        ]);

        if (sourceDocs.length > 0) {
          await tx.studentDocumentHistory.createMany({
            data: sourceDocs.map((doc) => ({
              tenantId: actor.tenantId,
              documentId: doc.id,
              action: 'MOVE_MERGE',
              documentTitle: doc.title,
              documentKind: doc.kind,
              performedBy: actor.userId,
              reason: `Merged from student ${sourceStudent.studentSystemId}`,
              metadata: {
                sourceStudentId: sourceStudent.id,
                targetStudentId: targetStudent.id,
              },
            })),
          });
        }

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

        const sourceLifecycleUpdate = await tx.student.updateMany({
          where: {
            id: sourceStudent.id,
            tenantId: actor.tenantId,
            lifecycleStatus: {
              in: [
                StudentLifecycleStatus.ACTIVE,
                StudentLifecycleStatus.ARCHIVED,
              ],
            },
          },
          data: {
            lifecycleStatus: StudentLifecycleStatus.MERGED,
            exitReason: `Merged into ${targetStudent.studentSystemId}: ${dto.reason}`,
            exitedAt: mergedAt,
          },
        });

        if (sourceLifecycleUpdate.count !== 1) {
          throw new ConflictException(
            'The duplicate source record changed before the merge could be completed. Refresh and try again.',
          );
        }

        await tx.studentMergeHistory.create({
          data: {
            tenantId: actor.tenantId,
            sourceStudentId: sourceStudent.id,
            targetStudentId: targetStudent.id,
            mergedById: actor.userId,
            reason: dto.reason,
            metadata: {
              sourceStudentSystemId: sourceStudent.studentSystemId,
              targetStudentSystemId: targetStudent.studentSystemId,
              counts: {
                guardianLinks: guardianLinks.count,
                documents: documents.count,
                invoices: invoices.count,
                payments: payments.count,
                attendanceRecords: attendanceRecords.count,
              },
            },
          },
        });

        await tx.studentLifecycleTransition.create({
          data: {
            tenantId: actor.tenantId,
            studentId: sourceStudent.id,
            fromStatus: sourceStudent.lifecycleStatus,
            toStatus: StudentLifecycleStatus.MERGED,
            reason: dto.reason,
            changedById: actor.userId,
            feeClearanceWaived: true,
            metadata: {
              mergeType: 'duplicate_student_merge',
              mergedIntoStudentId: targetStudent.id,
              mergedIntoStudentSystemId: targetStudent.studentSystemId,
              mergedAt: mergedAt.toISOString(),
            },
          },
        });

        const mergeCounts = {
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
          attendanceRecords: attendanceRecords.count,
          attendanceCorrectionRequests: attendanceCorrectionRequests.count,
          canteenEnrollments: canteenEnrollments.count,
          canteenMealServings: canteenMealServings.count,
          canteenWalletTransactions: canteenWalletTransactions.count,
        };

        await this.auditService.record(
          {
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
              lifecycleStatus: StudentLifecycleStatus.MERGED,
              mergeCounts,
            },
          },
          tx,
        );

        return {
          sourceStudent: {
            id: sourceStudent.id,
            studentSystemId: sourceStudent.studentSystemId,
            lifecycleStatus: StudentLifecycleStatus.MERGED,
          },
          targetStudent: {
            id: targetStudent.id,
            studentSystemId: targetStudent.studentSystemId,
            lifecycleStatus: targetStudent.lifecycleStatus,
          },
          mergedAt: mergedAt.toISOString(),
          mergeCounts,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
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
      take: 100,
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
          where: { status: EnrollmentStatus.ACTIVE },
          include: {
            academicYear: true,
            class: true,
            section: true,
          },
          orderBy: [{ createdAt: 'desc' }],
          take: 1,
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

    const iemisCodeSetting = await this.prisma.tenantSetting.findUnique({
      where: {
        tenantId_key: {
          tenantId: actor.tenantId,
          key: 'iemis_school_code',
        },
      },
    });
    const iemisCodeValue = iemisCodeSetting?.value;
    const iemisSchoolCode =
      typeof iemisCodeValue === 'string' ||
      typeof iemisCodeValue === 'number' ||
      typeof iemisCodeValue === 'boolean'
        ? String(iemisCodeValue)
        : '';

    const headers = buildIemisHeaders();
    const rows = validationResults
      .filter((result) => !result.issues.some((issue) => issue.blocking))
      .map(({ student }) => buildIemisRow(student, iemisSchoolCode));

    const csv = buildCsv(headers, rows);
    const exportedAt = new Date();
    const fileName = buildIemisExportFileName(actor, exportedAt);
    const stored = await this.storageService.saveBufferObject({
      tenantId: actor.tenantId,
      prefix: 'exports/iemis',
      fileName,
      contentType: 'text/csv',
      content: Buffer.from(csv, 'utf8'),
    });
    const fileAsset = await this.fileRegistryService.registerFile({
      tenantId: actor.tenantId,
      uploadedByUserId: actor.userId,
      originalFilename: fileName,
      objectKey: stored.objectKey,
      mimeType: 'text/csv',
      sizeBytes: stored.sizeBytes,
      provider: stored.provider,
      bucket: stored.bucket,
      checksumSha256: stored.checksumSha256,
      module: 'students',
      entityId: actor.tenantId,
      metadata: {
        kind: 'IEMIS_EXPORT',
        reportKey: 'iemis_student_export',
        totalStudents: students.length,
        validStudents: rows.length,
      },
    });
    await this.fileRegistryService.markUploaded(
      actor.tenantId,
      fileAsset.id,
      actor.userId,
    );

    const exportRecord = await this.prisma.reportExport.create({
      data: {
        tenantId: actor.tenantId,
        reportKey: 'iemis_student_export',
        format: 'csv',
        fileAssetId: fileAsset.id,
        filters: {
          totalStudents: students.length,
          validStudents: rows.length,
          fileName,
        },
        requestedBy: actor.userId,
        status: 'COMPLETED',
        completedAt: exportedAt,
      },
    });

    await this.auditService.record({
      action: 'export',
      resource: 'iemis_export',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: exportRecord.id,
      after: {
        totalRecords: students.length,
        validRecords: rows.length,
        exportId: exportRecord.id,
        fileAssetId: fileAsset.id,
        fileName,
      },
    });

    return {
      formatVersion: IEMIS_REQUIREMENT_VERSION,
      exportedAt: exportedAt.toISOString(),
      exportId: exportRecord.id,
      fileAssetId: fileAsset.id,
      fileName,
      totalRecords: students.length,
      validRecords: rows.length,
      invalidRecords: validationResults.filter((result) =>
        result.issues.some((issue) => issue.blocking),
      ).length,
      issues: validationResults
        .filter((result) => result.issues.some((issue) => issue.blocking))
        .flatMap((result) =>
          result.issues
            .filter((issue) => issue.blocking)
            .map((issue) => ({
              studentId: result.student.id,
              studentSystemId: result.student.studentSystemId,
              field: issue.field,
              message: issue.message,
            })),
        ),
      headers,
      rows,
      csv,
    };
  }

  async uploadStudentDocument(
    studentId: string,
    dto: UploadStudentDocumentDto,
    actor: AuthContext,
  ) {
    const student = await this.findTenantStudent(studentId, actor);

    const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]);

    if (
      dto.contentType &&
      !ALLOWED_DOCUMENT_MIME_TYPES.has(dto.contentType.toLowerCase())
    ) {
      throw new BadRequestException(
        `File type ${dto.contentType} is not allowed for student documents. Only PDF, JPEG, PNG, WEBP, and DOC/DOCX are permitted.`,
      );
    }

    const expiryDate = parseOptionalStudentDocumentExpiryDate(dto.expiryDate);

    const stored = await this.storageService.saveBase64Object({
      tenantId: actor.tenantId,
      prefix: `students/${student.id}/documents/${dto.kind}`,
      fileName: dto.fileName,
      contentType: dto.contentType || 'application/octet-stream',
      base64Content: dto.base64Content,
    });

    const asset = await this.fileRegistryService.registerFile({
      tenantId: actor.tenantId,
      uploadedByUserId: actor.userId,
      originalFilename: dto.fileName,
      objectKey: stored.objectKey,
      mimeType: dto.contentType || 'application/octet-stream',
      sizeBytes: stored.sizeBytes,
      provider: stored.provider,
      bucket: stored.bucket,
      checksumSha256: stored.checksumSha256,
      module: 'students',
      entityId: student.id,
      metadata: {
        kind: dto.kind,
        title: dto.title,
        expiryDate: expiryDate?.toISOString() ?? null,
      },
    });

    const document = await this.prisma.studentDocument.create({
      data: {
        tenantId: actor.tenantId,
        studentId: student.id,
        fileId: asset.id,
        kind: dto.kind,
        title: dto.title,
        fileName: dto.fileName,
        contentType: dto.contentType || 'application/octet-stream',
        sizeBytes: stored.sizeBytes,
        objectKey: stored.objectKey,
        uploadedById: actor.userId,
        notes: dto.notes,
        expiryDate,
      },
    });

    await this.prisma.studentDocumentHistory.create({
      data: {
        tenantId: actor.tenantId,
        documentId: document.id,
        action: 'UPLOAD',
        documentTitle: document.title,
        documentKind: document.kind,
        performedBy: actor.userId,
        reason: dto.reason,
        metadata: {
          assetId: asset.id,
          originalFilename: dto.fileName,
          expiryDate: expiryDate?.toISOString() ?? null,
        },
      },
    });

    await this.auditService.record({
      action: 'upload',
      resource: 'student_document',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: document.id,
      after: {
        studentId: student.id,
        kind: document.kind,
        fileName: document.fileName,
        expiryDate: expiryDate?.toISOString() ?? null,
      },
    });

    return document;
  }

  async getStudentIdentity(studentId: string, actor: AuthContext) {
    const student = await this.findTenantStudent(studentId, actor);

    let identity = await this.prisma.studentIdentity.findFirst({
      where: {
        tenantId: actor.tenantId,
        studentId: student.id,
        status: 'ACTIVE',
      },
    });

    if (!identity) {
      identity = await this.generateStudentIdentity(student.id, actor);
    }

    return {
      studentId: student.id,
      studentSystemId: student.studentSystemId,
      identityCode: identity.identityCode,
      status: identity.status,
      createdAt: identity.createdAt,
    };
  }

  async generateStudentIdentity(studentId: string, actor: AuthContext) {
    const student = await this.findTenantStudent(studentId, actor);

    // Revoke old identities
    await this.prisma.studentIdentity.updateMany({
      where: {
        tenantId: actor.tenantId,
        studentId: student.id,
        status: 'ACTIVE',
      },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
        revokedById: actor.userId,
      },
    });

    const identityCode =
      `ST-${actor.tenantId.slice(0, 4)}-${student.studentSystemId}-${createHash('sha256').update(`${student.id}-${Date.now()}`).digest('hex').slice(0, 8)}`.toUpperCase();

    const identity = await this.prisma.studentIdentity.create({
      data: {
        tenantId: actor.tenantId,
        studentId: student.id,
        identityCode,
        status: 'ACTIVE',
      },
    });

    await this.prisma.student.update({
      where: { id: student.id },
      data: { studentIdentityCode: identityCode },
    });

    await this.auditService.record({
      action: 'generate_identity',
      resource: 'student_identity',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: identity.id,
      after: {
        studentId: student.id,
        identityCode,
      },
    });

    return identity;
  }

  async revokeStudentIdentity(
    studentId: string,
    identityCode: string,
    actor: AuthContext,
  ) {
    const identity = await this.prisma.studentIdentity.findFirst({
      where: {
        tenantId: actor.tenantId,
        studentId,
        identityCode,
      },
    });

    if (!identity) {
      throw new NotFoundException('Identity code not found for this student');
    }

    await this.prisma.studentIdentity.update({
      where: { id: identity.id },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
        revokedById: actor.userId,
      },
    });

    await this.prisma.student.update({
      where: { id: studentId },
      data: { studentIdentityCode: null },
    });

    return { success: true };
  }

  async deleteStudentDocument(
    studentId: string,
    documentId: string,
    dto: { reason: string },
    actor: AuthContext,
  ) {
    const document = await this.prisma.studentDocument.findFirst({
      where: {
        id: documentId,
        studentId,
        tenantId: actor.tenantId,
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.studentDocumentHistory.create({
        data: {
          tenantId: actor.tenantId,
          documentId: document.id,
          action: 'DELETE',
          documentTitle: document.title,
          documentKind: document.kind,
          performedBy: actor.userId,
          reason: dto.reason,
        },
      });

      await tx.studentDocument.delete({
        where: { id: documentId },
      });
    });

    await this.auditService.record({
      action: 'delete_document',
      resource: 'student_document',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: studentId,
      before: {
        documentId: document.id,
        kind: document.kind,
        title: document.title,
      },
    });

    return { success: true };
  }

  async generateStudentQrCode(studentId: string, actor: AuthContext) {
    const student = await this.findTenantStudent(studentId, actor);

    const qrData = `schoolos:std:${actor.tenantId}:${student.studentSystemId}:${Date.now()}`;

    const updated = await this.prisma.student.update({
      where: { id: student.id },
      data: { qrCode: qrData },
    });

    await this.auditService.record({
      action: 'generate_qr',
      resource: 'student',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: student.id,
      after: { qrCode: qrData },
    });

    return { qrCode: updated.qrCode };
  }

  async verifyStudentQrCode(qrCode: string, actor: AuthContext) {
    const student = await this.prisma.student.findFirst({
      where: {
        tenantId: actor.tenantId,
        qrCode,
      },
      include: {
        class: true,
        sectionRef: true,
      },
    });

    if (!student) {
      throw new NotFoundException('Invalid or expired student QR code');
    }

    return {
      id: student.id,
      studentSystemId: student.studentSystemId,
      fullNameEn: `${student.firstNameEn} ${student.lastNameEn}`,
      lifecycleStatus: student.lifecycleStatus,
      class: student.class.name,
      section: student.sectionRef?.name ?? null,
    };
  }

  async exportRoster(
    filters: {
      academicYearId?: string;
      classId?: string;
      sectionId?: string;
    },
    actor: AuthContext,
  ) {
    const students = await this.prisma.student.findMany({
      where: {
        tenantId: actor.tenantId,
        lifecycleStatus: {
          in: [
            StudentLifecycleStatus.ACTIVE,
            StudentLifecycleStatus.TRANSFERRED,
            StudentLifecycleStatus.EXITED,
            StudentLifecycleStatus.ALUMNI,
          ],
        },
        ...(filters.classId ? { classId: filters.classId } : {}),
        ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
      },
      include: {
        class: true,
        sectionRef: true,
        guardianLinks: {
          include: { guardian: true },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        },
      },
      orderBy: [
        { classId: 'asc' },
        { sectionId: 'asc' },
        { firstNameEn: 'asc' },
      ],
    });

    const headers = [
      'Student ID',
      'Name',
      'Class',
      'Section',
      'Roll Number',
      'Guardian Name',
      'Guardian Phone',
      'Status',
      'Admission Date',
    ];

    const rows: Array<Record<string, unknown>> = students.map((student) => {
      const primaryGuardian = student.guardianLinks[0]?.guardian;
      const studentName = [student.firstNameEn, student.lastNameEn]
        .filter(Boolean)
        .join(' ');

      return {
        'Student ID': student.studentSystemId,
        Name: studentName,
        Class: student.class.name,
        Section: student.sectionRef?.name ?? student.section ?? 'N/A',
        'Roll Number': student.rollNumber ?? 'N/A',
        'Guardian Name': primaryGuardian?.fullName ?? 'N/A',
        'Guardian Phone': primaryGuardian?.primaryPhone ?? 'N/A',
        Status: student.lifecycleStatus ?? 'ACTIVE',
        'Admission Date': student.admissionDate
          ? student.admissionDate.toISOString().slice(0, 10)
          : 'N/A',
      };
    });

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: actor.tenantId },
    });

    const targetClass = filters.classId
      ? await this.prisma.class.findUnique({ where: { id: filters.classId } })
      : null;

    const targetSection = filters.sectionId
      ? await this.prisma.section.findUnique({
          where: { id: filters.sectionId },
        })
      : null;
    const logo = await loadSchoolLogoForPdf(
      this.prisma,
      this.fileRegistryService,
      actor,
    );

    return {
      headers,
      rows,
      csv: buildCsv(headers, rows),
      pdf: buildRosterPdf({
        schoolName: tenant?.name || 'SchoolOS',
        className: targetClass?.name || 'All Classes',
        sectionName: targetSection?.name || null,
        headers: [
          'Student ID',
          'Name',
          'Class',
          'Section',
          'Roll Number',
          'Status',
        ],
        rows,
        logo,
      }),
    };
  }

  async getStudentLifecycleTimeline(studentId: string, actor: AuthContext) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId: actor.tenantId },
    });
    if (!student) {
      throw new NotFoundException('Student not found in this tenant');
    }

    const transitions = await this.prisma.studentLifecycleTransition.findMany({
      where: {
        studentId: student.id,
        tenantId: actor.tenantId,
      },
      orderBy: { changedAt: 'desc' },
    });

    const userIds = transitions
      .map((t) => t.changedById)
      .filter((id): id is string => Boolean(id));

    const users =
      userIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, email: true },
          })
        : [];

    const userMap = new Map(users.map((u) => [u.id, u.email]));

    return transitions.map((t) => ({
      id: t.id,
      fromStatus: t.fromStatus,
      toStatus: t.toStatus,
      reason: t.reason,
      changedById: t.changedById,
      changedByEmail: t.changedById
        ? (userMap.get(t.changedById) ?? null)
        : null,
      changedAt: t.changedAt.toISOString(),
      feeClearanceWaived: t.feeClearanceWaived,
      metadata: t.metadata,
    }));
  }

  async getIemisReadiness(studentId: string, actor: AuthContext) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId: actor.tenantId },
      include: {
        tenant: true,
        class: true,
        sectionRef: true,
        guardianLinks: {
          include: { guardian: true },
        },
        enrollments: {
          where: { status: EnrollmentStatus.ACTIVE },
          include: {
            academicYear: true,
            class: true,
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

    if (
      actor.roles.some(
        (role) => role === 'teacher' || role === 'subject_teacher',
      ) &&
      !actor.roles.some((role) => role === 'admin' || role === 'principal')
    ) {
      const activeEnrollment = student.enrollments[0] ?? null;
      const assignment = activeEnrollment
        ? await this.prisma.subjectTeacherAssignment.findFirst({
            where: {
              tenantId: actor.tenantId,
              staff: { userId: actor.userId },
              classId: activeEnrollment.classId,
              OR: [
                { sectionId: activeEnrollment.sectionId },
                { sectionId: null },
              ],
            },
            select: { id: true },
          })
        : null;

      if (!assignment) {
        throw new ForbiddenException(
          'Student reporting readiness is outside your teaching scope',
        );
      }
    }

    return buildStudentIemisReadiness(student, new Date());
  }

  async getIemisValidationList(
    options: {
      classId?: string;
      sectionId?: string;
      status?: 'all' | 'ready' | 'has_issues';
    },
    actor: AuthContext,
  ) {
    const students = await this.prisma.student.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(options.classId ? { classId: options.classId } : {}),
        ...(options.sectionId ? { sectionId: options.sectionId } : {}),
      },
      include: {
        tenant: true,
        class: true,
        sectionRef: true,
        guardianLinks: {
          include: { guardian: true },
        },
        enrollments: {
          where: { status: EnrollmentStatus.ACTIVE },
          include: {
            academicYear: true,
            class: true,
            section: true,
          },
          orderBy: [{ createdAt: 'desc' }],
          take: 1,
        },
      },
      orderBy: [{ studentSystemId: 'asc' }],
    });

    const list = students.map((student) => {
      const issues = validateIemisStudent(student);
      const blockingIssueCount = issues.filter(
        (issue) => issue.blocking,
      ).length;
      const passedRequiredChecks = Math.max(
        0,
        IEMIS_REQUIRED_RULE_CODES.length - blockingIssueCount,
      );
      const score = Math.round(
        (passedRequiredChecks / IEMIS_REQUIRED_RULE_CODES.length) * 100,
      );
      const activeEnrollment = student.enrollments[0] ?? null;

      return {
        studentId: student.id,
        studentSystemId: student.studentSystemId,
        fullNameEn: `${student.firstNameEn} ${student.lastNameEn}`.trim(),
        className: activeEnrollment?.class?.name ?? student.class.name,
        sectionName: activeEnrollment?.section?.name ?? null,
        eligible: blockingIssueCount === 0,
        score,
        issuesCount: blockingIssueCount,
        issues: issues
          .filter((issue) => issue.blocking)
          .map((issue) => ({
            field: issue.field,
            message: issue.message,
          })),
      };
    });

    if (options.status === 'ready') {
      return list.filter((item) => item.eligible);
    }

    if (options.status === 'has_issues') {
      return list.filter((item) => !item.eligible);
    }

    return list;
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
            class: true,
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
    const [logo, photo] = await Promise.all([
      loadSchoolLogoForPdf(this.prisma, this.fileRegistryService, actor),
      normalizedKind === 'id-card'
        ? this.loadStudentPhotoForIdCard(student.id, actor)
        : Promise.resolve(null),
    ]);
    const pdf = buildStudentDocumentPdf({
      student,
      logo,
      photo,
      kind: normalizedKind,
      actor,
      issuedAt: signedAt,
      version,
    });
    const checksumSha256 = createHash('sha256').update(pdf).digest('hex');
    const generatedFileAsset =
      await this.fileRegistryService.registerGeneratedFile({
        tenantId: actor.tenantId,
        generatedByUserId: actor.userId,
        originalFilename: fileName,
        content: pdf,
        mimeType: 'application/pdf',
        module: 'students',
        entityId: student.id,
        metadata: {
          kind: normalizedKind,
          title: getStudentDocumentTitle(normalizedKind),
          source: 'generated_student_document',
          version,
        },
      });
    const pdfUrl = `/api/v1/files/${encodeURIComponent(
      generatedFileAsset.id,
    )}/preview`;

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
          sizeBytes: Number(generatedFileAsset.sizeBytes),
          pdfUrl,
          generatedById: actor.userId,
          storageObjectKey: generatedFileAsset.objectKey,
          checksumSha256,
          signedAt,
          signatureMetadata: {
            issuerUserId: actor.userId,
            tenantSlug: actor.tenantSlug,
            generatedAt: signedAt.toISOString(),
            mode: 'internal-issued',
            storageProvider: generatedFileAsset.storageProvider,
            storageObjectKey: generatedFileAsset.objectKey,
            signerName: actor.email ?? actor.userId,
            signerRole: actor.roles[0] ?? 'school_official',
            layoutVersion: 'certificate-v2',
          },
          version,
          retentionUntil: resolveDocumentRetentionUntil(
            normalizedKind,
            signedAt,
          ),
          metadata: {
            studentSystemId: student.studentSystemId,
            className: student.class.name,
            sectionName: student.sectionRef?.name ?? student.section ?? null,
            storageProvider: generatedFileAsset.storageProvider,
            layoutVersion: 'certificate-v2',
          },
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

    return {
      fileAssetId: generatedFileAsset.id,
      fileName,
      mimeType: 'application/pdf',
      fileAvailable: true as const,
    };
  }

  // Loads the student's uploaded photo through the same protected File
  // Registry flow the profile/roster use, then normalizes it to a JPEG via
  // sharp so any accepted upload format (jpeg/png/webp) can be embedded in
  // the hand-rolled PDF engine, which only draws DCTDecode (JPEG) images.
  // Fails safe to null on any error (missing/archived file, unreadable
  // image, wrong tenant, etc.) so ID card generation never breaks.
  private async loadStudentPhotoForIdCard(
    studentId: string,
    actor: AuthContext,
  ): Promise<PdfImage | null> {
    try {
      const { content } = await this.studentPhotoService.getPhotoContent(
        studentId,
        actor,
      );
      const normalized = await sharp(content, { failOn: 'none' })
        .rotate()
        .resize({
          width: 324,
          height: 390,
          fit: 'cover',
          position: 'attention',
        })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer();
      const dimensions = getJpegDimensions(normalized);
      return {
        buffer: normalized,
        width: dimensions.width,
        height: dimensions.height,
        format: 'jpeg',
      };
    } catch {
      return null;
    }
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
        },
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
          document.metadata.retentionStatus === 'eligible_for_purge'
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
          },
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

  async processStudentDocumentExpiryReminders(now = new Date()) {
    const reminderWindowEnd = addDays(startOfDay(now), 30);
    const dayStart = startOfDay(now);
    const dayEnd = addDays(dayStart, 1);
    const candidates = await this.prisma.studentDocument.findMany({
      where: {
        status: {
          in: ['ACTIVE', 'VERIFIED'],
        },
        expiryDate: {
          lte: reminderWindowEnd,
        },
      },
      include: {
        tenant: true,
        student: {
          include: {
            guardianLinks: {
              include: { guardian: true },
              orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
            },
          },
        },
      },
      orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
      take: 500,
    });

    const documentIds = candidates.map((document) => document.id);
    const existingReminderRows =
      documentIds.length > 0
        ? await this.prisma.studentDocumentHistory.findMany({
            where: {
              documentId: { in: documentIds },
              action: 'EXPIRY_REMINDER_SENT',
              createdAt: {
                gte: dayStart,
                lt: dayEnd,
              },
            },
            select: { documentId: true },
          })
        : [];
    const alreadyRemindedDocumentIds = new Set(
      existingReminderRows
        .map((row) => row.documentId)
        .filter((id): id is string => Boolean(id)),
    );

    let remindedDocuments = 0;
    let skippedDocuments = 0;
    const tenantIds = [
      ...new Set(candidates.map((document) => document.tenantId)),
    ];
    const templates =
      tenantIds.length > 0
        ? await this.prisma.studentDocumentExpiryTemplate.findMany({
            where: {
              tenantId: { in: tenantIds },
              isActive: true,
            },
          })
        : [];

    for (const document of candidates) {
      if (!document.expiryDate) {
        skippedDocuments += 1;
        continue;
      }

      if (alreadyRemindedDocumentIds.has(document.id)) {
        skippedDocuments += 1;
        continue;
      }

      const recipients = selectDocumentExpiryRecipients(
        document.student.guardianLinks,
      );

      if (recipients.length === 0) {
        await this.prisma.studentDocumentHistory.create({
          data: {
            tenantId: document.tenantId,
            documentId: document.id,
            action: 'EXPIRY_REMINDER_SKIPPED',
            documentTitle: document.title,
            documentKind: document.kind,
            performedBy: 'system',
            reason:
              'No active guardian contact is available for expiry reminder',
            metadata: {
              studentId: document.studentId,
              expiryDate: document.expiryDate.toISOString(),
            },
          },
        });
        skippedDocuments += 1;
        continue;
      }

      const daysUntilExpiry = daysBetween(
        dayStart,
        startOfDay(document.expiryDate),
      );
      const reminderStatus: 'expired' | 'expiring' =
        daysUntilExpiry < 0 ? 'expired' : 'expiring';
      const studentName = formatStudentDisplayName(document.student);
      const documentTitle = document.title || formatDocumentKind(document.kind);
      const expiryLabel = document.expiryDate.toISOString().slice(0, 10);
      const subject =
        reminderStatus === 'expired'
          ? `${studentName}: document expired`
          : `${studentName}: document expires soon`;
      const text = buildDocumentExpiryReminderText({
        studentName,
        documentTitle,
        expiryLabel,
        daysUntilExpiry,
        reminderStatus,
      });
      const templateContext = {
        studentName,
        documentTitle,
        expiryLabel,
        daysUntilExpiry,
        reminderStatus,
        tenantSlug: document.tenant?.slug ?? document.tenantId,
      };
      const emailTemplate = selectDocumentExpiryTemplate(
        templates,
        document.tenantId,
        'email',
        reminderStatus,
      );
      const smsTemplate = selectDocumentExpiryTemplate(
        templates,
        document.tenantId,
        'sms',
        reminderStatus,
      );
      const emailSubject = emailTemplate?.subjectTemplate
        ? renderDocumentExpiryTemplate(
            emailTemplate.subjectTemplate,
            templateContext,
          )
        : subject;
      const emailText = emailTemplate
        ? renderDocumentExpiryTemplate(
            emailTemplate.messageTemplate,
            templateContext,
          )
        : text;
      const smsText = smsTemplate
        ? renderDocumentExpiryTemplate(
            smsTemplate.messageTemplate,
            templateContext,
          )
        : text;

      for (const recipient of recipients) {
        if (recipient.email) {
          await this.notificationsService.sendEmail({
            to: recipient.email,
            subject: emailSubject,
            text: emailText,
            metadata: {
              tenantId: document.tenantId,
              studentId: document.studentId,
              documentId: document.id,
              reminderType: 'student_document_expiry',
            },
          });
        }

        if (recipient.phone) {
          await this.notificationsService.sendSms({
            to: recipient.phone,
            message: smsText,
            metadata: {
              tenantId: document.tenantId,
              studentId: document.studentId,
              documentId: document.id,
              reminderType: 'student_document_expiry',
            },
          });
        }
      }

      await this.prisma.studentDocumentHistory.create({
        data: {
          tenantId: document.tenantId,
          documentId: document.id,
          action: 'EXPIRY_REMINDER_SENT',
          documentTitle: document.title,
          documentKind: document.kind,
          performedBy: 'system',
          reason:
            reminderStatus === 'expired'
              ? 'Document already expired'
              : 'Document expiry is within reminder window',
          metadata: {
            studentId: document.studentId,
            expiryDate: document.expiryDate.toISOString(),
            daysUntilExpiry,
            reminderStatus,
            recipientCount: recipients.length,
            templateIds: {
              email: emailTemplate?.id ?? null,
              sms: smsTemplate?.id ?? null,
            },
          },
        },
      });

      await this.auditService.record({
        action: 'expiry_reminder_sent',
        resource: 'student_document',
        tenantId: document.tenantId,
        userId: null,
        resourceId: document.id,
        after: {
          studentId: document.studentId,
          kind: document.kind,
          expiryDate: document.expiryDate.toISOString(),
          daysUntilExpiry,
          reminderStatus,
          recipientCount: recipients.length,
        },
      });

      remindedDocuments += 1;
    }

    return {
      reviewedAt: now.toISOString(),
      reminderWindowEnd: reminderWindowEnd.toISOString(),
      candidateDocuments: candidates.length,
      remindedDocuments,
      skippedDocuments,
    };
  }

  async listDocumentExpiryTemplates(actor: AuthContext) {
    const templates = await this.prisma.studentDocumentExpiryTemplate.findMany({
      where: { tenantId: actor.tenantId },
      orderBy: [
        { channel: 'asc' },
        { reminderStatus: 'asc' },
        { createdAt: 'asc' },
      ],
      take: 100,
    });

    return templates.map((template) => ({
      id: template.id,
      channel: template.channel,
      reminderStatus: template.reminderStatus,
      subjectTemplate: template.subjectTemplate,
      messageTemplate: template.messageTemplate,
      daysBeforeExpiry: template.daysBeforeExpiry,
      isActive: template.isActive,
      updatedById: template.updatedById,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    }));
  }

  async upsertDocumentExpiryTemplate(
    dto: UpsertDocumentExpiryTemplateDto,
    actor: AuthContext,
  ) {
    const template = await this.prisma.studentDocumentExpiryTemplate.upsert({
      where: {
        tenantId_channel_reminderStatus: {
          tenantId: actor.tenantId,
          channel: dto.channel,
          reminderStatus: dto.reminderStatus,
        },
      },
      update: {
        subjectTemplate: dto.subjectTemplate?.trim() || null,
        messageTemplate: dto.messageTemplate.trim(),
        daysBeforeExpiry: dto.daysBeforeExpiry ?? 30,
        isActive: dto.isActive ?? true,
        updatedById: actor.userId,
      },
      create: {
        tenantId: actor.tenantId,
        channel: dto.channel,
        reminderStatus: dto.reminderStatus,
        subjectTemplate: dto.subjectTemplate?.trim() || null,
        messageTemplate: dto.messageTemplate.trim(),
        daysBeforeExpiry: dto.daysBeforeExpiry ?? 30,
        isActive: dto.isActive ?? true,
        updatedById: actor.userId,
      },
    });

    await this.auditService.record({
      action: 'document_expiry_template_upsert',
      resource: 'student_document_expiry_template',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: template.id,
      after: {
        channel: template.channel,
        reminderStatus: template.reminderStatus,
        isActive: template.isActive,
        daysBeforeExpiry: template.daysBeforeExpiry,
      },
    });

    return {
      id: template.id,
      channel: template.channel,
      reminderStatus: template.reminderStatus,
      subjectTemplate: template.subjectTemplate,
      messageTemplate: template.messageTemplate,
      daysBeforeExpiry: template.daysBeforeExpiry,
      isActive: template.isActive,
      updatedById: template.updatedById,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    };
  }

  private async recordLifecycleTransition(
    studentId: string,
    fromStatus: StudentLifecycleStatus | null,
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
    client: Pick<PrismaService, 'student'> | Prisma.TransactionClient = this
      .prisma,
  ) {
    const student = await client.student.findFirst({
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

function parseOptionalStudentDocumentExpiryDate(value?: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException('Document expiry date must be a valid date');
  }

  return parsed;
}

function startOfDay(value: Date) {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 86_400_000);
}

function daysBetween(left: Date, right: Date) {
  return Math.round((right.getTime() - left.getTime()) / 86_400_000);
}

function selectDocumentExpiryRecipients(
  guardianLinks: Array<{
    isPrimary?: boolean | null;
    guardian?: {
      fullName?: string | null;
      email?: string | null;
      primaryPhone?: string | null;
      receivesAlerts?: boolean | null;
    } | null;
  }>,
) {
  const withContact = guardianLinks
    .map((link) => ({
      isPrimary: Boolean(link.isPrimary),
      receivesAlerts: Boolean(link.guardian?.receivesAlerts),
      email: link.guardian?.email?.trim() || null,
      phone: link.guardian?.primaryPhone?.trim() || null,
    }))
    .filter((guardian) => guardian.email || guardian.phone);
  const preferred = withContact.filter(
    (guardian) => guardian.isPrimary || guardian.receivesAlerts,
  );
  return preferred.length > 0 ? preferred : withContact.slice(0, 1);
}

function formatStudentDisplayName(student: {
  firstNameEn?: string | null;
  lastNameEn?: string | null;
  studentSystemId?: string | null;
}) {
  return (
    [student.firstNameEn, student.lastNameEn]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    student.studentSystemId ||
    'Student'
  );
}

function formatDocumentKind(kind: string) {
  return kind
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildDocumentExpiryReminderText(input: {
  studentName: string;
  documentTitle: string;
  expiryLabel: string;
  daysUntilExpiry: number;
  reminderStatus: 'expired' | 'expiring';
}) {
  const timing =
    input.reminderStatus === 'expired'
      ? `expired ${Math.abs(input.daysUntilExpiry)} day${Math.abs(input.daysUntilExpiry) === 1 ? '' : 's'} ago`
      : `expires in ${input.daysUntilExpiry} day${input.daysUntilExpiry === 1 ? '' : 's'}`;

  return [
    `SchoolOS document reminder: ${input.documentTitle} for ${input.studentName} ${timing}.`,
    `Expiry date: ${input.expiryLabel}.`,
    'Please contact the school office to update the document.',
  ].join(' ');
}

function selectDocumentExpiryTemplate(
  templates: Array<{
    id: string;
    tenantId: string;
    channel: string;
    reminderStatus: string;
    subjectTemplate: string | null;
    messageTemplate: string;
  }>,
  tenantId: string,
  channel: 'email' | 'sms',
  reminderStatus: 'expired' | 'expiring',
) {
  return (
    templates.find(
      (template) =>
        template.tenantId === tenantId &&
        template.channel === channel &&
        template.reminderStatus === reminderStatus,
    ) ?? null
  );
}

function renderDocumentExpiryTemplate(
  template: string,
  context: {
    studentName: string;
    documentTitle: string;
    expiryLabel: string;
    daysUntilExpiry: number;
    reminderStatus: 'expired' | 'expiring';
    tenantSlug: string;
  },
) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
    const value = context[key as keyof typeof context];
    return value === undefined ? match : String(value);
  });
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
        class: true;
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
  logo?: PdfImage | null;
  photo?: PdfImage | null;
}) {
  const { student, kind, actor, issuedAt, version, logo, photo } = input;
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
    return buildIdCardPdf({
      schoolName: student.tenant.name,
      studentName: fullName,
      studentId: student.studentSystemId,
      className: student.class.name,
      sectionName,
      rollNumber: student.rollNumber ?? latestEnrollment?.rollNumber,
      bloodGroup: student.bloodGroup,
      guardianName: primaryGuardian?.fullName,
      guardianPhone: primaryGuardian?.primaryPhone,
      academicYear: latestEnrollment?.academicYear.name,
      qrToken: student.studentSystemId,
      logo,
      photo,
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
      logo,
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
      logo,
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
      logo,
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
    logo,
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
    'iemisSchoolCode',
    'fatherName',
    'motherName',
    'stream',
    'dobBs',
  ];
}

function buildIemisRow(
  student: StudentDocumentPayload,
  iemisSchoolCode: string,
) {
  const latestEnrollment = student.enrollments[0] ?? null;
  const primaryGuardianLink =
    student.guardianLinks.find((link) => link.isPrimary) ??
    student.guardianLinks[0] ??
    null;
  const primaryGuardian = primaryGuardianLink?.guardian ?? null;

  const fatherLink = student.guardianLinks.find(
    (link) =>
      link.relation.toLowerCase() === 'father' ||
      link.relation.toLowerCase() === 'father/guardian',
  );
  const motherLink = student.guardianLinks.find(
    (link) =>
      link.relation.toLowerCase() === 'mother' ||
      link.relation.toLowerCase() === 'mother/guardian',
  );

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
    admissionDate: (latestEnrollment?.admissionDate ?? student.admissionDate)
      .toISOString()
      .slice(0, 10),
    admissionNumber: student.admissionNumber ?? '',
    lifecycleStatus: student.lifecycleStatus,
    academicYear: latestEnrollment?.academicYear.name ?? '',
    className: latestEnrollment?.class?.name ?? '',
    sectionName: latestEnrollment?.section?.name ?? '',
    rollNumber: latestEnrollment?.rollNumber ?? '',
    primaryGuardianName: primaryGuardian?.fullName ?? '',
    primaryGuardianRelation: primaryGuardianLink?.relation ?? '',
    primaryGuardianPhone: primaryGuardian?.primaryPhone ?? '',
    primaryGuardianEmail: primaryGuardian?.email ?? '',
    wardNumber: primaryGuardian?.wardNumber ?? '',
    guardianCount: student.guardianLinks.length,
    iemisSchoolCode: iemisSchoolCode || '',
    fatherName: fatherLink?.guardian.fullName ?? '',
    motherName: motherLink?.guardian.fullName ?? '',
    stream: '',
    dobBs: '',
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
    value === null || typeof value === 'undefined'
      ? ''
      : value instanceof Date
        ? value.toISOString()
        : typeof value === 'string' ||
            typeof value === 'number' ||
            typeof value === 'boolean' ||
            typeof value === 'bigint'
          ? String(value)
          : JSON.stringify(value);

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function buildIemisExportFileName(actor: AuthContext, exportedAt: Date) {
  const date = exportedAt.toISOString().slice(0, 10);
  const tenant = (actor.tenantSlug || actor.tenantId)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return `iemis-students-${tenant || 'tenant'}-${date}.csv`;
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
      StudentLifecycleStatus.ALUMNI,
      StudentLifecycleStatus.MERGED,
      StudentLifecycleStatus.DELETED,
    ],
    [StudentLifecycleStatus.TRANSFERRED]: [
      StudentLifecycleStatus.ACTIVE,
      StudentLifecycleStatus.ALUMNI,
    ],
    [StudentLifecycleStatus.EXITED]: [
      StudentLifecycleStatus.ACTIVE,
      StudentLifecycleStatus.ALUMNI,
    ],
    [StudentLifecycleStatus.ALUMNI]: [StudentLifecycleStatus.DELETED],
    [StudentLifecycleStatus.DELETED]: [StudentLifecycleStatus.ACTIVE],
    [StudentLifecycleStatus.ARCHIVED]: [StudentLifecycleStatus.ACTIVE],
    [StudentLifecycleStatus.MERGED]: [StudentLifecycleStatus.ACTIVE],
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
    admissionNumber?: string | null;
  },
  targetStudent: {
    firstNameEn: string;
    lastNameEn: string;
    dateOfBirth: Date;
    admissionNumber?: string | null;
  },
) {
  const nameDobMatch =
    normalizeStudentIdentityName(sourceStudent.firstNameEn) ===
      normalizeStudentIdentityName(targetStudent.firstNameEn) &&
    normalizeStudentIdentityName(sourceStudent.lastNameEn) ===
      normalizeStudentIdentityName(targetStudent.lastNameEn) &&
    sourceStudent.dateOfBirth.toISOString().slice(0, 10) ===
      targetStudent.dateOfBirth.toISOString().slice(0, 10);

  const admissionMatch =
    sourceStudent.admissionNumber &&
    sourceStudent.admissionNumber.trim().toLowerCase() ===
      targetStudent.admissionNumber?.trim().toLowerCase();

  return nameDobMatch || admissionMatch;
}

export interface DuplicateCandidateStudent {
  id: string;
  studentSystemId: string;
  firstNameEn: string;
  lastNameEn: string;
  firstNameNp?: string | null;
  lastNameNp?: string | null;
  dateOfBirth: Date;
  admissionNumber?: string | null;
  previousSchool?: string | null;
  lifecycleStatus: StudentLifecycleStatus;
  class?: { name: string } | null;
  sectionRef?: { name: string } | null;
  guardianLinks: Array<{
    guardian: {
      fullName: string;
      primaryPhone?: string | null;
      secondaryPhone?: string | null;
      email?: string | null;
    };
  }>;
  siblingMemberships?: Array<{ siblingGroupId: string }>;
}

function buildDuplicateCandidatePairs(
  sourceStudents: DuplicateCandidateStudent[],
  comparisonPool: DuplicateCandidateStudent[],
  limit: number,
) {
  const seen = new Set<string>();
  const pairs: Array<{
    sourceStudent: ReturnType<typeof summarizeDuplicateCandidateStudent>;
    candidateStudent: ReturnType<typeof summarizeDuplicateCandidateStudent>;
    score: number;
    confidence: 'LOW' | 'MEDIUM' | 'HIGH';
    reasons: string[];
    blockedReason: string | null;
  }> = [];

  for (const source of sourceStudents) {
    for (const candidate of comparisonPool) {
      if (source.id === candidate.id) {
        continue;
      }

      const pairKey = [source.id, candidate.id].sort().join(':');
      if (seen.has(pairKey)) {
        continue;
      }
      seen.add(pairKey);

      const scored = scoreDuplicateCandidate(source, candidate);
      if (scored.score <= 0) {
        continue;
      }

      pairs.push({
        sourceStudent: summarizeDuplicateCandidateStudent(source),
        candidateStudent: summarizeDuplicateCandidateStudent(candidate),
        score: scored.score,
        confidence:
          scored.score >= 70 ? 'HIGH' : scored.score >= 40 ? 'MEDIUM' : 'LOW',
        reasons: scored.reasons,
        blockedReason:
          scored.score < 40
            ? 'Candidate needs stronger matching evidence before merge preview.'
            : null,
      });
    }
  }

  return pairs.sort((a, b) => b.score - a.score).slice(0, limit);
}

function scoreDuplicateCandidate(
  source: DuplicateCandidateStudent,
  candidate: DuplicateCandidateStudent,
) {
  // 1. Sibling group overlap check (Known Siblings are NOT duplicates of the same student)
  const shareSiblingGroup = source.siblingMemberships?.some((sm) =>
    candidate.siblingMemberships?.some(
      (cm) => cm.siblingGroupId === sm.siblingGroupId,
    ),
  );
  if (shareSiblingGroup) {
    return { score: 0, reasons: [] };
  }

  let score = 0;
  const reasons: string[] = [];

  // English Name Similarity
  const sourceNameEn = `${source.firstNameEn} ${source.lastNameEn}`;
  const candidateNameEn = `${candidate.firstNameEn} ${candidate.lastNameEn}`;
  const enSimilarity = calculateNameSimilarity(sourceNameEn, candidateNameEn);

  if (enSimilarity >= 0.85) {
    score += 25;
    reasons.push('Similar student name');
  }

  // Nepali Name Similarity
  if (
    source.firstNameNp &&
    source.lastNameNp &&
    candidate.firstNameNp &&
    candidate.lastNameNp
  ) {
    const sourceNameNp = `${source.firstNameNp} ${source.lastNameNp}`;
    const candidateNameNp = `${candidate.firstNameNp} ${candidate.lastNameNp}`;
    const npSimilarity = calculateNameSimilarity(sourceNameNp, candidateNameNp);
    if (npSimilarity >= 0.85) {
      score += 25;
      reasons.push('Similar student Nepali name');
    }
  }

  if (
    source.dateOfBirth.toISOString().slice(0, 10) ===
    candidate.dateOfBirth.toISOString().slice(0, 10)
  ) {
    score += 20;
    reasons.push('Same date of birth');
  }

  if (
    source.admissionNumber &&
    source.admissionNumber.trim().toLowerCase() ===
      candidate.admissionNumber?.trim().toLowerCase()
  ) {
    score += 50;
    reasons.push('Admission number conflict');
  }

  if (sharedGuardianPhone(source, candidate)) {
    score += 30;
    reasons.push('Shared guardian phone');
  }

  if (sharedGuardianEmail(source, candidate)) {
    score += 30;
    reasons.push('Shared guardian email');
  }

  if (
    source.previousSchool &&
    source.previousSchool.trim().toLowerCase() ===
      candidate.previousSchool?.trim().toLowerCase()
  ) {
    score += 10;
    reasons.push('Same previous school');
  }

  return { score: Math.min(score, 100), reasons };
}

function summarizeDuplicateCandidateStudent(
  student: DuplicateCandidateStudent,
) {
  return {
    id: student.id,
    studentSystemId: student.studentSystemId,
    fullNameEn: `${student.firstNameEn} ${student.lastNameEn}`.trim(),
    fullNameNp:
      student.firstNameNp || student.lastNameNp
        ? `${student.firstNameNp ?? ''} ${student.lastNameNp ?? ''}`.trim()
        : null,
    dateOfBirth: student.dateOfBirth.toISOString().slice(0, 10),
    admissionNumber: student.admissionNumber ?? null,
    previousSchool: student.previousSchool ?? null,
    lifecycleStatus: student.lifecycleStatus,
    className: student.class?.name ?? null,
    sectionName: student.sectionRef?.name ?? null,
    guardianPhones: guardianPhones(student),
    guardianEmails: guardianEmails(student),
  };
}

function sharedGuardianPhone(
  source: DuplicateCandidateStudent,
  candidate: DuplicateCandidateStudent,
) {
  const sourcePhones = new Set(guardianPhones(source));
  return guardianPhones(candidate).some((phone) => sourcePhones.has(phone));
}

function guardianPhones(student: DuplicateCandidateStudent) {
  return student.guardianLinks
    .flatMap((link) => [
      link.guardian.primaryPhone?.trim(),
      link.guardian.secondaryPhone?.trim(),
    ])
    .filter((phone): phone is string => Boolean(phone))
    .map(normalizePhoneNumber);
}

function sharedGuardianEmail(
  source: DuplicateCandidateStudent,
  candidate: DuplicateCandidateStudent,
) {
  const sourceEmails = new Set(guardianEmails(source));
  return guardianEmails(candidate).some((email) => sourceEmails.has(email));
}

function guardianEmails(student: DuplicateCandidateStudent) {
  return student.guardianLinks
    .map((link) => link.guardian.email?.trim().toLowerCase())
    .filter((email): email is string => Boolean(email));
}

function normalizePhoneNumber(phone: string) {
  const clean = phone.replace(/\D/g, '');
  return clean.length >= 10 ? clean.slice(-10) : clean;
}

function calculateNameSimilarity(a: string, b: string) {
  const left = new Set(normalizeStudentIdentityName(a).split(' '));
  const right = new Set(normalizeStudentIdentityName(b).split(' '));
  const intersection = [...left].filter((part) => right.has(part)).length;
  const union = new Set([...left, ...right]).size;

  return union === 0 ? 0 : intersection / union;
}

function startOfCurrentNepalMonth() {
  const now = new Date();
  const nepalOffsetMinutes = 5 * 60 + 45;
  const nepalNow = new Date(now.getTime() + nepalOffsetMinutes * 60 * 1000);
  const utcStart = Date.UTC(
    nepalNow.getUTCFullYear(),
    nepalNow.getUTCMonth(),
    1,
    0,
    0,
    0,
    0,
  );

  return new Date(utcStart - nepalOffsetMinutes * 60 * 1000);
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

const IEMIS_REQUIREMENT_VERSION = 'SCHOLOS-IEMIS-1.0';

const IEMIS_REQUIRED_RULE_CODES = [
  'STUDENT_SYSTEM_ID_REQUIRED',
  'ENGLISH_NAME_REQUIRED',
  'NEPALI_NAME_REQUIRED',
  'DATE_OF_BIRTH_REQUIRED',
  'GENDER_REQUIRED',
  'NATIONALITY_REQUIRED',
  'ADMISSION_DATE_REQUIRED',
  'ACTIVE_ACADEMIC_YEAR_REQUIRED',
  'CLASS_PLACEMENT_REQUIRED',
  'SECTION_PLACEMENT_REQUIRED',
  'GUARDIAN_CONTACT_REQUIRED',
  'ACTIVE_LIFECYCLE_REQUIRED',
] as const;

function buildStudentIemisReadiness(
  student: StudentDocumentPayload,
  evaluatedAt: Date,
): StudentIemisReadiness {
  const activeEnrollment = student.enrollments[0] ?? null;
  const issues = validateIemisStudent(student, evaluatedAt);
  const blockingIssueCount = issues.filter((issue) => issue.blocking).length;
  const warningCount = issues.filter(
    (issue) => issue.severity === 'WARNING',
  ).length;
  const totalRequiredChecks = IEMIS_REQUIRED_RULE_CODES.length;
  const passedRequiredChecks = Math.max(
    0,
    totalRequiredChecks - blockingIssueCount,
  );
  const exportEligible = blockingIssueCount === 0;
  const status =
    blockingIssueCount > 0
      ? 'BLOCKED'
      : warningCount > 0
        ? 'READY_WITH_WARNINGS'
        : 'READY';
  const academicYear = activeEnrollment?.academicYear.startsOn
    ? formatBsAcademicYear(
        toBsDateFromGregorian(activeEnrollment.academicYear.startsOn),
      )
    : (activeEnrollment?.academicYear.name ?? null);

  return {
    studentId: student.id,
    studentSystemId: student.studentSystemId,
    fullNameEn: `${student.firstNameEn} ${student.lastNameEn}`.trim(),
    nationalStudentId: student.nationalStudentId ?? null,
    status,
    passedRequiredChecks,
    totalRequiredChecks,
    blockingIssueCount,
    warningCount,
    exportEligible,
    eligible: exportEligible,
    evaluatedAt: evaluatedAt.toISOString(),
    requirementVersion: IEMIS_REQUIREMENT_VERSION,
    score: Math.round((passedRequiredChecks / totalRequiredChecks) * 100),
    academicYear,
    className: activeEnrollment?.class?.name ?? null,
    sectionName: activeEnrollment?.section?.name ?? null,
    rollNumber: activeEnrollment?.rollNumber ?? null,
    enrollmentStatus: activeEnrollment?.status ?? null,
    admissionDate:
      activeEnrollment?.admissionDate.toISOString() ??
      student.admissionDate?.toISOString() ??
      null,
    issues,
  };
}

function validateIemisStudent(
  student: StudentDocumentPayload,
  evaluatedAt = new Date(),
): StudentIemisReadinessIssue[] {
  const issues: StudentIemisReadinessIssue[] = [];
  const activeEnrollment = student.enrollments[0] ?? null;
  const hasGuardianContact = student.guardianLinks.some(
    (link) =>
      Boolean(link.guardian.primaryPhone) || Boolean(link.guardian.email),
  );

  const blocking = (
    issue: Omit<
      StudentIemisReadinessIssue,
      'severity' | 'blocking' | 'responsibleRole'
    >,
  ) => {
    issues.push({
      ...issue,
      severity: 'BLOCKING',
      blocking: true,
      responsibleRole: null,
    });
  };

  if (!student.studentSystemId) {
    blocking({
      code: 'STUDENT_SYSTEM_ID_REQUIRED',
      category: 'IDENTITY',
      title: 'SchoolOS student ID is missing',
      message:
        'A stable school student ID is required to identify this record in the reporting export.',
      field: 'studentSystemId',
      currentValueSafe: null,
      requiredAction:
        'Ask an authorized student records administrator to correct the student ID.',
      fixTarget: 'NONE',
      requiredPermission: 'students:update',
    });
  }

  if (!student.firstNameEn || !student.lastNameEn) {
    blocking({
      code: 'ENGLISH_NAME_REQUIRED',
      category: 'IDENTITY',
      title: 'English name is incomplete',
      message:
        "The student's English first and last name are required for government reporting.",
      field: 'fullNameEn',
      currentValueSafe:
        [student.firstNameEn, student.lastNameEn].filter(Boolean).join(' ') ||
        null,
      requiredAction: 'Complete the English first and last name.',
      fixTarget: 'STUDENT_PROFILE',
      requiredPermission: 'students:update',
    });
  }

  if (!student.firstNameNp || !student.lastNameNp) {
    blocking({
      code: 'NEPALI_NAME_REQUIRED',
      category: 'IDENTITY',
      title: 'Nepali name is missing',
      message:
        "The student's Nepali first and last name are required by the active SchoolOS reporting rule set.",
      field: 'fullNameNp',
      currentValueSafe:
        [student.firstNameNp, student.lastNameNp].filter(Boolean).join(' ') ||
        null,
      requiredAction:
        "Add the student's Nepali first and last name after authorized human review.",
      fixTarget: 'STUDENT_PROFILE',
      requiredPermission: 'students:update',
    });
  }

  if (!student.dateOfBirth || student.dateOfBirth > evaluatedAt) {
    blocking({
      code: 'DATE_OF_BIRTH_REQUIRED',
      category: 'IDENTITY',
      title: student.dateOfBirth
        ? 'Date of birth needs correction'
        : 'Date of birth is missing',
      message: student.dateOfBirth
        ? 'A future date of birth cannot be used for government reporting.'
        : "The student's date of birth is required for government reporting.",
      field: 'dateOfBirth',
      currentValueSafe: student.dateOfBirth
        ? formatBsDate(student.dateOfBirth)
        : null,
      requiredAction: 'Review and correct the date of birth.',
      fixTarget: 'STUDENT_PROFILE',
      requiredPermission: 'students:update',
    });
  }

  if (!student.gender) {
    blocking({
      code: 'GENDER_REQUIRED',
      category: 'IDENTITY',
      title: 'Gender is not recorded',
      message:
        'The active reporting rule requires an authorized gender value for this student.',
      field: 'gender',
      currentValueSafe: null,
      requiredAction:
        "Ask authorized staff to review the student's official record and select the recorded value.",
      fixTarget: 'STUDENT_PROFILE',
      requiredPermission: 'students:update',
    });
  }

  if (!student.nationality) {
    blocking({
      code: 'NATIONALITY_REQUIRED',
      category: 'IDENTITY',
      title: 'Nationality is not recorded',
      message:
        'Nationality is required by the active SchoolOS reporting rule set.',
      field: 'nationality',
      currentValueSafe: null,
      requiredAction: 'Review the official student record and add nationality.',
      fixTarget: 'STUDENT_PROFILE',
      requiredPermission: 'students:update',
    });
  }

  if (!activeEnrollment?.admissionDate && !student.admissionDate) {
    blocking({
      code: 'ADMISSION_DATE_REQUIRED',
      category: 'ENROLLMENT_PLACEMENT',
      title: 'Admission date is missing',
      message:
        "The student's admission date is required for the reporting record.",
      field: 'admissionDate',
      currentValueSafe: null,
      requiredAction:
        'Ask an authorized admissions administrator to correct the admission date on the active enrollment.',
      fixTarget: 'NONE',
      requiredPermission: 'enrollments:create',
    });
  }

  if (!activeEnrollment?.academicYear?.name) {
    blocking({
      code: 'ACTIVE_ACADEMIC_YEAR_REQUIRED',
      category: 'ENROLLMENT_PLACEMENT',
      title: activeEnrollment
        ? 'Academic year is missing'
        : 'Active enrollment is missing',
      message: activeEnrollment
        ? 'The active enrollment must identify the reporting academic year.'
        : 'The student needs an active enrollment before the record can be included in an export.',
      field: 'academicYear',
      currentValueSafe: null,
      requiredAction: activeEnrollment
        ? 'Correct the academic year on the active enrollment.'
        : "Create or restore the student's active enrollment.",
      fixTarget: activeEnrollment ? 'ENROLLMENT' : 'NONE',
      requiredPermission: 'enrollments:create',
    });
  }

  if (!activeEnrollment?.class?.name) {
    blocking({
      code: 'CLASS_PLACEMENT_REQUIRED',
      category: 'ENROLLMENT_PLACEMENT',
      title: 'Class is not assigned',
      message:
        "The active enrollment must include the student's class for the reporting period.",
      field: 'classId',
      currentValueSafe: null,
      requiredAction: activeEnrollment
        ? 'Assign the student to the correct class in the active enrollment.'
        : "Create or restore the student's active enrollment before assigning a class.",
      fixTarget: activeEnrollment ? 'ENROLLMENT' : 'NONE',
      requiredPermission: 'students:update',
    });
  }

  if (!activeEnrollment?.section?.name) {
    blocking({
      code: 'SECTION_PLACEMENT_REQUIRED',
      category: 'ENROLLMENT_PLACEMENT',
      title: 'Section is not assigned',
      message:
        'The active SchoolOS reporting rule requires a section for the selected academic year.',
      field: 'sectionId',
      currentValueSafe: activeEnrollment?.class?.name
        ? `Class: ${activeEnrollment.class.name}; section: not assigned`
        : null,
      requiredAction: activeEnrollment
        ? 'Assign the student to the correct section in the active enrollment.'
        : "Create or restore the student's active enrollment before assigning a section.",
      fixTarget: activeEnrollment ? 'ENROLLMENT' : 'NONE',
      requiredPermission: 'students:update',
    });
  }

  if (!hasGuardianContact) {
    blocking({
      code: 'GUARDIAN_CONTACT_REQUIRED',
      category: 'GUARDIAN_INFORMATION',
      title: 'Guardian contact is missing',
      message:
        'At least one linked guardian phone number or email address is required by the active reporting rule.',
      field: 'guardianContact',
      currentValueSafe: null,
      requiredAction: "Add or correct a linked guardian's contact information.",
      fixTarget: 'GUARDIANS',
      requiredPermission: 'guardians:update',
    });
  }

  if (student.lifecycleStatus !== StudentLifecycleStatus.ACTIVE) {
    blocking({
      code: 'ACTIVE_LIFECYCLE_REQUIRED',
      category: 'ENROLLMENT_PLACEMENT',
      title: 'Student record is not active',
      message: 'Only active students are exportable to iEMIS',
      field: 'lifecycleStatus',
      currentValueSafe: student.lifecycleStatus,
      requiredAction: 'Review the student lifecycle status before reporting.',
      fixTarget: 'NONE',
      requiredPermission: 'students:manage_lifecycle',
    });
  }

  if (!student.nationalStudentId) {
    issues.push({
      code: 'NATIONAL_STUDENT_ID_MISSING',
      category: 'IDENTITY',
      severity: 'WARNING',
      title: 'iEMIS identifier is not recorded',
      message:
        'The record remains exportable under the active SchoolOS rule set, but the identifier should be reviewed before submission.',
      field: 'nationalStudentId',
      blocking: false,
      currentValueSafe: null,
      requiredAction: 'Add the verified iEMIS identifier when it is available.',
      fixTarget: 'STUDENT_PROFILE',
      requiredPermission: 'students:update',
      responsibleRole: null,
    });
  }

  return issues;
}
