import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EnrollmentStatus,
  Prisma,
  StudentLifecycleStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { StudentsService } from '../students/students.service';
import {
  AutosaveAdmissionDraftDto,
  EnhancedDuplicateReviewDto,
  GenerateTransferCertificateDto,
  GraduateStudentDto,
  IemisReadinessSummaryDto,
  ImportReviewQueueDto,
  RecoverAdmissionDraftsDto,
  RemoveStudentGuardianAccessDto,
  ResolveAdmissionRelationshipsDto,
} from './dto/m1-admissions-hardening.dto';
import { normalizeAdmissionName } from './admissions.utils';

interface DuplicateSignal {
  code: string;
  label: string;
  weight: number;
}

type GuardianWithStudentLinks = Prisma.GuardianGetPayload<{
  include: {
    studentLinks: {
      include: {
        student: true;
      };
    };
  };
}>;

@Injectable()
export class M1AdmissionsHardeningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly studentsService: StudentsService,
  ) {}

  async getOwnershipAudit(studentId: string, actor: AuthContext) {
    const student = await this.findTenantStudent(studentId, actor);
    const [
      documents,
      generatedDocuments,
      registryFiles,
      qrCredentials,
      guardians,
    ] = await Promise.all([
      this.prisma.studentDocument.findMany({
        where: { tenantId: actor.tenantId, studentId: student.id },
        select: {
          id: true,
          fileId: true,
          kind: true,
          status: true,
          objectKey: true,
          uploadedById: true,
        },
      }),
      this.prisma.generatedStudentDocument.findMany({
        where: { tenantId: actor.tenantId, studentId: student.id },
        select: {
          id: true,
          kind: true,
          title: true,
          storageObjectKey: true,
          revokedAt: true,
          generatedAt: true,
        },
      }),
      this.prisma.fileAsset.findMany({
        where: {
          tenantId: actor.tenantId,
          module: 'students',
          entityId: student.id,
          deletedAt: null,
        },
        select: {
          id: true,
          originalFilename: true,
          objectKey: true,
          ownerType: true,
          ownerId: true,
          visibility: true,
          status: true,
        },
      }),
      this.prisma.studentQrCredential.findMany({
        where: { tenantId: actor.tenantId, studentId: student.id },
        select: {
          id: true,
          status: true,
          expiresAt: true,
          lastScannedAt: true,
          revokedAt: true,
          rotatedAt: true,
        },
      }),
      this.prisma.studentGuardian.findMany({
        where: { tenantId: actor.tenantId, studentId: student.id },
        include: { guardian: true },
      }),
    ]);

    await this.auditService.record({
      action: 'm1_access_scope_review',
      resource: 'student',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: student.id,
      after: {
        documentCount: documents.length,
        generatedDocumentCount: generatedDocuments.length,
        registryFileCount: registryFiles.length,
        qrCredentialCount: qrCredentials.length,
        guardianCount: guardians.length,
      },
    });

    return {
      student: formatStudentSummary(student),
      policy: {
        tenantScoped: true,
        studentScoped: true,
        generatedDocumentsRequireTenantAndStudentMatch: true,
        importHistoryRequiresTenantMatch: true,
        qrAnalyticsNeverReturnsTokenHash: true,
        guardianFileAccessRequiresActiveStudentGuardianLink: true,
      },
      documents,
      generatedDocuments: generatedDocuments.map((document) => ({
        ...document,
        generatedAt: document.generatedAt.toISOString(),
        revokedAt: document.revokedAt?.toISOString() ?? null,
      })),
      registryFiles: registryFiles.map((file) => ({
        ...file,
        objectKeyExposedForAdminReviewOnly: true,
      })),
      qrAnalytics: qrCredentials.map((credential) => ({
        id: credential.id,
        status: credential.status,
        expiresAt: credential.expiresAt?.toISOString() ?? null,
        lastScannedAt: credential.lastScannedAt?.toISOString() ?? null,
        rotatedAt: credential.rotatedAt?.toISOString() ?? null,
        revokedAt: credential.revokedAt?.toISOString() ?? null,
      })),
      guardians: guardians.map((link) => ({
        id: link.guardian.id,
        fullName: link.guardian.fullName,
        relation: link.relation || link.guardian.relation,
        primaryPhone: link.guardian.primaryPhone,
        isPrimary: link.isPrimary,
        canAccessStudentFiles: true,
      })),
    };
  }

  async autosaveAdmissionDraft(
    dto: AutosaveAdmissionDraftDto,
    actor: AuthContext,
  ) {
    const source = draftSource(dto.draftKey);
    await this.assertOptionalTenantReferences(dto, actor);

    const duplicateReview = await this.enhancedDuplicateReview(
      {
        firstNameEn:
          dto.firstNameEn ?? readString(dto.payload, 'firstNameEn') ?? 'Draft',
        lastNameEn:
          dto.lastNameEn ??
          readString(dto.payload, 'lastNameEn') ??
          'Applicant',
        firstNameNp: dto.firstNameNp ?? readString(dto.payload, 'firstNameNp'),
        lastNameNp: dto.lastNameNp ?? readString(dto.payload, 'lastNameNp'),
        dateOfBirth: dto.dateOfBirth ?? readString(dto.payload, 'dateOfBirth'),
        guardianPhones: dto.guardianPhone ? [dto.guardianPhone] : [],
        previousSchool:
          dto.previousSchool ?? readString(dto.payload, 'previousSchool'),
      },
      actor,
      false,
    );

    const notes = buildDraftNotes(dto, duplicateReview);
    const existing = await this.prisma.admissionApplication.findFirst({
      where: { tenantId: actor.tenantId, source },
    });

    const data = {
      status: 'INQUIRY',
      firstNameEn: normalizeRequiredName(dto.firstNameEn, 'Draft'),
      lastNameEn: normalizeRequiredName(dto.lastNameEn, 'Applicant'),
      firstNameNp: normalizeNullableString(dto.firstNameNp),
      lastNameNp: normalizeNullableString(dto.lastNameNp),
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
      guardianFullName: normalizeNullableString(dto.guardianFullName),
      guardianPhone: dto.guardianPhone
        ? normalizeGuardianPhone(dto.guardianPhone)
        : null,
      academicYearId: dto.academicYearId ?? null,
      classId: dto.classId ?? null,
      sectionId: dto.sectionId ?? null,
      previousSchool: normalizeNullableString(dto.previousSchool),
      source,
      notes,
      duplicateReview: duplicateReview as unknown as Prisma.InputJsonValue,
      updatedById: actor.userId,
    } satisfies Prisma.AdmissionApplicationUncheckedUpdateInput;

    const draft = existing
      ? await this.prisma.admissionApplication.update({
          where: { id: existing.id },
          data,
        })
      : await this.prisma.admissionApplication.create({
          data: {
            ...data,
            tenantId: actor.tenantId,
            createdById: actor.userId,
          },
        });

    await this.auditService.record({
      action: existing
        ? 'admission_draft_autosave_update'
        : 'admission_draft_autosave_create',
      resource: 'admission_application',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: draft.id,
      after: {
        draftKey: dto.draftKey,
        duplicateWarnings: duplicateReview.matches.length,
      },
    });

    return formatDraft(draft);
  }

  async recoverAdmissionDrafts(
    query: RecoverAdmissionDraftsDto,
    actor: AuthContext,
  ) {
    const where: Prisma.AdmissionApplicationWhereInput = {
      tenantId: actor.tenantId,
      status: { in: ['INQUIRY', 'APPLICATION', 'DOCUMENT_PENDING'] },
      source: query.draftKey
        ? draftSource(query.draftKey)
        : { startsWith: 'autosave:' },
      ...(query.guardianPhone
        ? { guardianPhone: normalizeGuardianPhone(query.guardianPhone) }
        : {}),
    };

    const drafts = await this.prisma.admissionApplication.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }],
      take: query.limit ?? 10,
    });

    return {
      items: drafts.map(formatDraft),
      total: drafts.length,
      recoveryPolicy:
        'Only tenant-owned in-progress autosave drafts are returned.',
    };
  }

  async enhancedDuplicateReview(
    dto: EnhancedDuplicateReviewDto,
    actor: AuthContext,
    audit = true,
  ) {
    const guardianPhones = (dto.guardianPhones ?? [])
      .filter(Boolean)
      .map(normalizeGuardianPhone);
    const sibling = dto.siblingStudentSystemId
      ? await this.prisma.student.findFirst({
          where: {
            tenantId: actor.tenantId,
            studentSystemId: dto.siblingStudentSystemId,
          },
          include: {
            guardianLinks: { include: { guardian: true } },
            siblingMemberships: true,
          },
        })
      : null;

    const siblingPhones = sibling
      ? sibling.guardianLinks
          .flatMap((link) => [
            link.guardian.primaryPhone,
            link.guardian.secondaryPhone,
          ])
          .filter((phone): phone is string => Boolean(phone))
          .map(normalizeGuardianPhone)
      : [];
    const siblingGroupIds = sibling
      ? sibling.siblingMemberships.map(
          (membership) => membership.siblingGroupId,
        )
      : [];
    const allPhones = [...new Set([...guardianPhones, ...siblingPhones])];

    const candidates = await this.prisma.student.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(dto.excludeStudentId ? { id: { not: dto.excludeStudentId } } : {}),
        OR: buildDuplicateSearchConditions(dto, allPhones, siblingGroupIds),
      },
      include: {
        class: true,
        sectionRef: true,
        guardianLinks: { include: { guardian: true } },
        siblingMemberships: true,
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
    });

    const matches = candidates
      .map((candidate) =>
        scoreDuplicateCandidate(candidate, dto, allPhones, siblingGroupIds),
      )
      .filter((match) => match.score > 0)
      .sort((a, b) => b.score - a.score);

    if (audit) {
      await this.auditService.record({
        action: 'admission_duplicate_review_enhanced',
        resource: 'admission',
        tenantId: actor.tenantId,
        userId: actor.userId,
        after: {
          matchCount: matches.length,
          usedNepaliName: Boolean(dto.firstNameNp || dto.lastNameNp),
          usedPreviousSchool: Boolean(dto.previousSchool),
          usedSiblingClues: Boolean(dto.siblingStudentSystemId),
          guardianPhoneCount: guardianPhones.length,
        },
      });
    }

    return {
      hasWarnings: matches.length > 0,
      reviewInputs: {
        nepaliNameProvided: Boolean(dto.firstNameNp || dto.lastNameNp),
        guardianPhoneCount: guardianPhones.length,
        previousSchoolProvided: Boolean(dto.previousSchool),
        siblingClueProvided: Boolean(dto.siblingStudentSystemId),
      },
      matches,
    };
  }

  async resolveRelationships(
    dto: ResolveAdmissionRelationshipsDto,
    actor: AuthContext,
  ) {
    const guardianPhones = (dto.guardianPhones ?? [])
      .filter(Boolean)
      .map(normalizeGuardianPhone);
    const guardiansPromise: Promise<GuardianWithStudentLinks[]> =
      guardianPhones.length > 0
        ? this.prisma.guardian.findMany({
            where: {
              tenantId: actor.tenantId,
              OR: [
                { primaryPhone: { in: guardianPhones } },
                { secondaryPhone: { in: guardianPhones } },
              ],
            },
            include: {
              studentLinks: {
                include: { student: true },
              },
            },
          })
        : Promise.resolve([]);
    const [guardians, sibling] = await Promise.all([
      guardiansPromise,
      dto.siblingStudentSystemId
        ? this.prisma.student.findFirst({
            where: {
              tenantId: actor.tenantId,
              studentSystemId: dto.siblingStudentSystemId,
            },
            include: {
              siblingMemberships: { include: { siblingGroup: true } },
              guardianLinks: { include: { guardian: true } },
            },
          })
        : Promise.resolve(null),
    ]);

    return {
      guardians: guardians.map((guardian) => ({
        id: guardian.id,
        fullName: guardian.fullName,
        relation: guardian.relation,
        primaryPhone: guardian.primaryPhone,
        linkedStudents: guardian.studentLinks.map((link) => ({
          id: link.student.id,
          studentSystemId: link.student.studentSystemId,
          fullNameEn:
            `${link.student.firstNameEn} ${link.student.lastNameEn}`.trim(),
          relation: link.relation,
        })),
        recommendedAction: 'reuse_existing_guardian',
      })),
      sibling: sibling
        ? {
            id: sibling.id,
            studentSystemId: sibling.studentSystemId,
            fullNameEn: `${sibling.firstNameEn} ${sibling.lastNameEn}`.trim(),
            existingSiblingGroupId:
              sibling.siblingMemberships[0]?.siblingGroupId ?? null,
            recommendedAction:
              sibling.siblingMemberships.length > 0
                ? 'attach_to_existing_sibling_group'
                : 'create_sibling_group_with_existing_student',
            guardians: sibling.guardianLinks.map((link) => ({
              id: link.guardian.id,
              fullName: link.guardian.fullName,
              primaryPhone: link.guardian.primaryPhone,
              relation: link.relation || link.guardian.relation,
            })),
          }
        : null,
      resolutionPolicy:
        'Guardian reuse is based on tenant-scoped phone ownership; sibling reuse is tenant-scoped by studentSystemId and existing sibling group.',
    };
  }

  async removeGuardianAccess(
    studentId: string,
    guardianId: string,
    dto: RemoveStudentGuardianAccessDto,
    actor: AuthContext,
  ) {
    if (!dto.confirmFileAccessReview) {
      throw new BadRequestException(
        'confirmFileAccessReview=true is required before removing a guardian because file access paths must be reviewed.',
      );
    }

    const link = await this.prisma.studentGuardian.findFirst({
      where: { tenantId: actor.tenantId, studentId, guardianId },
      include: { guardian: true, student: true },
    });
    if (!link) {
      throw new NotFoundException('Guardian link not found in this tenant');
    }

    const [documents, generatedDocuments, registryFiles] = await Promise.all([
      this.prisma.studentDocument.findMany({
        where: { tenantId: actor.tenantId, studentId },
        select: { id: true, title: true, kind: true },
      }),
      this.prisma.generatedStudentDocument.count({
        where: { tenantId: actor.tenantId, studentId },
      }),
      this.prisma.fileAsset.count({
        where: {
          tenantId: actor.tenantId,
          module: 'students',
          entityId: studentId,
          deletedAt: null,
        },
      }),
    ]);

    await this.prisma.$transaction(async (tx) => {
      const removed = await tx.studentGuardian.deleteMany({
        where: {
          id: link.id,
          tenantId: actor.tenantId,
          studentId,
          guardianId,
        },
      });
      if (removed.count !== 1) {
        throw new NotFoundException(
          'Guardian link was already removed or no longer belongs to this tenant',
        );
      }
      if (documents.length > 0) {
        await tx.studentDocumentHistory.createMany({
          data: documents.map((document) => ({
            tenantId: actor.tenantId,
            documentId: document.id,
            action: 'GUARDIAN_ACCESS_REVIEW',
            documentTitle: document.title,
            documentKind: document.kind,
            performedBy: actor.userId,
            reason:
              dto.reason ??
              'Guardian removed from student profile; file access must be re-evaluated.',
            metadata: {
              guardianId,
              studentId,
              relationshipRemoved: true,
            },
          })),
        });
      }
    });

    await this.auditService.record({
      action: 'guardian_removed_file_access_review',
      resource: 'student_guardian',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: link.id,
      before: {
        studentId,
        guardianId,
        guardianName: link.guardian.fullName,
      },
      after: {
        documentsReviewed: documents.length,
        generatedDocumentsReviewed: generatedDocuments,
        registryFilesReviewed: registryFiles,
      },
    });

    return {
      removed: true,
      student: formatStudentSummary(link.student),
      guardian: {
        id: link.guardian.id,
        fullName: link.guardian.fullName,
        primaryPhone: link.guardian.primaryPhone,
      },
      accessReview: {
        documentsReviewed: documents.length,
        generatedDocumentsReviewed: generatedDocuments,
        registryFilesReviewed: registryFiles,
        canAccessStudentFiles: false,
        policy:
          'After guardian removal, guardian file access must fail unless a fresh active StudentGuardian link exists.',
      },
    };
  }

  async generateIdCard(studentId: string, actor: AuthContext) {
    const student = await this.findTenantStudent(studentId, actor);
    await this.studentsService.generateStudentDocumentPdf(
      student.id,
      'ID_CARD',
      actor,
    );
    return this.latestGeneratedDocument(student.id, 'ID_CARD', actor, {
      workflowLabel: 'Student ID card generated',
      wording: 'Student Identity Card',
    });
  }

  async generateTransferCertificate(
    studentId: string,
    dto: GenerateTransferCertificateDto,
    actor: AuthContext,
  ) {
    const student = await this.findTenantStudent(studentId, actor);
    if (student.lifecycleStatus === StudentLifecycleStatus.ACTIVE) {
      await this.studentsService.requestTransfer(
        student.id,
        {
          reason: dto.reason ?? 'Transfer certificate requested',
          destinationSchool: dto.destinationSchool,
          exitedAt: dto.transferDate,
          waiveFeeClearance: dto.waiveFeeCheck,
        },
        actor,
      );
    }

    await this.studentsService.generateStudentDocumentPdf(
      student.id,
      'TRANSFER_CERTIFICATE',
      actor,
    );
    return this.latestGeneratedDocument(
      student.id,
      'TRANSFER_CERTIFICATE',
      actor,
      {
        workflowLabel: 'Transfer certificate generated',
        wording:
          'This certifies that the student was enrolled at the school and has been transferred according to school records.',
      },
    );
  }

  async graduateStudent(
    studentId: string,
    dto: GraduateStudentDto,
    actor: AuthContext,
  ) {
    const student = await this.findTenantStudent(studentId, actor);
    const graduatedAt = dto.graduatedAt
      ? new Date(dto.graduatedAt)
      : new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.enrollment.updateMany({
        where: {
          tenantId: actor.tenantId,
          studentId,
          status: EnrollmentStatus.ACTIVE,
        },
        data: { status: EnrollmentStatus.EXITED },
      });
      await tx.studentLifecycleTransition.create({
        data: {
          tenantId: actor.tenantId,
          studentId,
          fromStatus: student.lifecycleStatus,
          toStatus: StudentLifecycleStatus.ALUMNI,
          reason: dto.reason ?? 'Graduated and moved to alumni state',
          changedById: actor.userId,
          metadata: { graduatedAt: graduatedAt.toISOString() },
        },
      });
      return tx.student.update({
        where: { id: student.id },
        data: {
          lifecycleStatus: StudentLifecycleStatus.ALUMNI,
          exitReason: dto.reason ?? 'Graduated',
          exitedAt: graduatedAt,
        },
      });
    });

    await this.auditService.record({
      action: 'graduate_to_alumni',
      resource: 'student',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: student.id,
      before: { lifecycleStatus: student.lifecycleStatus },
      after: {
        lifecycleStatus: updated.lifecycleStatus,
        exitedAt: updated.exitedAt,
      },
    });

    return {
      id: updated.id,
      studentSystemId: updated.studentSystemId,
      lifecycleStatus: updated.lifecycleStatus,
      alumniState: 'ALUMNI',
      graduatedAt: updated.exitedAt?.toISOString() ?? null,
    };
  }

  async listImportReviewQueue(query: ImportReviewQueueDto, actor: AuthContext) {
    const where: Prisma.AdmissionImportRowWhereInput = {
      tenantId: actor.tenantId,
      ...(query.status
        ? { status: query.status.toUpperCase() }
        : {
            OR: [
              { status: 'FAILED' },
              { duplicates: { not: Prisma.JsonNull } },
            ],
          }),
    };
    const rows = await this.prisma.admissionImportRow.findMany({
      where,
      include: { batch: true },
      orderBy: [{ createdAt: 'desc' }, { rowNumber: 'asc' }],
      take: query.limit ?? 50,
    });

    return {
      items: rows.map((row) => ({
        id: row.id,
        batchId: row.batchId,
        sourceFileName: row.batch.sourceFileName,
        rowNumber: row.rowNumber,
        status: row.status,
        workflowLabel: importReviewLabel(row.status),
        errors: normalizeJsonArray(row.errors),
        duplicates: normalizeJsonArray(row.duplicates),
        rawData: row.rawData ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      total: rows.length,
      policy:
        'Import-review queue is tenant-scoped and only returns rows needing review or matching the requested status.',
    };
  }

  async getIemisReadinessSummary(
    query: IemisReadinessSummaryDto,
    actor: AuthContext,
  ) {
    const students = await this.prisma.student.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(query.classId ? { classId: query.classId } : {}),
        ...(query.sectionId ? { sectionId: query.sectionId } : {}),
        lifecycleStatus: {
          notIn: [
            StudentLifecycleStatus.DELETED,
            StudentLifecycleStatus.MERGED,
          ],
        },
      },
      include: {
        class: true,
        sectionRef: true,
        guardianLinks: { include: { guardian: true } },
        enrollments: { where: { status: EnrollmentStatus.ACTIVE }, take: 1 },
      },
      orderBy: [{ studentSystemId: 'asc' }],
      take: 1000,
    });

    const items = students.map((student) => {
      const blockers: string[] = [];
      const warnings: string[] = [];
      if (!student.firstNameEn || !student.lastNameEn)
        blockers.push('english_name_missing');
      if (student.guardianLinks.length === 0) blockers.push('guardian_missing');
      if (
        student.guardianLinks.length > 0 &&
        !student.guardianLinks.some((link) => link.guardian.primaryPhone)
      ) {
        blockers.push('guardian_phone_missing');
      }
      if (!student.disabilityFlag)
        blockers.push('iemis_disability_flag_missing');
      if (student.enrollments.length === 0)
        blockers.push('active_enrollment_missing');
      if (!student.firstNameNp || !student.lastNameNp)
        warnings.push('nepali_name_missing');
      if (!student.nationalStudentId)
        warnings.push('national_student_id_missing');
      if (!student.previousSchool) warnings.push('previous_school_missing');

      return {
        studentId: student.id,
        studentSystemId: student.studentSystemId,
        fullNameEn: `${student.firstNameEn} ${student.lastNameEn}`.trim(),
        className: student.class.name,
        sectionName: student.sectionRef?.name ?? student.section ?? null,
        ready: blockers.length === 0,
        blockers,
        warnings,
      };
    });

    return {
      total: items.length,
      ready: items.filter((item) => item.ready).length,
      hasIssues: items.filter((item) => !item.ready).length,
      warningsOnly: items.filter(
        (item) => item.ready && item.warnings.length > 0,
      ).length,
      items,
      refinements: {
        exportBlockedBy: [
          'missing guardian phone',
          'missing disability flag',
          'missing active enrollment',
        ],
        exportWarnings: [
          'missing Nepali name',
          'missing national student ID',
          'missing previous school',
        ],
      },
    };
  }

  getWorkflowLabels() {
    return {
      application: {
        INQUIRY: 'Inquiry received',
        APPLICATION: 'Application in progress',
        DOCUMENT_PENDING: 'Documents pending',
        ENTRANCE_INTERVIEW: 'Entrance or interview scheduled',
        ACCEPTED: 'Accepted for enrollment',
        ENROLLED: 'Enrolled as student',
        REJECTED: 'Application closed as rejected',
      },
      importReview: {
        FAILED: 'Needs correction before import',
        VALIDATED: 'Validated and ready to create',
        CREATED: 'Student created from import',
        COMPLETED_WITH_ERRORS: 'Completed with rows needing review',
      },
      generatedDocuments: {
        ID_CARD: 'Student Identity Card',
        TRANSFER_CERTIFICATE: 'Transfer Certificate',
      },
    };
  }

  private async latestGeneratedDocument(
    studentId: string,
    kind: string,
    actor: AuthContext,
    extra: Record<string, string>,
  ) {
    const document = await this.prisma.generatedStudentDocument.findFirst({
      where: { tenantId: actor.tenantId, studentId, kind },
      orderBy: [{ generatedAt: 'desc' }],
    });
    if (!document) {
      throw new NotFoundException(
        'Generated document metadata was not persisted',
      );
    }
    return {
      id: document.id,
      studentId: document.studentId,
      kind: document.kind,
      title: document.title,
      fileName: document.fileName,
      contentType: document.contentType,
      sizeBytes: document.sizeBytes,
      pdfUrl: document.pdfUrl,
      generatedAt: document.generatedAt.toISOString(),
      checksumSha256: document.checksumSha256,
      storageObjectKey: document.storageObjectKey,
      ...extra,
    };
  }

  private async findTenantStudent(studentId: string, actor: AuthContext) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId: actor.tenantId },
      include: { class: true, sectionRef: true },
    });
    if (!student) {
      throw new NotFoundException('Student not found in this tenant');
    }
    return student;
  }

  private async assertOptionalTenantReferences(
    dto: Pick<
      AutosaveAdmissionDraftDto,
      'academicYearId' | 'classId' | 'sectionId'
    >,
    actor: AuthContext,
  ) {
    const [academicYear, classroom, section] = await Promise.all([
      dto.academicYearId
        ? this.prisma.academicYear.findFirst({
            where: { id: dto.academicYearId, tenantId: actor.tenantId },
            select: { id: true },
          })
        : Promise.resolve(null),
      dto.classId
        ? this.prisma.class.findFirst({
            where: { id: dto.classId, tenantId: actor.tenantId },
            select: { id: true },
          })
        : Promise.resolve(null),
      dto.sectionId
        ? this.prisma.section.findFirst({
            where: { id: dto.sectionId, tenantId: actor.tenantId },
            select: { id: true, classId: true },
          })
        : Promise.resolve(null),
    ]);
    if (dto.academicYearId && !academicYear)
      throw new NotFoundException('Academic year not found in this tenant');
    if (dto.classId && !classroom)
      throw new NotFoundException('Class not found in this tenant');
    if (dto.sectionId && !section)
      throw new NotFoundException('Section not found in this tenant');
    if (section && dto.classId && section.classId !== dto.classId) {
      throw new BadRequestException(
        'Section must belong to the selected class in this tenant',
      );
    }
  }
}

function buildDuplicateSearchConditions(
  dto: EnhancedDuplicateReviewDto,
  phones: string[],
  siblingGroupIds: string[],
): Prisma.StudentWhereInput[] {
  const conditions: Prisma.StudentWhereInput[] = [
    {
      firstNameEn: { equals: dto.firstNameEn, mode: 'insensitive' },
      lastNameEn: { equals: dto.lastNameEn, mode: 'insensitive' },
    },
    { lastNameEn: { equals: dto.lastNameEn, mode: 'insensitive' } },
  ];
  if (dto.dateOfBirth)
    conditions.push({ dateOfBirth: new Date(dto.dateOfBirth) });
  if (dto.firstNameNp && dto.lastNameNp) {
    conditions.push({
      firstNameNp: { equals: dto.firstNameNp, mode: 'insensitive' },
      lastNameNp: { equals: dto.lastNameNp, mode: 'insensitive' },
    });
  }
  if (phones.length > 0) {
    conditions.push({
      guardianLinks: {
        some: {
          guardian: {
            OR: [
              { primaryPhone: { in: phones } },
              { secondaryPhone: { in: phones } },
            ],
          },
        },
      },
    });
  }
  if (dto.previousSchool) {
    conditions.push({
      previousSchool: { contains: dto.previousSchool, mode: 'insensitive' },
    });
  }
  if (siblingGroupIds.length > 0) {
    conditions.push({
      siblingMemberships: { some: { siblingGroupId: { in: siblingGroupIds } } },
    });
  }
  return conditions;
}

function scoreDuplicateCandidate(
  candidate: Prisma.StudentGetPayload<{
    include: {
      class: true;
      sectionRef: true;
      guardianLinks: { include: { guardian: true } };
      siblingMemberships: true;
    };
  }>,
  dto: EnhancedDuplicateReviewDto,
  phones: string[],
  siblingGroupIds: string[],
) {
  const signals: DuplicateSignal[] = [];
  const candidatePhones = candidate.guardianLinks
    .flatMap((link) => [
      link.guardian.primaryPhone,
      link.guardian.secondaryPhone,
    ])
    .filter((phone): phone is string => Boolean(phone))
    .map(normalizeGuardianPhone);
  const phoneReuse = phones.some((phone) => candidatePhones.includes(phone));
  const englishName =
    normalizeAdmissionName(candidate.firstNameEn) ===
      normalizeAdmissionName(dto.firstNameEn) &&
    normalizeAdmissionName(candidate.lastNameEn) ===
      normalizeAdmissionName(dto.lastNameEn);
  const nepaliName =
    Boolean(
      dto.firstNameNp &&
      dto.lastNameNp &&
      candidate.firstNameNp &&
      candidate.lastNameNp,
    ) &&
    normalizeAdmissionName(candidate.firstNameNp ?? '') ===
      normalizeAdmissionName(dto.firstNameNp ?? '') &&
    normalizeAdmissionName(candidate.lastNameNp ?? '') ===
      normalizeAdmissionName(dto.lastNameNp ?? '');
  const dob = dto.dateOfBirth
    ? candidate.dateOfBirth.toISOString().slice(0, 10) ===
      dto.dateOfBirth.slice(0, 10)
    : false;
  const samePreviousSchool =
    Boolean(dto.previousSchool && candidate.previousSchool) &&
    normalizeAdmissionName(candidate.previousSchool ?? '') ===
      normalizeAdmissionName(dto.previousSchool ?? '');
  const siblingGroup = siblingGroupIds.some((id) =>
    candidate.siblingMemberships.some(
      (membership) => membership.siblingGroupId === id,
    ),
  );
  if (englishName && dob)
    signals.push({
      code: 'english_name_dob',
      label: 'English name and DOB match',
      weight: 45,
    });
  if (nepaliName && dob)
    signals.push({
      code: 'nepali_name_dob',
      label: 'Nepali name and DOB match',
      weight: 45,
    });
  if (phoneReuse)
    signals.push({
      code: 'guardian_phone_reuse',
      label: 'Guardian phone is already used',
      weight: 25,
    });
  if (samePreviousSchool)
    signals.push({
      code: 'previous_school_match',
      label: 'Previous school matches',
      weight: 15,
    });
  if (siblingGroup)
    signals.push({
      code: 'sibling_group_clue',
      label: 'Sibling group clue matches',
      weight: 20,
    });
  if (
    !englishName &&
    normalizeAdmissionName(candidate.lastNameEn) ===
      normalizeAdmissionName(dto.lastNameEn)
  ) {
    signals.push({
      code: 'same_english_last_name',
      label: 'English last name matches',
      weight: 8,
    });
  }
  if (dob && !englishName && !nepaliName)
    signals.push({ code: 'same_dob', label: 'DOB matches', weight: 8 });
  const score = signals.reduce((sum, signal) => sum + signal.weight, 0);
  return {
    studentId: candidate.id,
    studentSystemId: candidate.studentSystemId,
    fullNameEn: `${candidate.firstNameEn} ${candidate.lastNameEn}`.trim(),
    fullNameNp:
      [candidate.firstNameNp, candidate.lastNameNp].filter(Boolean).join(' ') ||
      null,
    dateOfBirth: candidate.dateOfBirth.toISOString(),
    className: candidate.class.name,
    sectionName: candidate.sectionRef?.name ?? candidate.section ?? null,
    previousSchool: candidate.previousSchool,
    score,
    riskLevel: score >= 70 ? 'HIGH' : score >= 35 ? 'MEDIUM' : 'LOW',
    signals,
  };
}

function formatStudentSummary(student: {
  id: string;
  studentSystemId: string;
  firstNameEn: string;
  lastNameEn: string;
  lifecycleStatus?: StudentLifecycleStatus;
}) {
  return {
    id: student.id,
    studentSystemId: student.studentSystemId,
    fullNameEn: `${student.firstNameEn} ${student.lastNameEn}`.trim(),
    lifecycleStatus: student.lifecycleStatus,
  };
}

function formatDraft(application: {
  id: string;
  source: string | null;
  status: string;
  firstNameEn: string;
  lastNameEn: string;
  guardianPhone: string | null;
  notes: string | null;
  duplicateReview: Prisma.JsonValue | null;
  updatedAt: Date;
  createdAt: Date;
}) {
  return {
    id: application.id,
    draftKey: application.source?.startsWith('autosave:')
      ? application.source.slice('autosave:'.length)
      : null,
    status: application.status,
    fullNameEn: `${application.firstNameEn} ${application.lastNameEn}`.trim(),
    guardianPhone: application.guardianPhone,
    payload: parseDraftPayload(application.notes),
    duplicateReview: application.duplicateReview,
    createdAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),
  };
}

function buildDraftNotes(
  dto: AutosaveAdmissionDraftDto,
  duplicateReview: unknown,
) {
  return JSON.stringify({
    m1AdmissionDraft: true,
    draftKey: dto.draftKey,
    payload: dto.payload ?? {},
    previousSchool: dto.previousSchool ?? null,
    autosavedAt: new Date().toISOString(),
    duplicateReview,
  });
}

function parseDraftPayload(notes: string | null) {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes) as { payload?: unknown };
    return parsed.payload ?? parsed;
  } catch {
    return null;
  }
}

function readString(payload: Record<string, unknown> | undefined, key: string) {
  const value = payload?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeRequiredName(value: string | undefined, fallback: string) {
  return value?.trim() || fallback;
}

function normalizeNullableString(value: string | undefined) {
  return value?.trim() || null;
}

function normalizeGuardianPhone(phone: string) {
  return phone.trim().replace(/\s+/g, ' ');
}

function draftSource(draftKey: string) {
  return `autosave:${draftKey.trim()}`;
}

function normalizeJsonArray(value: Prisma.JsonValue | null) {
  return Array.isArray(value) ? value : [];
}

function importReviewLabel(status: string) {
  const labels: Record<string, string> = {
    FAILED: 'Needs correction before import',
    VALIDATED: 'Validated and ready to create',
    CREATED: 'Student created from import',
  };
  return labels[status] ?? 'Needs review';
}
