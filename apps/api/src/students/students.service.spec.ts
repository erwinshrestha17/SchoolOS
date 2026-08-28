import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  AttendanceStatus,
  AuthMethod,
  EnrollmentStatus,
  FileStatus,
  GuardianCapability,
  GuardianRelationshipApprovalStatus,
  GuardianRelationshipStatus,
  GuardianRelationshipVerificationStatus,
  Prisma,
  StudentLifecycleStatus,
} from '@prisma/client';
import sharp from 'sharp';
import { StudentsService } from './students.service';
import { TeacherCapability } from '../teacher-scope/teacher-capability';
import {
  createTeacherScopeDeniedException,
  TEACHER_SCOPE_DENIED_CODE,
} from '../teacher-scope/teacher-scope.service';

const actor = {
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  userId: 'user-1',
  email: 'admin@schoolos.test',
  authMethod: AuthMethod.PASSWORD,
  roles: ['admin'],
  permissions: [
    'students:read',
    'students:update',
    'students:manage_lifecycle',
    'students:delete',
    'guardians:update',
    'student_documents:manage',
    'guardians:verify',
  ],
};

describe('students lifecycle hardening', () => {
  it('returns actor-scoped paginated student options without guardian data', async () => {
    const prisma = buildPrisma({
      studentFindManyResult: [
        {
          id: 'student-1',
          studentSystemId: 'SCH-2026-0001',
          admissionNumber: 'ADM-001',
          firstNameEn: 'Maya',
          lastNameEn: 'Shrestha',
          classId: 'class-1',
          class: { name: 'Grade 5' },
          sectionId: 'section-1',
          sectionRef: { name: 'A' },
          section: 'A',
        },
      ],
      studentCountQueue: [27],
    });
    const { service } = buildService(prisma);

    const result = await service.listStudentOptions(
      {
        search: 'Maya',
        classId: 'class-1',
        sectionId: 'section-1',
        page: 2,
        limit: 25,
      },
      actor,
    );

    const findManyQuery = prisma.student.findMany.mock.calls[0][0];
    expect(findManyQuery).toEqual(
      expect.objectContaining({
        select: {
          id: true,
          studentSystemId: true,
          admissionNumber: true,
          firstNameEn: true,
          lastNameEn: true,
          classId: true,
          class: { select: { name: true } },
          sectionId: true,
          sectionRef: { select: { name: true } },
          section: true,
        },
        skip: 25,
        take: 25,
      }),
    );
    expect(JSON.stringify(findManyQuery)).not.toContain('guardian');
    expect(findManyQuery.where.AND[0].AND).toEqual(
      expect.arrayContaining([
        { tenantId: actor.tenantId },
        { lifecycleStatus: StudentLifecycleStatus.ACTIVE },
      ]),
    );
    expect(result).toEqual({
      items: [
        {
          id: 'student-1',
          studentSystemId: 'SCH-2026-0001',
          admissionNumber: 'ADM-001',
          fullNameEn: 'Maya Shrestha',
          classId: 'class-1',
          className: 'Grade 5',
          sectionId: 'section-1',
          sectionName: 'A',
        },
      ],
      total: 27,
      page: 2,
      limit: 25,
      hasNextPage: true,
    });
  });

  it("keeps student options limited to a parent's linked children", async () => {
    const parentActor = {
      ...actor,
      userId: 'parent-user-options',
      roles: ['parent'],
      permissions: ['students:read'],
    };
    const prisma = buildPrisma({
      studentFindManyResult: [],
      studentCountQueue: [0],
      guardianFindFirstQueue: [
        {
          id: 'guardian-options',
          tenantId: parentActor.tenantId,
          userId: parentActor.userId,
          studentLinks: [{ studentId: 'student-own-options' }],
        },
      ],
    });
    const { service } = buildService(prisma);

    await service.listStudentOptions({ search: 'Ma' }, parentActor);

    expect(prisma.student.count).toHaveBeenCalledWith({
      where: {
        AND: [
          {
            AND: expect.arrayContaining([
              { tenantId: parentActor.tenantId },
              { id: { in: ['student-own-options'] } },
              { lifecycleStatus: StudentLifecycleStatus.ACTIVE },
            ]),
          },
          expect.objectContaining({ OR: expect.any(Array) }),
        ],
      },
    });
  });

  it("keeps student options limited to a teacher's assigned sections", async () => {
    const teacherActor = {
      ...actor,
      userId: 'teacher-user-options',
      roles: ['subject_teacher'],
      permissions: ['students:read'],
    };
    const prisma = buildPrisma({
      studentFindManyResult: [],
      studentCountQueue: [0],
    });
    const { service } = buildService(prisma, {
      resolveReadableScope: jest.fn().mockResolvedValue({
        assignments: [],
        homeroomSectionIds: new Set<string>(),
        subjectsBySection: new Map([
          ['section-options', new Set(['subject-options'])],
        ]),
        allSectionIds: new Set(['section-options']),
      }),
    });

    await service.listStudentOptions({ search: 'Ma' }, teacherActor);

    expect(prisma.student.count).toHaveBeenCalledWith({
      where: {
        AND: [
          {
            AND: expect.arrayContaining([
              { tenantId: teacherActor.tenantId },
              { OR: [{ sectionId: 'section-options' }] },
              { lifecycleStatus: StudentLifecycleStatus.ACTIVE },
            ]),
          },
          expect.objectContaining({ OR: expect.any(Array) }),
        ],
      },
    });
  });

  it('lists students with academic-year, guardian, and admission filters without dropping pagination', async () => {
    const student = {
      ...buildStudent(),
      guardianLinks: [
        {
          guardian: {
            id: 'guardian-1',
            fullName: 'Maya Shrestha',
            primaryPhone: '9800000000',
            secondaryPhone: null,
            email: 'maya@example.com',
            occupation: 'Engineer',
            wardNumber: '5',
            privacyConsentAt: new Date('2026-01-01T00:00:00.000Z'),
          },
          relation: 'mother',
          isPrimary: true,
          capabilities: [GuardianCapability.ACADEMICS_VIEW],
          verificationStatus: GuardianRelationshipVerificationStatus.VERIFIED,
          status: GuardianRelationshipStatus.ACTIVE,
          effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
          effectiveUntil: null,
          emergencyContactPriority: 1,
          approvalStatus: GuardianRelationshipApprovalStatus.APPROVED,
          restrictionReasonRef: null,
        },
      ],
      qrCredentials: [
        {
          id: 'qr-1',
          status: 'ACTIVE',
          createdById: actor.userId,
          updatedById: null,
          expiresAt: null,
          createdAt: new Date('2026-02-01T00:00:00.000Z'),
          rotatedAt: null,
          revokedAt: null,
          rotateReason: null,
          revokeReason: null,
          lastScannedAt: null,
        },
      ],
      _count: { documents: 2 },
      user: { email: 'student@example.com' },
    };
    const prisma = buildPrisma({
      studentFindManyResult: [student],
      studentCountQueue: [1],
    });
    const { service } = buildService(prisma);

    const result = await service.listStudents(
      {
        academicYearId: 'academic-year-1',
        classId: 'class-1',
        sectionId: 'section-1',
        search: 'Maya',
        page: 2,
        limit: 25,
      },
      actor,
    );

    expect(prisma.student.count).toHaveBeenCalledWith({
      where: {
        AND: expect.arrayContaining([
          { tenantId: actor.tenantId },
          { classId: 'class-1' },
          { sectionId: 'section-1' },
          {
            enrollments: {
              some: expect.objectContaining({
                tenantId: actor.tenantId,
                academicYearId: 'academic-year-1',
              }),
            },
          },
          expect.objectContaining({
            OR: expect.arrayContaining([
              { admissionNumber: { contains: 'Maya', mode: 'insensitive' } },
              expect.objectContaining({
                guardianLinks: expect.any(Object),
              }),
            ]),
          }),
        ]),
      },
    });
    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 25,
        take: 25,
      }),
    );
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        studentSystemId: 'SCH-2026-0001',
        fullNameEn: 'Erwin Shrestha',
        sectionName: 'A',
        documentCount: 2,
        guardians: [
          expect.objectContaining({
            fullName: 'Maya Shrestha',
            primaryPhone: '9800000000',
          }),
        ],
        qrCredential: expect.objectContaining({ id: 'qr-1' }),
      }),
    );
  });

  it('uses a minimal support directory projection without protected-file, QR, login, or extra guardian metadata', async () => {
    const student = {
      ...buildStudent(),
      guardianLinks: [
        {
          guardian: {
            id: 'guardian-1',
            fullName: 'Maya Shrestha',
            primaryPhone: '9800000000',
            secondaryPhone: '9800000001',
            email: 'private@example.com',
            occupation: 'Private occupation',
            wardNumber: '5',
            privacyConsentAt: new Date('2026-01-01T00:00:00.000Z'),
          },
          relation: 'mother',
          isPrimary: true,
          capabilities: [GuardianCapability.ACADEMICS_VIEW],
          verificationStatus: GuardianRelationshipVerificationStatus.VERIFIED,
          status: GuardianRelationshipStatus.ACTIVE,
          effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
          effectiveUntil: null,
          emergencyContactPriority: 1,
          approvalStatus: GuardianRelationshipApprovalStatus.APPROVED,
          restrictionReasonRef: 'SAFEGUARD-PRIVATE-1',
        },
      ],
      qrCredentials: [{ id: 'private-qr', status: 'ACTIVE' }],
      _count: { documents: 7 },
      user: { email: 'student-private@example.com' },
      userId: 'student-user-private',
      photoFileId: 'private-photo',
    };
    const prisma = buildPrisma({
      studentFindManyResult: [student],
      studentCountQueue: [1],
    });
    const { service } = buildService(prisma);
    const supportActor = {
      ...actor,
      roles: [],
      permissions: ['students:read'],
      isSupportOverride: true,
      supportOverrideReadOnly: true,
      supportOverrideScopes: ['STUDENT_RECORDS' as const],
    };

    const result = await service.listStudents({}, supportActor);
    const query = prisma.student.findMany.mock.calls[0][0];

    expect(query.select._count).toBe(false);
    expect(query.select.qrCredentials).toBe(false);
    expect(query.select.photoFileId).toBe(false);
    expect(query.select.userId).toBe(false);
    expect(query.select.user).toBe(false);
    expect(query.select.guardianLinks.select.guardian.select).toEqual(
      expect.objectContaining({
        primaryPhone: true,
        secondaryPhone: false,
        email: false,
        occupation: false,
        wardNumber: false,
        privacyConsentAt: false,
      }),
    );
    expect(result.items[0]).not.toHaveProperty('documentCount');
    expect(result.items[0]).not.toHaveProperty('qrCredential.id');
    expect(result.items[0]).not.toHaveProperty('email');
    expect(result.items[0]).not.toHaveProperty('hasLogin');
    expect(result.items[0].photoVersion).toBeNull();
    expect(result.items[0].guardians[0]).toEqual(
      expect.objectContaining({
        fullName: 'Maya Shrestha',
        primaryPhone: '9800000000',
        secondaryPhone: null,
        email: null,
        occupation: null,
        wardNumber: null,
        consentedAt: null,
        restrictionReasonRef: null,
      }),
    );
  });

  it('matches a full student name across separate first-name and last-name fields', async () => {
    const prisma = buildPrisma({
      studentFindManyResult: [],
      studentCountQueue: [0],
    });
    const { service } = buildService(prisma);

    await service.listStudents({ search: '  Erwin   Shrestha  ' }, actor);

    expect(prisma.student.count).toHaveBeenCalledWith({
      where: {
        AND: expect.arrayContaining([
          { tenantId: actor.tenantId },
          {
            AND: [
              expect.objectContaining({
                OR: expect.arrayContaining([
                  {
                    firstNameEn: {
                      contains: 'Erwin',
                      mode: 'insensitive',
                    },
                  },
                ]),
              }),
              expect.objectContaining({
                OR: expect.arrayContaining([
                  {
                    lastNameEn: {
                      contains: 'Shrestha',
                      mode: 'insensitive',
                    },
                  },
                ]),
              }),
            ],
          },
        ]),
      },
    });
  });

  it('returns module-owned M1 summary counts from tenant-scoped backend queries', async () => {
    const duplicateA = buildStudent({
      id: 'student-a',
      studentSystemId: 'SCH-2026-0001',
      firstNameEn: 'Erwin',
      lastNameEn: 'Shrestha',
      guardianLinks: [
        {
          guardian: {
            fullName: 'Maya Shrestha',
            primaryPhone: '9800000000',
            email: 'maya@example.com',
            wardNumber: '5',
          },
          relation: 'mother',
          isPrimary: true,
        },
      ],
    });
    const duplicateB = buildStudent({
      id: 'student-b',
      studentSystemId: 'SCH-2026-0002',
      firstNameEn: 'Erwin',
      lastNameEn: 'Shrestha',
      guardianLinks: [
        {
          guardian: {
            fullName: 'Maya Shrestha',
            primaryPhone: '9800000000',
            email: 'maya@example.com',
            wardNumber: '5',
          },
          relation: 'mother',
          isPrimary: true,
        },
      ],
    });
    const prisma = buildPrisma({
      studentCountQueue: [4, 2, 1],
      studentGroupByResult: [
        { lifecycleStatus: StudentLifecycleStatus.ACTIVE, _count: { _all: 3 } },
        {
          lifecycleStatus: StudentLifecycleStatus.TRANSFERRED,
          _count: { _all: 1 },
        },
      ],
      studentFindManyResult: [duplicateA, duplicateB],
      admissionApplicationCountResult: 5,
      studentQrCredentialCountResult: 3,
    });
    const { service } = buildService(prisma);

    const result = await service.getStudentModuleSummary(
      {
        academicYearId: 'academic-year-1',
        classId: 'class-1',
        sectionId: 'section-1',
        search: 'Erwin',
      },
      actor,
    );

    expect(prisma.student.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['lifecycleStatus'],
        where: {
          AND: expect.arrayContaining([
            { tenantId: actor.tenantId },
            { classId: 'class-1' },
            { sectionId: 'section-1' },
          ]),
        },
      }),
    );
    expect(prisma.admissionApplication.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        tenantId: actor.tenantId,
        academicYearId: 'academic-year-1',
        classId: 'class-1',
      }),
    });
    expect(result).toEqual(
      expect.objectContaining({
        totalStudents: 4,
        activeStudents: 3,
        transferredStudents: 1,
        pendingApplications: 5,
        missingDocuments: 1,
        qrActive: 3,
        qrMissing: 1,
        duplicateCandidates: 1,
        filters: expect.objectContaining({
          academicYearId: 'academic-year-1',
          classId: 'class-1',
          sectionId: 'section-1',
          search: 'Erwin',
        }),
      }),
    );
  });

  it('builds support summary only from student rows and never queries admissions, files, QR, or duplicate candidates', async () => {
    const prisma = buildPrisma({
      studentCountQueue: [4],
      studentGroupByResult: [
        { lifecycleStatus: StudentLifecycleStatus.ACTIVE, _count: { _all: 4 } },
      ],
    });
    const { service } = buildService(prisma);
    const supportActor = {
      ...actor,
      roles: [],
      permissions: ['students:read'],
      isSupportOverride: true,
      supportOverrideReadOnly: true,
      supportOverrideScopes: ['STUDENT_RECORDS' as const],
    };

    const result = await service.getSupportStudentModuleSummary(
      { search: '9800000000' },
      supportActor,
    );

    expect(result).toEqual(
      expect.objectContaining({
        totalStudents: 4,
        activeStudents: 4,
        newAdmissions: null,
        pendingApplications: null,
        missingDocuments: null,
        duplicateCandidates: null,
        iemisReady: null,
        iemisIssues: null,
        qrActive: null,
        qrMissing: null,
      }),
    );
    expect(prisma.admissionApplication.count).not.toHaveBeenCalled();
    expect(prisma.studentQrCredential.count).not.toHaveBeenCalled();
    expect(prisma.student.findMany).not.toHaveBeenCalled();
    expect(prisma.studentDocument.findMany).not.toHaveBeenCalled();
  });

  describe('student directory actor scoping (confirmed gap: previously tenant-wide for any students:read holder)', () => {
    it("scopes the directory to a parent's own linked children", async () => {
      const parentActor = {
        ...actor,
        userId: 'parent-user-1',
        roles: ['parent'],
        permissions: ['students:read'],
      };
      const prisma = buildPrisma({
        studentFindManyResult: [
          {
            ...buildStudent(),
            qrCredentials: [],
            _count: { documents: 0 },
            user: null,
          },
        ],
        studentCountQueue: [1],
        guardianFindFirstQueue: [
          {
            id: 'guardian-1',
            tenantId: parentActor.tenantId,
            userId: parentActor.userId,
            studentLinks: [
              { studentId: 'student-own-1' },
              { studentId: 'student-own-2' },
            ],
          },
        ],
      });
      const { service } = buildService(prisma);

      await service.listStudents({}, parentActor);

      expect(prisma.student.count).toHaveBeenCalledWith({
        where: {
          AND: expect.arrayContaining([
            { tenantId: parentActor.tenantId },
            { id: { in: ['student-own-1', 'student-own-2'] } },
          ]),
        },
      });
    });

    it('blocks a parent with no linked guardian record from seeing any students', async () => {
      const parentActor = {
        ...actor,
        userId: 'parent-user-2',
        roles: ['parent'],
        permissions: ['students:read'],
      };
      const prisma = buildPrisma({
        studentFindManyResult: [],
        studentCountQueue: [0],
        guardianFindFirstQueue: [],
      });
      const { service } = buildService(prisma);

      await service.listStudents({}, parentActor);

      expect(prisma.student.count).toHaveBeenCalledWith({
        where: {
          AND: expect.arrayContaining([
            { tenantId: parentActor.tenantId },
            { id: { in: [] } },
          ]),
        },
      });
    });

    it("scopes the directory to a teacher's assigned classes/sections", async () => {
      const teacherActor = {
        ...actor,
        userId: 'teacher-user-1',
        roles: ['subject_teacher'],
        permissions: ['students:read'],
      };
      const prisma = buildPrisma({
        studentFindManyResult: [
          {
            ...buildStudent(),
            qrCredentials: [],
            _count: { documents: 0 },
            user: null,
          },
        ],
        studentCountQueue: [1],
      });
      const { service } = buildService(prisma, {
        resolveReadableScope: jest.fn().mockResolvedValue({
          assignments: [],
          homeroomSectionIds: new Set(['section-9']),
          subjectsBySection: new Map([
            ['section-1', new Set(['subject-1'])],
            ['section-2', new Set(['subject-2'])],
          ]),
          allSectionIds: new Set(['section-1', 'section-2', 'section-9']),
        }),
      });

      await service.listStudents({}, teacherActor);

      expect(prisma.student.count).toHaveBeenCalledWith({
        where: {
          AND: expect.arrayContaining([
            { tenantId: teacherActor.tenantId },
            {
              OR: [
                { sectionId: 'section-1' },
                { sectionId: 'section-2' },
                { sectionId: 'section-9' },
              ],
            },
          ]),
        },
      });
    });

    it('returns an empty directory scope for a teacher with no active assignment', async () => {
      const teacherActor = {
        ...actor,
        userId: 'teacher-user-2',
        roles: ['teacher'],
        permissions: ['students:read'],
      };
      const prisma = buildPrisma({
        studentFindManyResult: [],
        studentCountQueue: [0],
      });
      const { service } = buildService(prisma);

      await service.listStudents({}, teacherActor);

      expect(prisma.student.count).toHaveBeenCalledWith({
        where: {
          AND: [{ tenantId: teacherActor.tenantId }, { id: { in: [] } }],
        },
      });
    });

    it('leaves the student directory unrestricted for admin/principal actors', async () => {
      const prisma = buildPrisma({
        studentFindManyResult: [
          {
            ...buildStudent(),
            qrCredentials: [],
            _count: { documents: 0 },
            user: null,
          },
        ],
        studentCountQueue: [1],
      });
      const { service } = buildService(prisma);

      await service.listStudents({}, actor);

      expect(prisma.staff.findFirst).not.toHaveBeenCalled();
      expect(prisma.student.count).toHaveBeenCalledWith({
        where: { AND: [{ tenantId: actor.tenantId }] },
      });
    });
  });

  it('transfers an active student and records an immutable transition', async () => {
    const student = buildStudent({
      lifecycleStatus: StudentLifecycleStatus.ACTIVE,
    });
    const prisma = buildPrisma({
      studentFindFirstQueue: [student],
      invoiceFindManyQueue: [[]],
    });
    const { service, auditService } = buildService(prisma);

    const result = await service.requestTransfer(
      student.id,
      {
        reason: 'Family relocation',
        destinationSchool: 'New Horizon School',
        conductRemark: 'Good standing',
        exitedAt: '2026-04-27',
      },
      actor,
    );

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(prisma.transaction.student.findFirst).toHaveBeenCalledWith({
      where: {
        id: student.id,
        tenantId: actor.tenantId,
      },
      select: {
        id: true,
        studentSystemId: true,
        lifecycleStatus: true,
        feeClearanceWaivedAt: true,
      },
    });
    expect(prisma.transaction.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: actor.tenantId,
          studentId: student.id,
          status: { not: 'VOID' },
        },
      }),
    );
    expect(prisma.transaction.student.updateMany).toHaveBeenCalledWith({
      where: {
        id: student.id,
        tenantId: actor.tenantId,
        lifecycleStatus: StudentLifecycleStatus.ACTIVE,
      },
      data: {
        lifecycleStatus: StudentLifecycleStatus.TRANSFERRED,
        exitReason: 'Family relocation',
        exitedAt: new Date('2026-04-27T00:00:00.000Z'),
        destinationSchool: 'New Horizon School',
        conductRemark: 'Good standing',
      },
    });
    expect(prisma.transaction.enrollment.updateMany).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        studentId: student.id,
        status: EnrollmentStatus.ACTIVE,
      },
      data: {
        status: EnrollmentStatus.TRANSFERRED,
        effectiveUntil: expect.any(Date),
      },
    });
    expect(
      prisma.transaction.studentLifecycleTransition.create,
    ).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: actor.tenantId,
        studentId: student.id,
        fromStatus: StudentLifecycleStatus.ACTIVE,
        toStatus: StudentLifecycleStatus.TRANSFERRED,
        reason: 'Family relocation',
        changedById: actor.userId,
        feeClearanceWaived: false,
        metadata: expect.objectContaining({
          feeClearance: expect.objectContaining({
            clearedBeforeDecision: true,
            outstandingAmountAtDecision: 0,
            waiverGranted: false,
          }),
        }),
      }),
    });
    expect(prisma.studentLifecycleTransition.create).not.toHaveBeenCalled();
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'transfer',
        resource: 'student',
        resourceId: student.id,
      }),
      prisma.transaction,
    );
    expect(result.lifecycleStatus).toBe(StudentLifecycleStatus.TRANSFERRED);
  });

  it('blocks invalid lifecycle transitions', async () => {
    const student = buildStudent({
      lifecycleStatus: StudentLifecycleStatus.TRANSFERRED,
    });
    const prisma = buildPrisma({
      studentFindFirstQueue: [student],
    });
    const { service } = buildService(prisma);

    await expect(
      service.requestTransfer(
        student.id,
        {
          reason: 'Duplicate transfer request',
        },
        actor,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('archives alumni with enrollment closure and lifecycle history in one transaction', async () => {
    const student = buildStudent({
      lifecycleStatus: StudentLifecycleStatus.ACTIVE,
    });
    const prisma = buildPrisma({
      studentFindFirstQueue: [student],
    });
    const { service, auditService } = buildService(prisma);

    const result = await service.archiveAlumni(
      student.id,
      {
        reason: 'SEE completed',
        exitedAt: '2026-04-30',
      },
      actor,
    );

    expect(prisma.transaction.student.updateMany).toHaveBeenCalledWith({
      where: {
        id: student.id,
        tenantId: actor.tenantId,
        lifecycleStatus: StudentLifecycleStatus.ACTIVE,
      },
      data: {
        lifecycleStatus: StudentLifecycleStatus.ALUMNI,
        exitReason: 'SEE completed',
        exitedAt: new Date('2026-04-30T00:00:00.000Z'),
      },
    });
    expect(prisma.transaction.enrollment.updateMany).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        studentId: student.id,
        status: EnrollmentStatus.ACTIVE,
      },
      data: {
        status: EnrollmentStatus.EXITED,
        effectiveUntil: new Date('2026-04-30T00:00:00.000Z'),
      },
    });
    expect(
      prisma.transaction.studentLifecycleTransition.create,
    ).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: actor.tenantId,
        studentId: student.id,
        fromStatus: StudentLifecycleStatus.ACTIVE,
        toStatus: StudentLifecycleStatus.ALUMNI,
        reason: 'SEE completed',
        changedById: actor.userId,
      }),
    });
    expect(prisma.studentLifecycleTransition.create).not.toHaveBeenCalled();
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'archive_alumni',
        before: { lifecycleStatus: StudentLifecycleStatus.ACTIVE },
        after: expect.objectContaining({
          lifecycleStatus: StudentLifecycleStatus.ALUMNI,
        }),
      }),
      prisma.transaction,
    );
    expect(result.lifecycleStatus).toBe(StudentLifecycleStatus.ALUMNI);
  });

  it('rejects a stale concurrent alumni transition before closing enrollments', async () => {
    const student = buildStudent({
      lifecycleStatus: StudentLifecycleStatus.ACTIVE,
    });
    const prisma = buildPrisma({
      studentFindFirstQueue: [student],
      transactionStudentUpdateManyCount: 0,
    });
    const { service, auditService } = buildService(prisma);

    await expect(
      service.archiveAlumni(
        student.id,
        { reason: 'SEE completed', exitedAt: '2026-04-30' },
        actor,
      ),
    ).rejects.toThrow(ConflictException);

    expect(prisma.transaction.enrollment.updateMany).not.toHaveBeenCalled();
    expect(
      prisma.transaction.studentLifecycleTransition.create,
    ).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('archives an exited student with enrollment closure and lifecycle history atomically', async () => {
    const student = buildStudent({
      lifecycleStatus: StudentLifecycleStatus.ACTIVE,
    });
    const prisma = buildPrisma({
      studentFindFirstQueue: [student],
      invoiceFindManyQueue: [[]],
    });
    const { service } = buildService(prisma);

    const result = await service.archiveStudent(
      student.id,
      { reason: 'Family relocation', exitedAt: '2026-04-30' },
      actor,
    );

    expect(prisma.transaction.student.updateMany).toHaveBeenCalledWith({
      where: {
        id: student.id,
        tenantId: actor.tenantId,
        lifecycleStatus: StudentLifecycleStatus.ACTIVE,
      },
      data: {
        lifecycleStatus: StudentLifecycleStatus.EXITED,
        exitReason: 'Family relocation',
        exitedAt: new Date('2026-04-30T00:00:00.000Z'),
      },
    });
    expect(prisma.transaction.enrollment.updateMany).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        studentId: student.id,
        status: EnrollmentStatus.ACTIVE,
      },
      data: {
        status: EnrollmentStatus.EXITED,
        effectiveUntil: new Date('2026-04-30T00:00:00.000Z'),
      },
    });
    expect(
      prisma.transaction.studentLifecycleTransition.create,
    ).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: actor.tenantId,
        studentId: student.id,
        fromStatus: StudentLifecycleStatus.ACTIVE,
        toStatus: StudentLifecycleStatus.EXITED,
        reason: 'Family relocation',
      }),
    });
    expect(prisma.studentLifecycleTransition.create).not.toHaveBeenCalled();
    expect(result.lifecycleStatus).toBe(StudentLifecycleStatus.EXITED);
  });

  it('soft deletes students without removing finance or document history', async () => {
    const student = buildStudent({
      lifecycleStatus: StudentLifecycleStatus.ACTIVE,
    });
    const prisma = buildPrisma({
      studentFindFirstQueue: [student],
      invoiceFindManyQueue: [[]],
    });
    const { service } = buildService(prisma);

    const result = await service.deleteStudent(
      student.id,
      {
        reason: 'Merged duplicate record',
        deletedAt: '2026-04-27',
      },
      actor,
    );

    expect(prisma.transaction.student.updateMany).toHaveBeenCalledWith({
      where: {
        id: student.id,
        tenantId: actor.tenantId,
        lifecycleStatus: StudentLifecycleStatus.ACTIVE,
      },
      data: {
        lifecycleStatus: StudentLifecycleStatus.DELETED,
        exitReason: 'Merged duplicate record',
        exitedAt: new Date('2026-04-27T00:00:00.000Z'),
      },
    });
    expect(
      prisma.transaction.studentLifecycleTransition.create,
    ).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: actor.tenantId,
        studentId: student.id,
        fromStatus: StudentLifecycleStatus.ACTIVE,
        toStatus: StudentLifecycleStatus.DELETED,
        reason: 'Merged duplicate record',
      }),
    });
    expect(prisma.studentLifecycleTransition.create).not.toHaveBeenCalled();
    expect('delete' in prisma.student).toBe(false);
    expect(result.lifecycleStatus).toBe(StudentLifecycleStatus.DELETED);
  });

  it('merges an active duplicate into a canonical student and soft-deletes the source', async () => {
    const sourceStudent = buildStudent({
      id: 'student-source',
      studentSystemId: 'SCH-2026-0002',
      guardianLinks: [
        {
          guardianId: 'guardian-source',
          guardian: {
            fullName: 'Maya Shrestha',
            primaryPhone: '9800000000',
            email: 'maya@example.com',
            wardNumber: '5',
          },
          relation: 'mother',
          isPrimary: true,
          appLoginLinked: false,
        },
      ],
    });
    const targetStudent = buildStudent({
      id: 'student-target',
      studentSystemId: 'SCH-2026-0001',
      guardianLinks: [],
    });
    const prisma = buildPrisma({
      studentFindFirstQueue: [sourceStudent, targetStudent],
    });
    const { service, auditService } = buildService(prisma);

    const result = await service.mergeDuplicateStudent(
      {
        sourceStudentId: sourceStudent.id,
        targetStudentId: targetStudent.id,
        reason: 'Duplicate record confirmed by registrar',
      },
      actor,
    );

    expect(prisma.transaction.studentGuardian.createMany).toHaveBeenCalledWith({
      data: [
        {
          tenantId: actor.tenantId,
          studentId: targetStudent.id,
          guardianId: 'guardian-source',
          relation: 'mother',
          isPrimary: true,
          appLoginLinked: false,
        },
      ],
      skipDuplicates: true,
    });
    expect(prisma.transaction.invoice.updateMany).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        studentId: sourceStudent.id,
      },
      data: { studentId: targetStudent.id },
    });
    expect(prisma.transaction.student.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: sourceStudent.id,
          tenantId: actor.tenantId,
          lifecycleStatus: {
            in: [
              StudentLifecycleStatus.ACTIVE,
              StudentLifecycleStatus.ARCHIVED,
            ],
          },
        }),
        data: expect.objectContaining({
          lifecycleStatus: StudentLifecycleStatus.MERGED,
          exitReason: `Merged into ${targetStudent.studentSystemId}: Duplicate record confirmed by registrar`,
        }),
      }),
    );
    expect(
      prisma.transaction.studentLifecycleTransition.create,
    ).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: actor.tenantId,
        studentId: sourceStudent.id,
        fromStatus: StudentLifecycleStatus.ACTIVE,
        toStatus: StudentLifecycleStatus.MERGED,
        reason: 'Duplicate record confirmed by registrar',
        changedById: actor.userId,
        metadata: expect.objectContaining({
          mergeType: 'duplicate_student_merge',
          mergedIntoStudentId: targetStudent.id,
        }),
      }),
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'merge_duplicate',
        resource: 'student',
        resourceId: sourceStudent.id,
      }),
      prisma.transaction,
    );
    expect(result.sourceStudent.lifecycleStatus).toBe(
      StudentLifecycleStatus.MERGED,
    );
  });

  it('rejects duplicate merge when identity evidence does not match', async () => {
    const sourceStudent = buildStudent({
      id: 'student-source',
      firstNameEn: 'Erwin',
    });
    const targetStudent = buildStudent({
      id: 'student-target',
      studentSystemId: 'SCH-2026-9999',
      firstNameEn: 'Sita',
      dateOfBirth: new Date('2014-01-02T00:00:00.000Z'),
      admissionNumber: 'ADM-9999',
    });
    const prisma = buildPrisma({
      studentFindFirstQueue: [sourceStudent, targetStudent],
    });
    const { service } = buildService(prisma);

    await expect(
      service.mergeDuplicateStudent(
        {
          sourceStudentId: sourceStudent.id,
          targetStudentId: targetStudent.id,
          reason: 'Mistaken duplicate',
        },
        actor,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.transaction.student.updateMany).not.toHaveBeenCalled();
  });

  it('returns validation-first iEMIS export results', async () => {
    const validStudent = buildStudent({
      id: 'student-valid',
      studentSystemId: 'SCH-2026-0001',
      firstNameNp: 'एरविन',
      lastNameNp: 'श्रेष्ठ',
      section: 'A',
      guardianLinks: [
        {
          guardian: {
            fullName: 'Maya Shrestha',
            primaryPhone: '9800000000',
            email: 'maya@example.com',
            wardNumber: '5',
          },
          relation: 'mother',
          isPrimary: true,
        },
      ],
      enrollments: [
        {
          academicYear: { name: '2083' },
          classId: 'class-1',
          class: { name: 'Grade 1' },
          section: { name: 'A' },
          status: EnrollmentStatus.ACTIVE,
        },
      ],
    });
    const invalidStudent = buildStudent({
      id: 'student-invalid',
      studentSystemId: 'SCH-2026-0002',
      firstNameNp: null,
      lastNameNp: null,
      section: null,
      sectionRef: null,
      lifecycleStatus: StudentLifecycleStatus.DELETED,
      guardianLinks: [],
      enrollments: [],
    });
    const prisma = buildPrisma({
      studentFindManyResult: [validStudent, invalidStudent],
    });
    const { service, storageService } = buildService(prisma);

    const result = await service.exportIemis(actor);

    expect(result.formatVersion).toBe('SCHOLOS-IEMIS-1.0');
    expect(result.totalRecords).toBe(2);
    expect(result.validRecords).toBe(1);
    expect(result.invalidRecords).toBe(1);
    const csv = (
      storageService.saveBufferObject.mock.calls[0][0].content as Buffer
    ).toString('utf8');
    expect(csv).toContain('studentSystemId');
    expect(csv).toContain('SCH-2026-0001');
    expect(csv).not.toContain('SCH-2026-0002');
    expect(result).not.toHaveProperty('rows');
    expect(result).not.toHaveProperty('csv');
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          studentId: 'student-invalid',
          field: 'fullNameNp',
        }),
        expect.objectContaining({
          studentId: 'student-invalid',
          field: 'guardianContact',
        }),
        expect.objectContaining({
          studentId: 'student-invalid',
          field: 'lifecycleStatus',
        }),
      ]),
    );
  });

  it('rejects attempts to edit immutable student system IDs', async () => {
    const prisma = buildPrisma({});
    const { service } = buildService(prisma);

    await expect(
      service.updateStudent(
        'student-1',
        { studentSystemId: 'SCH-2026-9999' } as never,
        actor,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.student.findFirst).not.toHaveBeenCalled();
  });

  it('updates mutable student fields with tenant-scoped placement checks and audit logging', async () => {
    const student = buildStudent({
      disabilityFlag: null,
      enrollments: [
        {
          id: 'enrollment-1',
          academicYearId: 'year-1',
          classId: 'class-1',
          sectionId: 'section-1',
          academicYear: { name: '2083' },
          class: { name: 'Grade 1' },
          section: { name: 'A' },
          status: EnrollmentStatus.ACTIVE,
          rollNumber: 7,
          admissionDate: new Date('2026-04-01T00:00:00.000Z'),
        } as any,
      ],
    });
    const updatedProfileStudent = buildStudent({
      ...student,
      firstNameEn: 'Aarav',
      disabilityFlag: 'No known disability',
    });
    const prisma = buildPrisma({
      studentFindFirstQueue: [student, updatedProfileStudent],
      classFindFirstResult: { id: 'class-1', tenantId: actor.tenantId },
      sectionFindFirstResult: {
        id: 'section-1',
        tenantId: actor.tenantId,
        classId: 'class-1',
        name: 'A',
      },
      enrollmentFindFirstResult: null,
      activityPostFindManyResult: [],
    });
    const { service, auditService } = buildService(prisma);

    await service.updateStudent(
      student.id,
      {
        firstNameEn: 'Aarav',
        disabilityFlag: 'No known disability',
        classId: 'class-1',
        sectionId: 'section-1',
        rollNumber: 8,
      },
      actor,
    );

    expect(prisma.class.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'class-1',
        tenantId: actor.tenantId,
      },
    });
    expect(prisma.section.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'section-1',
        tenantId: actor.tenantId,
        classId: 'class-1',
      },
    });
    expect(prisma.enrollment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: actor.tenantId,
          academicYearId: 'year-1',
          classId: 'class-1',
          sectionId: 'section-1',
          rollNumber: 8,
          studentId: { not: student.id },
        }),
      }),
    );
    expect(prisma.transaction.student.update).toHaveBeenCalledWith({
      where: { id: student.id },
      data: expect.objectContaining({
        firstNameEn: 'Aarav',
        disabilityFlag: 'No known disability',
        classId: 'class-1',
        sectionId: 'section-1',
        rollNumber: 8,
      }),
    });
    expect(prisma.transaction.enrollment.update).toHaveBeenCalledWith({
      where: { id: 'enrollment-1' },
      data: expect.objectContaining({
        rollNumber: 8,
      }),
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        resource: 'student',
        tenantId: actor.tenantId,
        resourceId: student.id,
      }),
    );
  });

  it('closes the prior enrollment segment when class or section changes', async () => {
    const student = buildStudent({
      disabilityFlag: 'No known disability',
      enrollments: [
        {
          id: 'enrollment-1',
          academicYearId: 'year-1',
          classId: 'class-1',
          sectionId: 'section-1',
          academicYear: { name: '2083' },
          class: { name: 'Grade 1' },
          section: { name: 'A' },
          status: EnrollmentStatus.ACTIVE,
          rollNumber: 7,
          admissionDate: new Date('2026-04-01T00:00:00.000Z'),
          admissionNumber: 'ADM-1',
          mediumOfInstruction: 'English',
        } as any,
      ],
    });
    const updatedProfileStudent = buildStudent({
      ...student,
      classId: 'class-2',
      disabilityFlag: 'No known disability',
      section: 'B',
    } as any);
    const prisma = buildPrisma({
      studentFindFirstQueue: [student, updatedProfileStudent],
      classFindFirstResult: { id: 'class-2', tenantId: actor.tenantId },
      sectionFindFirstResult: {
        id: 'section-2',
        tenantId: actor.tenantId,
        classId: 'class-2',
        name: 'B',
      },
      enrollmentFindFirstResult: null,
      activityPostFindManyResult: [],
    });
    const { service } = buildService(prisma);

    await service.updateStudent(
      student.id,
      {
        classId: 'class-2',
        sectionId: 'section-2',
        confirmNoDisability: true,
      },
      actor,
    );

    expect(prisma.transaction.enrollment.update).toHaveBeenCalledWith({
      where: { id: 'enrollment-1' },
      data: expect.objectContaining({
        status: EnrollmentStatus.TRANSFERRED,
        effectiveUntil: expect.any(Date),
      }),
    });
    expect(prisma.transaction.enrollment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        classId: 'class-2',
        sectionId: 'section-2',
        status: EnrollmentStatus.ACTIVE,
        effectiveFrom: expect.any(Date),
        effectiveUntil: null,
      }),
    });
  });

  it('blocks roll number conflicts during student placement updates', async () => {
    const student = buildStudent({
      enrollments: [
        {
          id: 'enrollment-1',
          academicYearId: 'year-1',
          classId: 'class-1',
          sectionId: 'section-1',
          academicYear: { name: '2083' },
          class: { name: 'Grade 1' },
          section: { name: 'A' },
          status: EnrollmentStatus.ACTIVE,
          admissionDate: new Date('2026-04-01T00:00:00.000Z'),
        },
      ],
    });
    const prisma = buildPrisma({
      studentFindFirstQueue: [student],
      classFindFirstResult: { id: 'class-1', tenantId: actor.tenantId },
      sectionFindFirstResult: {
        id: 'section-1',
        tenantId: actor.tenantId,
        classId: 'class-1',
        name: 'A',
      },
      enrollmentFindFirstResult: {
        id: 'enrollment-conflict',
        studentId: 'student-2',
        rollNumber: 7,
        student: {
          studentSystemId: 'SCH-2026-0002',
          firstNameEn: 'Sita',
          lastNameEn: 'Rai',
        },
        class: { name: 'Grade 1' },
        section: { name: 'A' },
      },
    });
    const { service } = buildService(prisma);

    await expect(
      service.updateStudent(
        student.id,
        {
          rollNumber: 7,
          confirmNoDisability: true,
        },
        actor,
      ),
    ).rejects.toThrow(ConflictException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('updates linked guardians through the student relationship with audit logging', async () => {
    const link = {
      id: 'student-guardian-1',
      tenantId: actor.tenantId,
      studentId: 'student-1',
      guardianId: 'guardian-1',
      relation: 'mother',
      isPrimary: false,
      capabilities: [GuardianCapability.ACADEMICS_VIEW],
      verificationStatus: GuardianRelationshipVerificationStatus.VERIFIED,
      status: GuardianRelationshipStatus.ACTIVE,
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      effectiveUntil: null,
      emergencyContactPriority: 1,
      approvalStatus: GuardianRelationshipApprovalStatus.APPROVED,
      restrictionReasonRef: null,
      guardian: {
        id: 'guardian-1',
        fullName: 'Maya Shrestha',
        relation: 'mother',
        primaryPhone: '9800000000',
        secondaryPhone: null,
        email: 'maya@example.com',
        occupation: null,
        homeAddress: null,
        wardNumber: null,
      },
    };
    const prisma = buildPrisma({
      studentGuardianFindFirstResult: link,
      guardianFindFirstQueue: [null],
      studentFindFirstQueue: [
        buildStudent({
          guardianLinks: [
            {
              guardianId: 'guardian-1',
              guardian: {
                id: 'guardian-1',
                fullName: 'Maya Shrestha',
                relation: 'mother',
                primaryPhone: '9811111111',
                email: 'maya@example.com',
                wardNumber: null,
              },
              relation: 'mother',
              isPrimary: true,
              capabilities: [GuardianCapability.ACADEMICS_VIEW],
              verificationStatus:
                GuardianRelationshipVerificationStatus.VERIFIED,
              status: GuardianRelationshipStatus.ACTIVE,
              effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
              effectiveUntil: null,
              emergencyContactPriority: 1,
              approvalStatus: GuardianRelationshipApprovalStatus.APPROVED,
              restrictionReasonRef: null,
            },
          ],
        }),
      ],
      activityPostFindManyResult: [],
    });
    const { service, auditService } = buildService(prisma);

    await service.updateStudentGuardian(
      'student-1',
      'guardian-1',
      {
        primaryPhone: '9811111111',
        isPrimary: true,
      },
      actor,
    );

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(prisma.transaction.studentGuardian.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        studentId: 'student-1',
        guardianId: 'guardian-1',
      },
      include: {
        guardian: true,
      },
    });
    expect(prisma.transaction.studentGuardian.updateMany).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        studentId: 'student-1',
        id: { not: link.id },
      },
      data: { isPrimary: false },
    });
    expect(prisma.transaction.guardian.updateMany).toHaveBeenCalledWith({
      where: { id: 'guardian-1', tenantId: actor.tenantId },
      data: {
        primaryPhone: '+9779811111111',
      },
    });
    expect(prisma.transaction.studentGuardian.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: link.id,
        tenantId: actor.tenantId,
        studentId: 'student-1',
        guardianId: 'guardian-1',
      }),
      data: { isPrimary: true },
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        resource: 'student_guardian',
        tenantId: actor.tenantId,
        resourceId: link.id,
      }),
      prisma.transaction,
    );
  });

  it('clears existing primary guardians before promoting another link (P1-05)', async () => {
    const link = {
      id: 'student-guardian-2',
      tenantId: actor.tenantId,
      studentId: 'student-1',
      guardianId: 'guardian-2',
      relation: 'father',
      isPrimary: false,
      capabilities: [GuardianCapability.ACADEMICS_VIEW],
      verificationStatus: GuardianRelationshipVerificationStatus.VERIFIED,
      status: GuardianRelationshipStatus.ACTIVE,
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      effectiveUntil: null,
      emergencyContactPriority: null,
      approvalStatus: GuardianRelationshipApprovalStatus.APPROVED,
      restrictionReasonRef: null,
      guardian: {
        id: 'guardian-2',
        fullName: 'Ram Shrestha',
        relation: 'father',
        primaryPhone: '9800000001',
        secondaryPhone: null,
        email: null,
        occupation: null,
        homeAddress: null,
        wardNumber: null,
      },
    };
    const prisma = buildPrisma({
      studentGuardianFindFirstResult: link,
      guardianFindFirstQueue: [null],
      studentGuardianFindManyResult: [
        { id: 'link-1', guardianId: 'guardian-1', isPrimary: true },
        { id: link.id, guardianId: 'guardian-2', isPrimary: false },
      ],
      studentFindFirstQueue: [buildStudent({ id: 'student-1' })],
      activityPostFindManyResult: [],
    });
    const { service } = buildService(prisma);

    await service.updateStudentGuardian(
      'student-1',
      'guardian-2',
      { isPrimary: true },
      actor,
    );

    expect(prisma.transaction.studentGuardian.updateMany).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        studentId: 'student-1',
        id: { not: link.id },
      },
      data: { isPrimary: false },
    });
  });

  it('rejects promotion of a revoked or expired guardian relationship', async () => {
    const baseLink = buildGuardianAdministrationLink();
    const link = {
      ...baseLink,
      isPrimary: false,
      appLoginLinked: false,
      status: GuardianRelationshipStatus.REVOKED,
      effectiveUntil: new Date('2026-06-01T00:00:00.000Z'),
      restrictionReasonRef: 'court-order-24',
      guardian: {
        ...baseLink.guardian,
        userId: null,
        user: null,
      },
    };
    const prisma = buildPrisma({
      studentGuardianFindFirstResult: link,
      studentGuardianFindManyResult: [
        { id: link.id, guardianId: link.guardianId, isPrimary: false },
      ],
    });
    const { service, auditService } = buildService(prisma);

    await expect(
      service.updateStudentGuardian(
        link.studentId,
        link.guardianId,
        { isPrimary: true },
        actor,
      ),
    ).rejects.toThrow(
      'Only a currently active guardian relationship can be primary',
    );

    expect(
      prisma.transaction.studentGuardian.updateMany,
    ).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('rejects a stale guardian relationship claim before audit', async () => {
    const baseLink = buildGuardianAdministrationLink();
    const link = {
      ...baseLink,
      isPrimary: false,
      appLoginLinked: false,
      guardian: {
        ...baseLink.guardian,
        userId: null,
        user: null,
      },
    };
    const prisma = buildPrisma({
      studentGuardianFindFirstResult: link,
      studentGuardianFindManyResult: [
        { id: link.id, guardianId: link.guardianId, isPrimary: false },
      ],
      transactionStudentGuardianUpdateManyCount: 0,
    });
    const { service, auditService } = buildService(prisma);

    await expect(
      service.updateStudentGuardian(
        link.studentId,
        link.guardianId,
        { relation: 'LOCAL_GUARDIAN' },
        actor,
      ),
    ).rejects.toThrow(
      'Guardian relationship changed while this update was being finalized',
    );

    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('rolls back a guardian relationship update when audit append fails', async () => {
    const baseLink = buildGuardianAdministrationLink();
    const link = {
      ...baseLink,
      isPrimary: false,
      appLoginLinked: false,
      guardian: {
        ...baseLink.guardian,
        userId: null,
        user: null,
      },
    };
    const prisma = buildPrisma({
      studentGuardianFindFirstResult: link,
      studentGuardianFindManyResult: [
        { id: link.id, guardianId: link.guardianId, isPrimary: false },
      ],
    });
    const { service, auditService } = buildService(prisma);
    auditService.record.mockRejectedValueOnce(
      new Error('guardian audit unavailable'),
    );

    await expect(
      service.updateStudentGuardian(
        link.studentId,
        link.guardianId,
        { relation: 'LOCAL_GUARDIAN' },
        actor,
      ),
    ).rejects.toThrow('guardian audit unavailable');

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ resourceId: link.id }),
      prisma.transaction,
    );
  });

  it('maps serializable guardian update conflicts to a bounded retry response', async () => {
    const prisma = buildPrisma({});
    prisma.$transaction.mockRejectedValueOnce({ code: 'P2034' });
    const { service } = buildService(prisma);

    await expect(
      service.updateStudentGuardian(
        'student-1',
        'guardian-1',
        { relation: 'LOCAL_GUARDIAN' },
        actor,
      ),
    ).rejects.toThrow(
      'Guardian relationship changed while this update was being finalized',
    );
  });

  it('rejects guardian updates that are not linked to the tenant-scoped student', async () => {
    const prisma = buildPrisma({
      studentGuardianFindFirstResult: null,
    });
    const { service } = buildService(prisma);

    await expect(
      service.updateStudentGuardian(
        'student-1',
        'guardian-other-tenant',
        { primaryPhone: '9811111111' },
        actor,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('updates per-child guardian capabilities, approval, and effective dates with audit evidence', async () => {
    const link = {
      id: 'student-guardian-1',
      tenantId: actor.tenantId,
      studentId: 'student-1',
      guardianId: 'guardian-1',
      relation: 'OVERSEAS_PARENT',
      isPrimary: false,
      capabilities: [GuardianCapability.ACADEMICS_VIEW],
      verificationStatus: GuardianRelationshipVerificationStatus.UNVERIFIED,
      status: GuardianRelationshipStatus.ACTIVE,
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      effectiveUntil: null,
      emergencyContactPriority: null,
      approvalStatus: GuardianRelationshipApprovalStatus.PENDING,
      restrictionReasonRef: null,
      guardian: {
        id: 'guardian-1',
        fullName: 'Maya Shrestha',
        relation: 'OVERSEAS_PARENT',
        primaryPhone: '+9779800000000',
        secondaryPhone: null,
        email: 'maya@example.com',
        occupation: null,
        homeAddress: null,
        wardNumber: null,
      },
    };
    const prisma = buildPrisma({
      studentGuardianFindFirstResult: link,
      studentGuardianFindManyResult: [
        { id: link.id, guardianId: link.guardianId, isPrimary: false },
      ],
    });
    const { service, auditService } = buildService(prisma);
    jest.spyOn(service, 'getStudentProfile').mockResolvedValue({} as never);

    await service.updateStudentGuardian(
      'student-1',
      'guardian-1',
      {
        capabilities: [
          GuardianCapability.ATTENDANCE_VIEW,
          GuardianCapability.EMERGENCY_ALERT_RECEIVE,
        ],
        verificationStatus: GuardianRelationshipVerificationStatus.VERIFIED,
        approvalStatus: GuardianRelationshipApprovalStatus.APPROVED,
        effectiveFrom: '2026-07-01T00:00:00.000Z',
        effectiveUntil: '2026-12-31T00:00:00.000Z',
        emergencyContactPriority: 2,
        restrictionReasonRef: 'family-court-order-24',
      },
      actor,
    );

    expect(prisma.transaction.studentGuardian.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: link.id,
        tenantId: actor.tenantId,
        studentId: 'student-1',
        guardianId: 'guardian-1',
      }),
      data: expect.objectContaining({
        capabilities: [
          GuardianCapability.ATTENDANCE_VIEW,
          GuardianCapability.EMERGENCY_ALERT_RECEIVE,
        ],
        verificationStatus: GuardianRelationshipVerificationStatus.VERIFIED,
        approvalStatus: GuardianRelationshipApprovalStatus.APPROVED,
        approvedById: actor.userId,
        approvedAt: expect.any(Date),
        effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
        effectiveUntil: new Date('2026-12-31T00:00:00.000Z'),
        emergencyContactPriority: 2,
        restrictionReasonRef: 'family-court-order-24',
      }),
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        resource: 'student_guardian',
        before: expect.objectContaining({
          capabilities: [GuardianCapability.ACADEMICS_VIEW],
          approvalStatus: GuardianRelationshipApprovalStatus.PENDING,
        }),
        after: expect.objectContaining({
          capabilities: [
            GuardianCapability.ATTENDANCE_VIEW,
            GuardianCapability.EMERGENCY_ALERT_RECEIVE,
          ],
          approvalStatus: GuardianRelationshipApprovalStatus.APPROVED,
          restrictionReasonRef: 'family-court-order-24',
        }),
      }),
      prisma.transaction,
    );
  });

  it('requires a restriction reference when suspending or revoking guardian authority', async () => {
    const prisma = buildPrisma({
      studentGuardianFindFirstResult: {
        id: 'link-1',
        tenantId: actor.tenantId,
        studentId: 'student-1',
        guardianId: 'guardian-1',
        relation: 'FATHER',
        isPrimary: false,
        capabilities: [GuardianCapability.ACADEMICS_VIEW],
        verificationStatus: GuardianRelationshipVerificationStatus.VERIFIED,
        status: GuardianRelationshipStatus.ACTIVE,
        effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        effectiveUntil: null,
        emergencyContactPriority: null,
        approvalStatus: GuardianRelationshipApprovalStatus.APPROVED,
        restrictionReasonRef: null,
        guardian: {
          id: 'guardian-1',
          fullName: 'Ram Rai',
          relation: 'FATHER',
          primaryPhone: '+9779800000000',
        },
      },
    });
    const { service } = buildService(prisma);

    await expect(
      service.updateStudentGuardian(
        'student-1',
        'guardian-1',
        { status: GuardianRelationshipStatus.SUSPENDED },
        actor,
      ),
    ).rejects.toThrow(
      'A restriction reason reference is required for a suspended, revoked, or rejected guardian relationship.',
    );
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(
      prisma.transaction.studentGuardian.updateMany,
    ).not.toHaveBeenCalled();
  });

  it('supports more than two realistic guardian relationships without implicit access', async () => {
    const prisma = buildPrisma({
      studentFindFirstQueue: [{ id: 'student-1' }],
      studentGuardianFindManyResult: [
        { id: 'link-1', guardianId: 'guardian-1', isPrimary: true },
        { id: 'link-2', guardianId: 'guardian-2', isPrimary: false },
      ],
    });
    const { service, auditService } = buildService(prisma);
    jest.spyOn(service, 'getStudentProfile').mockResolvedValue({} as never);

    await service.addStudentGuardian(
      'student-1',
      {
        guardianId: 'guardian-3',
        relation: 'LOCAL_GUARDIAN',
        capabilities: [GuardianCapability.ATTENDANCE_VIEW],
        verificationStatus: GuardianRelationshipVerificationStatus.VERIFIED,
        approvalStatus: GuardianRelationshipApprovalStatus.APPROVED,
        effectiveFrom: '2026-07-28T00:00:00.000Z',
        effectiveUntil: '2026-10-28T00:00:00.000Z',
        emergencyContactPriority: 2,
      },
      actor,
    );

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(prisma.student.findFirst).not.toHaveBeenCalled();
    expect(prisma.studentGuardian.findMany).not.toHaveBeenCalled();
    expect(prisma.transaction.student.findFirst).toHaveBeenCalledWith({
      where: { id: 'student-1', tenantId: actor.tenantId },
      select: { id: true },
    });
    expect(prisma.transaction.studentGuardian.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: actor.tenantId,
        studentId: 'student-1',
        guardianId: 'guardian-3',
        relation: 'LOCAL_GUARDIAN',
        isPrimary: false,
        capabilities: [GuardianCapability.ATTENDANCE_VIEW],
        verificationStatus: GuardianRelationshipVerificationStatus.VERIFIED,
        approvalStatus: GuardianRelationshipApprovalStatus.APPROVED,
        approvedById: actor.userId,
      }),
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'create',
        resource: 'student_guardian',
        tenantId: actor.tenantId,
        resourceId: 'student-guardian-created',
      }),
      prisma.transaction,
    );
  });

  it('rejects an inactive first guardian instead of making it primary', async () => {
    const prisma = buildPrisma({
      studentFindFirstQueue: [{ id: 'student-1' }],
      studentGuardianFindManyResult: [],
    });
    const { service, auditService } = buildService(prisma);

    await expect(
      service.addStudentGuardian(
        'student-1',
        {
          guardianId: 'guardian-3',
          relation: 'LOCAL_GUARDIAN',
          status: GuardianRelationshipStatus.REVOKED,
          restrictionReasonRef: 'court-order-24',
        },
        actor,
      ),
    ).rejects.toThrow(
      'Only a currently active guardian relationship can be primary',
    );

    expect(prisma.transaction.guardian.findFirst).not.toHaveBeenCalled();
    expect(prisma.transaction.studentGuardian.create).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('rolls back guardian creation when the audit append fails', async () => {
    const prisma = buildPrisma({
      studentFindFirstQueue: [{ id: 'student-1' }],
      studentGuardianFindManyResult: [
        { id: 'link-1', guardianId: 'guardian-1', isPrimary: true },
      ],
    });
    const { service, auditService } = buildService(prisma);
    auditService.record.mockRejectedValueOnce(
      new Error('guardian audit unavailable'),
    );

    await expect(
      service.addStudentGuardian(
        'student-1',
        {
          guardianId: 'guardian-3',
          relation: 'LOCAL_GUARDIAN',
        },
        actor,
      ),
    ).rejects.toThrow('guardian audit unavailable');

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ resourceId: 'student-guardian-created' }),
      prisma.transaction,
    );
  });

  it.each([
    ['P2002', 'This guardian is already linked to the student.'],
    [
      'P2034',
      'Guardian relationships changed while this link was being finalized.',
    ],
  ])(
    'maps guardian creation database conflict %s to a bounded response',
    async (code, message) => {
      const prisma = buildPrisma({});
      prisma.$transaction.mockRejectedValueOnce({ code });
      const { service } = buildService(prisma);

      await expect(
        service.addStudentGuardian(
          'student-1',
          {
            guardianId: 'guardian-3',
            relation: 'LOCAL_GUARDIAN',
          },
          actor,
        ),
      ).rejects.toThrow(message);
    },
  );

  it('returns a tenant-scoped guardian administration view without raw session secrets', async () => {
    const link = buildGuardianAdministrationLink();
    const prisma = buildPrisma({
      studentGuardianFindFirstResult: link,
      studentGuardianFindManyResult: [
        {
          guardianId: 'guardian-2',
          relation: 'LOCAL_GUARDIAN',
          guardian: { fullName: 'Sita Rai' },
        },
      ],
      refreshTokenFindManyResult: [
        {
          id: 'session-1',
          deviceId: 'private-device-id',
          expiresAt: new Date('2099-01-01T00:00:00.000Z'),
          revokedAt: null,
          createdAt: new Date('2026-07-01T00:00:00.000Z'),
          revokedReason: null,
          userAgent: 'SchoolOS Android private-agent-detail',
          lastUsedAt: new Date('2026-07-28T02:00:00.000Z'),
          ipAddress: '192.0.2.1',
          tokenHash: 'private-token-hash',
        },
      ],
      guardianIdentityVerificationFindManyResult: [
        {
          id: 'verification-1',
          status: 'VERIFIED',
          documentType: 'citizenship',
          documentNumber: 'private-document-number',
          evidenceDocumentId: 'document-1',
          notes: 'Identity reviewed at the school office',
          reviewNote: 'Approved by authorized staff',
          createdAt: new Date('2026-07-20T00:00:00.000Z'),
          reviewedAt: new Date('2026-07-21T00:00:00.000Z'),
        },
      ],
      auditLogFindManyResult: [
        {
          id: 'audit-1',
          action: 'approve_phone_change',
          after: {
            reason: 'Lost phone reported',
            evidenceReference: 'front-office-register-12',
            verificationMethod: 'SCHOOL_IDENTITY_REVIEW',
          },
          createdAt: new Date('2026-07-28T03:00:00.000Z'),
          user: { email: 'admin@schoolos.test' },
        },
      ],
    });
    const { service } = buildService(prisma);

    const result = await service.getGuardianAccessAdministration(
      link.studentId,
      link.guardianId,
      actor,
    );

    expect(prisma.studentGuardian.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        studentId: link.studentId,
        guardianId: link.guardianId,
      },
      include: {
        guardian: {
          include: {
            user: true,
          },
        },
      },
    });
    expect(result.recoveryPaths).toEqual({
      trustedSessionAvailable: true,
      verifiedEmailAvailable: false,
      schoolIdentityReviewAvailable: true,
      approvedCoGuardians: [
        {
          id: 'guardian-2',
          fullName: 'Sita Rai',
          relation: 'LOCAL_GUARDIAN',
        },
      ],
    });
    expect(result.sessions[0]).toEqual(
      expect.objectContaining({
        id: 'session-1',
        deviceLabel: 'Android device',
        status: 'ACTIVE',
      }),
    );
    expect(result.sessions[0]).not.toHaveProperty('deviceId');
    expect(result.sessions[0]).not.toHaveProperty('userAgent');
    expect(result.sessions[0]).not.toHaveProperty('ipAddress');
    expect(result.sessions[0]).not.toHaveProperty('tokenHash');
    expect(result.identityVerifications[0]).toEqual(
      expect.objectContaining({
        documentNumberRecorded: true,
        evidenceDocumentRecorded: true,
      }),
    );
    expect(result.identityVerifications[0]).not.toHaveProperty(
      'documentNumber',
    );
    expect(result.history[0]).toEqual(
      expect.objectContaining({
        reason: 'Lost phone reported',
        evidenceReference: 'front-office-register-12',
        verificationMethod: 'SCHOOL_IDENTITY_REVIEW',
      }),
    );
  });

  it('does not treat an email address as completed recovery proof', async () => {
    const link = buildGuardianAdministrationLink();
    const prisma = buildPrisma({
      studentGuardianFindFirstResult: link,
      otpCodeFindFirstResult: null,
    });
    const { service } = buildService(prisma);

    await expect(
      service.performGuardianRecoveryAction(
        link.studentId,
        link.guardianId,
        {
          action: 'REVOKE_ALL_SESSIONS',
          verificationMethod: 'VERIFIED_EMAIL',
          reason: 'Lost phone reported by the guardian',
          evidenceReference: 'support-case-101',
        },
        actor,
      ),
    ).rejects.toThrow(
      'No completed email verification or password-recovery proof is recorded.',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('approves a high-risk phone change, revokes old sessions, and audits the evidence transactionally', async () => {
    const link = buildGuardianAdministrationLink();
    const prisma = buildPrisma({
      studentGuardianFindFirstResult: link,
      otpCodeFindFirstResult: { id: 'otp-proof-1' },
      transactionRefreshTokenUpdateManyCount: 2,
    });
    const { service, auditService } = buildService(prisma);

    const result = await service.performGuardianRecoveryAction(
      link.studentId,
      link.guardianId,
      {
        action: 'APPROVE_PHONE_CHANGE',
        verificationMethod: 'VERIFIED_EMAIL',
        reason: 'Guardian changed SIM and completed email recovery',
        evidenceReference: 'support-case-102',
        newPrimaryPhone: '9811111111',
      },
      actor,
    );

    expect(prisma.transaction.guardian.update).toHaveBeenCalledWith({
      where: { id: link.guardianId },
      data: { primaryPhone: '+9779811111111' },
    });
    expect(prisma.transaction.user.update).toHaveBeenCalledWith({
      where: { id: link.guardian.user.id },
      data: { phone: '+9779811111111' },
    });
    expect(prisma.transaction.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: link.guardian.user.id, revokedAt: null },
      data: {
        revokedAt: expect.any(Date),
        revokedReason: 'guardian_phone_change_approved',
      },
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'approve_phone_change',
        resource: 'guardian_access',
        after: expect.objectContaining({
          reason: 'Guardian changed SIM and completed email recovery',
          evidenceReference: 'support-case-102',
          phoneChanged: true,
          sessionsRevoked: 2,
        }),
      }),
      prisma.transaction,
    );
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        action: 'APPROVE_PHONE_CHANGE',
        sessionsRevoked: 2,
      }),
    );
  });

  it('places every active relationship and session on hold after account-compromise proof', async () => {
    const link = buildGuardianAdministrationLink();
    const prisma = buildPrisma({
      studentGuardianFindFirstResult: link,
      refreshTokenFindFirstResult: { id: 'trusted-session-1' },
      transactionStudentGuardianUpdateManyCount: 3,
      transactionRefreshTokenUpdateManyCount: 4,
    });
    const { service, auditService } = buildService(prisma);

    const result = await service.performGuardianRecoveryAction(
      link.studentId,
      link.guardianId,
      {
        action: 'SUSPEND_COMPROMISED_ACCOUNT',
        verificationMethod: 'TRUSTED_SESSION',
        reason: 'Guardian reported an unrecognized login',
        evidenceReference: 'incident-guardian-7',
      },
      actor,
    );

    expect(prisma.transaction.studentGuardian.updateMany).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        guardianId: link.guardianId,
        status: GuardianRelationshipStatus.ACTIVE,
      },
      data: {
        status: GuardianRelationshipStatus.SUSPENDED,
        isPrimary: false,
        restrictionReasonRef: 'incident-guardian-7',
      },
    });
    expect(prisma.transaction.user.update).toHaveBeenCalledWith({
      where: { id: link.guardian.user.id },
      data: { status: 'SUSPENDED' },
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        after: expect.objectContaining({
          relationshipsChanged: 3,
          sessionsRevoked: 4,
        }),
      }),
      prisma.transaction,
    );
    expect(result).toEqual(
      expect.objectContaining({
        relationshipStatus: GuardianRelationshipStatus.SUSPENDED,
        accountStatus: 'SUSPENDED',
      }),
    );
  });

  it.each([
    {
      action: 'EXPIRE_RELATIONSHIP' as const,
      status: GuardianRelationshipStatus.EXPIRED,
      revokedReason: 'guardian_relationship_expired',
    },
    {
      action: 'REVOKE_RELATIONSHIP' as const,
      status: GuardianRelationshipStatus.REVOKED,
      revokedReason: 'guardian_relationship_revoked',
    },
  ])(
    'finalizes a temporary or removed relationship with immediate session revocation: $action',
    async ({ action, status, revokedReason }) => {
      const link = buildGuardianAdministrationLink();
      const prisma = buildPrisma({
        studentGuardianFindFirstResult: link,
        guardianIdentityVerificationFindFirstQueue: [
          { id: 'identity-proof-1' },
        ],
      });
      const { service } = buildService(prisma);

      const result = await service.performGuardianRecoveryAction(
        link.studentId,
        link.guardianId,
        {
          action,
          verificationMethod: 'SCHOOL_IDENTITY_REVIEW',
          reason: 'Relationship authority ended after school review',
          evidenceReference: 'relationship-case-44',
        },
        actor,
      );

      expect(
        prisma.transaction.studentGuardian.updateMany,
      ).toHaveBeenCalledWith({
        where: {
          id: link.id,
          tenantId: actor.tenantId,
          studentId: link.studentId,
          guardianId: link.guardianId,
        },
        data: expect.objectContaining({
          status,
          isPrimary: false,
        }),
      });
      expect(prisma.transaction.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: link.guardian.user.id, revokedAt: null },
        data: {
          revokedAt: expect.any(Date),
          revokedReason,
        },
      });
      expect(result.relationshipStatus).toBe(status);
    },
  );

  it('ends every relationship and suspends the account for a deceased guardian', async () => {
    const link = buildGuardianAdministrationLink();
    const prisma = buildPrisma({
      studentGuardianFindFirstResult: link,
      guardianIdentityVerificationFindFirstQueue: [{ id: 'identity-proof-1' }],
      transactionStudentGuardianUpdateManyCount: 2,
    });
    const { service } = buildService(prisma);

    await service.performGuardianRecoveryAction(
      link.studentId,
      link.guardianId,
      {
        action: 'MARK_DECEASED',
        verificationMethod: 'SCHOOL_IDENTITY_REVIEW',
        reason: 'School received and reviewed the family notice',
        evidenceReference: 'relationship-case-45',
      },
      actor,
    );

    expect(prisma.transaction.studentGuardian.updateMany).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        guardianId: link.guardianId,
      },
      data: {
        status: GuardianRelationshipStatus.REVOKED,
        isPrimary: false,
        restrictionReasonRef: 'relationship-case-45',
      },
    });
    expect(prisma.transaction.user.update).toHaveBeenCalledWith({
      where: { id: link.guardian.user.id },
      data: { status: 'SUSPENDED' },
    });
  });

  it('restores only the reviewed relationship and invalidates recovery sessions', async () => {
    const baseLink = buildGuardianAdministrationLink();
    const link = {
      ...baseLink,
      status: GuardianRelationshipStatus.SUSPENDED,
      guardian: {
        ...baseLink.guardian,
        user: {
          ...baseLink.guardian.user,
          status: 'SUSPENDED',
        },
      },
    };
    const prisma = buildPrisma({
      studentGuardianFindFirstResult: link,
      guardianIdentityVerificationFindFirstQueue: [{ id: 'identity-proof-1' }],
    });
    const { service } = buildService(prisma);

    const result = await service.performGuardianRecoveryAction(
      link.studentId,
      link.guardianId,
      {
        action: 'RESTORE_ACCOUNT',
        verificationMethod: 'SCHOOL_IDENTITY_REVIEW',
        reason: 'School completed account recovery review',
        evidenceReference: 'recovery-case-46',
      },
      actor,
    );

    expect(prisma.transaction.studentGuardian.updateMany).toHaveBeenCalledWith({
      where: {
        id: link.id,
        tenantId: actor.tenantId,
        studentId: link.studentId,
        guardianId: link.guardianId,
      },
      data: { status: GuardianRelationshipStatus.ACTIVE },
    });
    expect(prisma.transaction.user.update).toHaveBeenCalledWith({
      where: { id: link.guardian.user.id },
      data: { status: 'ACTIVE' },
    });
    expect(prisma.transaction.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: link.guardian.user.id, revokedAt: null },
      data: {
        revokedAt: expect.any(Date),
        revokedReason: 'guardian_account_recovery_complete',
      },
    });
    expect(result).toEqual(
      expect.objectContaining({
        relationshipStatus: GuardianRelationshipStatus.ACTIVE,
        accountStatus: 'ACTIVE',
      }),
    );
  });

  it('does not restore a revoked or expired relationship as account recovery', async () => {
    const baseLink = buildGuardianAdministrationLink();
    const link = {
      ...baseLink,
      status: GuardianRelationshipStatus.REVOKED,
    };
    const prisma = buildPrisma({
      studentGuardianFindFirstResult: link,
      guardianIdentityVerificationFindFirstQueue: [{ id: 'identity-proof-1' }],
    });
    const { service } = buildService(prisma);

    await expect(
      service.performGuardianRecoveryAction(
        link.studentId,
        link.guardianId,
        {
          action: 'RESTORE_ACCOUNT',
          verificationMethod: 'SCHOOL_IDENTITY_REVIEW',
          reason: 'Attempted restore after relationship removal',
          evidenceReference: 'recovery-case-47',
        },
        actor,
      ),
    ).rejects.toThrow(
      'Revoked and expired relationships require a new reviewed relationship.',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('provisions a parent-only guardian account transactionally after school identity review', async () => {
    const baseLink = buildGuardianAdministrationLink();
    const link = {
      ...baseLink,
      appLoginLinked: false,
      guardian: {
        ...baseLink.guardian,
        userId: null,
        user: null,
      },
    };
    const prisma = buildPrisma({
      studentGuardianFindFirstResult: link,
      guardianIdentityVerificationFindFirstQueue: [{ id: 'identity-proof-1' }],
    });
    const { service, usersService, auditService } = buildService(prisma);

    const result = await service.provisionGuardianAccount(
      link.studentId,
      link.guardianId,
      {
        email: 'maya@example.com',
        temporaryPassword: 'Temporary!Parent2026',
        verificationMethod: 'SCHOOL_IDENTITY_REVIEW',
        reason: 'Guardian app access approved after in-person review',
        evidenceReference: 'front-office-register-15',
      },
      actor,
    );

    expect(usersService.createManagedUser).toHaveBeenCalledWith(
      {
        tenantId: actor.tenantId,
        email: 'maya@example.com',
        phone: link.guardian.primaryPhone,
        password: 'Temporary!Parent2026',
        roleIds: ['parent-role-1'],
        assignedById: actor.userId,
        mustChangePassword: true,
      },
      prisma.transaction,
    );
    expect(prisma.transaction.guardian.updateMany).toHaveBeenCalledWith({
      where: {
        id: link.guardianId,
        tenantId: actor.tenantId,
        userId: null,
      },
      data: { userId: 'guardian-user-provisioned' },
    });
    expect(prisma.transaction.studentGuardian.updateMany).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        guardianId: link.guardianId,
      },
      data: { appLoginLinked: true },
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'provision_account',
        resource: 'guardian_access',
        after: expect.objectContaining({
          reason: 'Guardian app access approved after in-person review',
          evidenceReference: 'front-office-register-15',
          mustChangePassword: true,
        }),
      }),
      prisma.transaction,
    );
    expect(JSON.stringify(auditService.record.mock.calls)).not.toContain(
      'Temporary!Parent2026',
    );
    expect(result).toEqual({
      success: true,
      account: {
        linked: true,
        status: 'ACTIVE',
        email: 'maya@example.com',
        mustChangePassword: true,
      },
    });
  });

  it('revokes only the selected active guardian session and records the decision evidence', async () => {
    const link = buildGuardianAdministrationLink();
    const prisma = buildPrisma({
      studentGuardianFindFirstResult: link,
    });
    const { service, auditService } = buildService(prisma);

    await expect(
      service.revokeGuardianSession(
        link.studentId,
        link.guardianId,
        'session-2',
        {
          reason: 'Guardian no longer recognizes this device',
          evidenceReference: 'support-case-103',
        },
        actor,
      ),
    ).resolves.toEqual({ success: true, sessionId: 'session-2' });

    expect(prisma.transaction.refreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'session-2',
        userId: link.guardian.user.id,
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      data: {
        revokedAt: expect.any(Date),
        revokedReason: 'guardian_admin_device_revocation',
      },
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'revoke_session',
        resource: 'guardian_access',
        after: expect.objectContaining({
          reason: 'Guardian no longer recognizes this device',
          evidenceReference: 'support-case-103',
        }),
      }),
      prisma.transaction,
    );
  });

  it('requires guardian-verification authority before changing relationship access', async () => {
    const baseLink = buildGuardianAdministrationLink();
    const link = {
      ...baseLink,
      guardian: {
        ...baseLink.guardian,
        userId: null,
        user: null,
      },
    };
    const prisma = buildPrisma({
      studentGuardianFindFirstResult: link,
    });
    const { service } = buildService(prisma);

    await expect(
      service.updateStudentGuardian(
        link.studentId,
        link.guardianId,
        {
          capabilities: [GuardianCapability.ATTENDANCE_VIEW],
        },
        {
          ...actor,
          permissions: actor.permissions.filter(
            (permission) => permission !== 'guardians:verify',
          ),
        },
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('routes app-linked phone changes through the audited recovery workflow', async () => {
    const link = buildGuardianAdministrationLink();
    const prisma = buildPrisma({
      studentGuardianFindFirstResult: link,
    });
    const { service } = buildService(prisma);

    await expect(
      service.updateStudentGuardian(
        link.studentId,
        link.guardianId,
        { primaryPhone: '9811111111' },
        actor,
      ),
    ).rejects.toThrow(
      'Use the guardian access recovery action to approve a phone-number change for an app-linked guardian.',
    );
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.transaction.guardian.updateMany).not.toHaveBeenCalled();
    expect(
      prisma.transaction.studentGuardian.updateMany,
    ).not.toHaveBeenCalled();
  });

  it('does not expose guardian administration across tenant boundaries', async () => {
    const prisma = buildPrisma({
      studentGuardianFindFirstResult: null,
    });
    const { service } = buildService(prisma);

    await expect(
      service.getGuardianAccessAdministration(
        'student-other-tenant',
        'guardian-other-tenant',
        actor,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('persists signed metadata when generating student documents', async () => {
    const student = buildStudent({
      guardianLinks: [
        {
          guardian: {
            fullName: 'Maya Shrestha',
            primaryPhone: '9800000000',
            email: 'maya@example.com',
            wardNumber: '5',
          },
          relation: 'mother',
          isPrimary: true,
          capabilities: [GuardianCapability.ACADEMICS_VIEW],
          verificationStatus: GuardianRelationshipVerificationStatus.VERIFIED,
          status: GuardianRelationshipStatus.ACTIVE,
          effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
          effectiveUntil: null,
          emergencyContactPriority: 1,
          approvalStatus: GuardianRelationshipApprovalStatus.APPROVED,
          restrictionReasonRef: null,
        },
      ],
      enrollments: [
        {
          academicYear: { name: '2083' },
          classId: 'class-1',
          section: { name: 'A' },
          status: EnrollmentStatus.ACTIVE,
        },
      ],
    });
    const latestVersion = { version: 2 };
    const prisma = buildPrisma({
      studentFindFirstQueue: [student],
      generatedStudentDocumentFindFirstQueue: [latestVersion],
    });
    const { service, storageService, fileRegistryService } =
      buildService(prisma);

    const pdf = await service.generateStudentDocumentPdf(
      student.id,
      'enrollment-confirmation',
      actor,
      { idempotencyKey: 'admission:enrollment-1:id-card' },
    );

    expect(pdf).toEqual({
      fileAssetId: 'generated-file-asset',
      fileName: `${student.studentSystemId}-enrollment-confirmation.pdf`,
      mimeType: 'application/pdf',
      fileAvailable: true,
    });
    expect(storageService.saveBufferObject).not.toHaveBeenCalled();
    expect(fileRegistryService.registerGeneratedFile).toHaveBeenCalledWith({
      tenantId: actor.tenantId,
      generatedByUserId: actor.userId,
      originalFilename: `${student.studentSystemId}-enrollment-confirmation.pdf`,
      content: expect.any(Buffer),
      mimeType: 'application/pdf',
      module: 'students',
      entityId: student.id,
      metadata: expect.objectContaining({
        kind: 'enrollment-confirmation',
        source: 'generated_student_document',
        version: 3,
      }),
    });
    expect(
      prisma.transaction.generatedStudentDocument.updateMany,
    ).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        studentId: student.id,
        kind: 'enrollment-confirmation',
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
        revokedById: actor.userId,
      },
    });
    expect(
      prisma.transaction.generatedStudentDocument.create,
    ).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: actor.tenantId,
        studentId: student.id,
        fileId: 'generated-file-asset',
        idempotencyKey: 'admission:enrollment-1:id-card',
        kind: 'enrollment-confirmation',
        generatedById: actor.userId,
        pdfUrl: '/api/v1/files/generated-file-asset/preview',
        storageObjectKey: `tenant-1/students/${student.id}/generated-documents/enrollment-confirmation/generated-doc.pdf`,
        checksumSha256: expect.any(String),
        signedAt: expect.any(Date),
        signatureMetadata: expect.objectContaining({
          issuerUserId: actor.userId,
          tenantSlug: actor.tenantSlug,
          mode: 'internal-issued',
          storageProvider: 'LOCAL',
        }),
        version: 3,
        retentionUntil: expect.any(Date),
      }),
    });
  });

  it('replays a generated student document without regenerating its file', async () => {
    const prisma = buildPrisma({
      generatedStudentDocumentFindUniqueResult: {
        id: 'generated-document-1',
        studentId: 'student-1',
        kind: 'id-card',
        fileId: 'generated-file-asset-existing',
        fileName: 'SCH-2026-0001-id-card.pdf',
      },
    });
    const { service, fileRegistryService } = buildService(prisma);

    const result = await service.generateStudentDocumentPdf(
      'student-1',
      'ID_CARD',
      actor,
      { idempotencyKey: 'admission:enrollment-1:id-card' },
    );

    expect(result).toEqual({
      fileAssetId: 'generated-file-asset-existing',
      fileName: 'SCH-2026-0001-id-card.pdf',
      mimeType: 'application/pdf',
      fileAvailable: true,
    });
    expect(prisma.student.findFirst).not.toHaveBeenCalled();
    expect(fileRegistryService.registerGeneratedFile).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('cleans up a losing generated file and returns the concurrent replay', async () => {
    const student = buildStudent({ guardianLinks: [] });
    const concurrentDocument = {
      id: 'generated-document-concurrent',
      studentId: student.id,
      kind: 'id-card',
      fileId: 'generated-file-asset-existing',
      fileName: `${student.studentSystemId}-id-card.pdf`,
    };
    const prisma = buildPrisma({
      studentFindFirstQueue: [student],
      generatedStudentDocumentFindFirstQueue: [null],
    });
    prisma.generatedStudentDocument.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(concurrentDocument);
    prisma.$transaction.mockRejectedValueOnce({ code: 'P2002' });
    const { service, fileRegistryService } = buildService(prisma);

    const result = await service.generateStudentDocumentPdf(
      student.id,
      'id-card',
      actor,
      { idempotencyKey: 'admission:enrollment-1:id-card' },
    );

    expect(result.fileAssetId).toBe('generated-file-asset-existing');
    expect(fileRegistryService.softDeleteFile).toHaveBeenCalledWith(
      actor.tenantId,
      'generated-file-asset',
      actor.userId,
    );
    expect(prisma.generatedStudentDocument.findUnique).toHaveBeenCalledTimes(2);
  });

  it('generates student ID cards without accepting credential secrets from callers', async () => {
    const student = buildStudent({
      guardianLinks: [
        {
          guardian: {
            fullName: 'Maya Shrestha',
            primaryPhone: '9800000000',
            email: 'maya@example.com',
            wardNumber: '5',
          },
          relation: 'mother',
          isPrimary: true,
        },
      ],
    });
    const prisma = buildPrisma({
      studentFindFirstQueue: [student],
      generatedStudentDocumentFindFirstQueue: [null],
    });
    const { service } = buildService(prisma);

    const pdf = await service.generateStudentDocumentPdf(
      student.id,
      'id-card',
      actor,
    );

    expect(pdf).toEqual({
      fileAssetId: 'generated-file-asset',
      fileName: `${student.studentSystemId}-id-card.pdf`,
      mimeType: 'application/pdf',
      fileAvailable: true,
    });
  });

  it('embeds the configured school logo in generated student certificates', async () => {
    const student = buildStudent({ guardianLinks: [] });
    const prisma = buildPrisma({
      studentFindFirstQueue: [student],
      generatedStudentDocumentFindFirstQueue: [null],
    });
    const { service, fileRegistryService } = buildService(prisma);
    const logoBytes = await createTestJpeg(96, 48);
    configureSchoolLogo(prisma, fileRegistryService, logoBytes);

    await service.generateStudentDocumentPdf(
      student.id,
      'enrollment-confirmation',
      actor,
    );

    const generatedPdf = fileRegistryService.registerGeneratedFile.mock
      .calls[0][0].content as Buffer;
    expect(generatedPdf.toString('latin1')).toContain('/Filter /DCTDecode');
  });

  it('still generates student certificates without an unavailable school logo', async () => {
    const student = buildStudent({ guardianLinks: [] });
    const prisma = buildPrisma({
      studentFindFirstQueue: [student],
      generatedStudentDocumentFindFirstQueue: [null],
    });
    const { service, fileRegistryService } = buildService(prisma);
    prisma.tenantSetting.findUnique.mockResolvedValue({
      value: SCHOOL_LOGO_FILE_ASSET_ID,
    });
    fileRegistryService.getFileMetadata.mockRejectedValue(
      new NotFoundException('School logo is unavailable'),
    );

    await expect(
      service.generateStudentDocumentPdf(
        student.id,
        'enrollment-confirmation',
        actor,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        fileName: `${student.studentSystemId}-enrollment-confirmation.pdf`,
        fileAvailable: true,
      }),
    );
    const generatedPdf = fileRegistryService.registerGeneratedFile.mock
      .calls[0][0].content as Buffer;
    expect(generatedPdf.toString('latin1')).not.toContain('/Filter /DCTDecode');
  });

  it('embeds the configured school logo in roster PDFs and falls back when absent', async () => {
    const student = buildStudent({ guardianLinks: [] });
    const prisma = buildPrisma({ studentFindManyResult: [student] });
    const { service, fileRegistryService } = buildService(prisma);
    const logoBytes = await createTestJpeg(96, 48);
    configureSchoolLogo(prisma, fileRegistryService, logoBytes);

    const branded = await service.exportRoster({}, actor);
    expect(branded.pdf.toString('latin1')).toContain('/Filter /DCTDecode');

    prisma.tenantSetting.findUnique.mockResolvedValue(null);
    const unbranded = await service.exportRoster({}, actor);
    expect(unbranded.pdf.toString('latin1')).not.toContain(
      '/Filter /DCTDecode',
    );
  });

  it('scopes roster PDF class/section header lookups to the actor tenant', async () => {
    const prisma = buildPrisma({ studentFindManyResult: [] });
    const { service } = buildService(prisma);

    await service.exportRoster(
      { classId: 'foreign-class-1', sectionId: 'foreign-section-1' },
      actor,
    );

    // The header lookups must never resolve a foreign tenant's class/section
    // name, which would both leak the name and confirm the record exists.
    expect(prisma.class.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'foreign-class-1', tenantId: 'tenant-1' },
      }),
    );
    expect(prisma.section.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'foreign-section-1', tenantId: 'tenant-1' },
      }),
    );
    expect(prisma.class.findUnique).not.toHaveBeenCalled();
    expect(prisma.section.findUnique).not.toHaveBeenCalled();
  });

  it('embeds the real uploaded student photo in the generated ID card', async () => {
    const student = buildStudent({ guardianLinks: [] });
    const prisma = buildPrisma({
      studentFindFirstQueue: [student],
      generatedStudentDocumentFindFirstQueue: [null],
    });
    const { service, studentPhotoService, fileRegistryService } =
      buildService(prisma);
    const photoBytes = await createTestJpeg(240, 300);
    studentPhotoService.getPhotoContent.mockResolvedValue({
      studentId: student.id,
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      content: photoBytes,
    });

    const pdf = await service.generateStudentDocumentPdf(
      student.id,
      'id-card',
      actor,
    );

    expect(pdf.fileAvailable).toBe(true);
    expect(studentPhotoService.getPhotoContent).toHaveBeenCalledWith(
      student.id,
      actor,
    );
    const generatedPdf = fileRegistryService.registerGeneratedFile.mock
      .calls[0][0].content as Buffer;
    // A real DCTDecode (JPEG) image XObject was embedded, not a fallback box.
    expect(generatedPdf.toString('latin1')).toContain('/Filter /DCTDecode');
  });

  it('falls back to a clean placeholder when the student has no uploaded photo', async () => {
    const student = buildStudent({ guardianLinks: [] });
    const prisma = buildPrisma({
      studentFindFirstQueue: [student],
      generatedStudentDocumentFindFirstQueue: [null],
    });
    const { service, studentPhotoService, fileRegistryService } =
      buildService(prisma);
    studentPhotoService.getPhotoContent.mockRejectedValue(
      new NotFoundException('Student photo not found'),
    );

    const pdf = await service.generateStudentDocumentPdf(
      student.id,
      'id-card',
      actor,
    );

    expect(pdf.fileAvailable).toBe(true);
    const generatedPdf = fileRegistryService.registerGeneratedFile.mock
      .calls[0][0].content as Buffer;
    const pdfText = generatedPdf.toString('latin1');
    expect(pdfText).not.toContain('/Filter /DCTDecode');
    expect(pdfText).toContain('(PHOTO)');
    expect(pdfText).toContain('(not available)');
  });

  it('still generates the ID card when the photo file exists but is archived or unreadable', async () => {
    const student = buildStudent({ guardianLinks: [] });
    const prisma = buildPrisma({
      studentFindFirstQueue: [student],
      generatedStudentDocumentFindFirstQueue: [null],
    });
    const { service, studentPhotoService } = buildService(prisma);
    studentPhotoService.getPhotoContent.mockRejectedValue(
      new NotFoundException('Student photo is not available'),
    );

    await expect(
      service.generateStudentDocumentPdf(student.id, 'id-card', actor),
    ).resolves.toEqual({
      fileAssetId: 'generated-file-asset',
      fileName: `${student.studentSystemId}-id-card.pdf`,
      mimeType: 'application/pdf',
      fileAvailable: true,
    });
  });

  it('does not leak the photo file asset id as text into the generated ID card', async () => {
    const student = buildStudent({ guardianLinks: [] });
    const prisma = buildPrisma({
      studentFindFirstQueue: [student],
      generatedStudentDocumentFindFirstQueue: [null],
    });
    const { service, studentPhotoService, fileRegistryService } =
      buildService(prisma);
    const photoBytes = await createTestJpeg(120, 150);
    const secretAssetId = 'photo-asset-9f2c1e0a-not-a-url';
    studentPhotoService.getPhotoContent.mockResolvedValue({
      studentId: student.id,
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      content: photoBytes,
    });

    await service.generateStudentDocumentPdf(student.id, 'id-card', actor);

    const generatedPdf = fileRegistryService.registerGeneratedFile.mock
      .calls[0][0].content as Buffer;
    expect(generatedPdf.toString('latin1')).not.toContain(secretAssetId);
  });

  it('returns a clean validation error for unsupported student document kinds', async () => {
    const prisma = buildPrisma({});
    const { service } = buildService(prisma);

    await expect(
      service.generateStudentDocumentPdf('student-1', 'unsupported', actor),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns a tenant-scoped student profile detail payload', async () => {
    const student = buildStudent({
      guardianLinks: [
        {
          guardian: {
            id: 'guardian-1',
            fullName: 'Maya Shrestha',
            relation: 'mother',
            primaryPhone: '9800000000',
            email: 'maya@example.com',
            wardNumber: null,
          },
          relation: 'mother',
          isPrimary: true,
          capabilities: [GuardianCapability.ACADEMICS_VIEW],
          verificationStatus: GuardianRelationshipVerificationStatus.VERIFIED,
          status: GuardianRelationshipStatus.ACTIVE,
          effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
          effectiveUntil: null,
          emergencyContactPriority: 1,
          approvalStatus: GuardianRelationshipApprovalStatus.APPROVED,
          restrictionReasonRef: null,
        },
      ],
      documents: [
        {
          id: 'document-1',
          studentId: 'student-1',
          fileId: 'document-file-1',
          kind: 'BIRTH_CERTIFICATE',
          status: 'ACTIVE',
          title: 'Birth certificate',
          fileName: 'birth.pdf',
          contentType: 'application/pdf',
          sizeBytes: 128,
          provider: 'LOCAL',
          objectKey: 'tenant-1/students/student-1/birth.pdf',
          publicUrl: null,
          notes: null,
          expiryDate: null,
          verifiedAt: null,
          verifiedById: null,
          uploadedById: actor.userId,
          createdAt: new Date('2026-04-27T00:00:00.000Z'),
        },
      ],
      generatedDocuments: [
        {
          id: 'generated-1',
          studentId: 'student-1',
          kind: 'id-card',
          title: 'Student ID Card',
          fileName: 'SCH-2026-0001-id-card.pdf',
          contentType: 'application/pdf',
          sizeBytes: 512,
          pdfUrl: '/api/v1/students/student-1/documents/id-card.pdf',
          generatedById: actor.userId,
          generatedAt: new Date('2026-04-27T00:00:00.000Z'),
          checksumSha256: 'checksum',
          storageObjectKey: 'tenant-1/students/student-1/generated.pdf',
          signedAt: new Date('2026-04-27T00:00:00.000Z'),
          version: 1,
          retentionUntil: new Date('2026-10-27T00:00:00.000Z'),
          revokedAt: null,
        },
      ],
      enrollments: [
        {
          id: 'enrollment-1',
          academicYearId: 'year-1',
          classId: 'class-1',
          sectionId: 'section-1',
          rollNumber: 7,
          status: EnrollmentStatus.ACTIVE,
          admissionDate: new Date('2026-04-01T00:00:00.000Z'),
          academicYear: { name: '2083' },
          class: { name: 'Grade 1' },
          section: { name: 'A' },
        },
      ],
      invoices: [
        {
          id: 'invoice-1',
          invoiceNumber: 'INV-2026-00001',
          status: 'ISSUED',
          dueDate: new Date('2026-05-01T00:00:00.000Z'),
          totalAmount: new Prisma.Decimal(1000),
          issuedAt: new Date('2026-04-27T00:00:00.000Z'),
          lines: [
            {
              id: 'line-1',
              feeHeadId: 'fee-head-1',
              feeHead: { name: 'Tuition' },
              description: 'Tuition',
              quantity: 1,
              unitAmount: new Prisma.Decimal(1000),
              vatAmount: new Prisma.Decimal(0),
              totalAmount: new Prisma.Decimal(1000),
            },
          ],
          payments: [],
        },
      ],
      attendanceRecords: [
        {
          id: 'attendance-record-1',
          status: 'PRESENT',
          remark: null,
          lateAt: null,
          attendanceSession: {
            attendanceDate: new Date('2026-04-27T00:00:00.000Z'),
            submittedAt: new Date('2026-04-27T08:00:00.000Z'),
          },
        },
      ],
    });
    const prisma = buildPrisma({
      studentFindFirstQueue: [student],
      activityPostFindManyResult: [
        {
          id: 'activity-1',
          title: 'Class activity',
          caption: 'Reading practice',
          category: 'ACADEMIC',
          audienceType: 'CLASS',
          classId: 'class-1',
          sectionId: 'section-1',
          publishedAt: new Date('2026-04-27T08:00:00.000Z'),
          attachments: [
            {
              id: 'attachment-1',
              fileName: 'reading.jpg',
              contentType: 'image/jpeg',
              sizeBytes: 256,
              sortOrder: 0,
              processingStatus: 'READY',
              fileAssetId: 'activity-file-1',
              thumbnailFileAssetId: 'activity-thumbnail-1',
              optimizedObjectKey: null,
              provider: 'LOCAL',
              objectKey: 'tenant-1/activity/reading.jpg',
              publicUrl: '/private/activity/reading.jpg',
            },
          ],
          studentTags: [],
          reactions: [],
        },
      ],
    });
    const { service, fileRegistryService } = buildService(prisma);

    const profile = await service.getStudentProfile(student.id, actor);

    expect(prisma.student.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: student.id,
          tenantId: actor.tenantId,
        },
      }),
    );
    expect(profile.student.studentSystemId).toBe(student.studentSystemId);
    expect(profile.guardians[0].primaryPhone).toBe('9800000000');
    expect(profile.documents[0].fileName).toBe('birth.pdf');
    expect(profile.documents[0]).not.toHaveProperty('provider');
    expect(profile.documents[0]).not.toHaveProperty('objectKey');
    expect(profile.documents[0]).not.toHaveProperty('publicUrl');
    expect(profile.activityPosts[0].attachments[0]).toEqual(
      expect.objectContaining({
        id: 'attachment-1',
        previewUrl: '/api/v1/activity-feed/attachments/attachment-1/preview',
        thumbnailUrl:
          '/api/v1/activity-feed/attachments/attachment-1/thumbnail',
      }),
    );
    expect(profile.activityPosts[0].attachments[0]).not.toHaveProperty(
      'objectKey',
    );
    expect(profile.activityPosts[0].attachments[0]).not.toHaveProperty(
      'publicUrl',
    );
    expect(profile.activityPosts[0].attachments[0]).not.toHaveProperty(
      'provider',
    );
    expect(fileRegistryService.listFilesByEntity).not.toHaveBeenCalled();
    expect(profile.generatedDocuments[0].kind).toBe('id-card');
    expect(profile.generatedDocuments[0].generatedAt).toBe(
      '2026-04-27T00:00:00.000Z',
    );
    expect(profile.invoices[0].outstandingAmount).toBe(1000);
    expect(profile.attendanceRecords[0].attendanceDate).toBe('2026-04-27');
  });

  it('projects support student records without financial, health, credential, file, attendance, or activity data', async () => {
    const student = {
      ...buildStudent({
        guardianLinks: [
          {
            guardian: {
              id: 'guardian-support',
              fullName: 'Maya Shrestha',
              relation: 'mother',
              primaryPhone: '9800000000',
              email: 'maya@example.com',
              wardNumber: null,
            },
            relation: 'mother',
            isPrimary: true,
            capabilities: [GuardianCapability.ACADEMICS_VIEW],
            verificationStatus: GuardianRelationshipVerificationStatus.VERIFIED,
            status: GuardianRelationshipStatus.ACTIVE,
            effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
            effectiveUntil: null,
            emergencyContactPriority: 1,
            approvalStatus: GuardianRelationshipApprovalStatus.APPROVED,
            restrictionReasonRef: 'SAFEGUARD-PRIVATE-1',
          },
        ],
        documents: [{ id: 'private-document' }],
        generatedDocuments: [{ id: 'generated-private-document' }],
        invoices: [{ id: 'private-invoice' }],
        attendanceRecords: [{ id: 'private-attendance' }],
        identities: [{ identityCode: 'PRIVATE-CREDENTIAL', status: 'ACTIVE' }],
      }),
      medicalConditions: 'Private condition',
      severeAllergies: 'Private allergy',
      medications: 'Private medication',
      specialNeeds: 'Private support note',
      emergencyName: 'Private contact',
      emergencyPhone: '9800000001',
      doctorName: 'Private doctor',
      doctorPhone: '9800000002',
      studentIdentityCode: 'PRIVATE-CREDENTIAL',
      photoFileId: 'private-photo',
      qrCredentials: [
        {
          id: 'private-qr',
          status: 'ACTIVE',
          createdAt: new Date('2026-04-27T00:00:00.000Z'),
          rotatedAt: null,
          lastScannedAt: null,
          fileAssetId: 'private-id-card',
        },
      ],
    };
    const prisma = buildPrisma({
      studentFindFirstQueue: [student],
      activityPostFindManyResult: [{ id: 'private-activity' }],
    });
    const { service, fileRegistryService } = buildService(prisma);

    const profile = await service.getStudentProfile(student.id, {
      ...actor,
      isSupportOverride: true,
      supportOverrideReadOnly: true,
      supportOverrideScopes: ['STUDENT_RECORDS' as const],
    });

    expect(profile.invoices).toEqual([]);
    expect(profile.documents).toEqual([]);
    expect(profile.generatedDocuments).toEqual([]);
    expect(profile.attendanceRecords).toEqual([]);
    expect(profile.activityPosts).toEqual([]);
    expect(profile.student).toEqual(
      expect.objectContaining({
        medicalConditions: null,
        severeAllergies: null,
        medications: null,
        specialNeeds: null,
        studentIdentityCode: null,
        activeIdentity: null,
        photoVersion: null,
        qrCredential: null,
      }),
    );
    expect(profile.guardians[0].restrictionReasonRef).toBeNull();
    const supportSelect = prisma.student.findFirst.mock.calls[0][0].select;
    const serializedSelect = JSON.stringify(supportSelect);
    expect(serializedSelect).not.toContain('documents');
    expect(serializedSelect).not.toContain('generatedDocuments');
    expect(serializedSelect).not.toContain('invoices');
    expect(serializedSelect).not.toContain('attendanceRecords');
    expect(serializedSelect).not.toContain('medicalConditions');
    expect(serializedSelect).not.toContain('severeAllergies');
    expect(serializedSelect).not.toContain('studentIdentityCode');
    expect(serializedSelect).not.toContain('identities');
    expect(serializedSelect).not.toContain('qrCredentials');
    expect(serializedSelect).not.toContain('photoFileId');
    expect(serializedSelect).not.toContain('restrictionReasonRef');
    expect(prisma.activityPost.findMany).not.toHaveBeenCalled();
    expect(fileRegistryService.listFilesByEntity).not.toHaveBeenCalled();
  });

  it('denies sensitive student read helpers during support override', async () => {
    const prisma = buildPrisma({});
    const { service } = buildService(prisma);
    const supportActor = {
      ...actor,
      isSupportOverride: true,
      supportOverrideReadOnly: true,
      supportOverrideScopes: ['STUDENT_RECORDS' as const],
    };

    await expect(
      service.getFeeClearance('student-1', supportActor),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.getStudentIdentity('student-1', supportActor),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.getGuardianAccessAdministration(
        'student-1',
        'guardian-1',
        supportActor,
      ),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.listGuardianIdentityVerifications('guardian-1', supportActor),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.student.findFirst).not.toHaveBeenCalled();
  });

  it('blocks revoking generated documents before retention expiry', async () => {
    const student = buildStudent();
    const prisma = buildPrisma({
      studentFindFirstQueue: [student],
      generatedStudentDocumentFindFirstQueue: [
        {
          id: 'doc-1',
          tenantId: actor.tenantId,
          studentId: student.id,
          kind: 'transfer-certificate',
          fileName: 'doc.pdf',
          revokedAt: null,
          retentionUntil: new Date('2099-01-01T00:00:00.000Z'),
          metadata: {},
        },
      ],
    });
    const { service } = buildService(prisma);

    await expect(
      service.revokeGeneratedStudentDocument(
        student.id,
        'doc-1',
        { reason: 'Superseded' },
        actor,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('marks expired revoked generated documents as purge-eligible without deleting them', async () => {
    const expiredDocument = {
      id: 'doc-expired',
      tenantId: actor.tenantId,
      studentId: 'student-1',
      kind: 'id-card',
      metadata: { previous: true },
      revokedAt: new Date('2026-01-01T00:00:00.000Z'),
      retentionUntil: new Date('2026-02-01T00:00:00.000Z'),
    };
    const alreadyMarkedDocument = {
      ...expiredDocument,
      id: 'doc-marked',
      metadata: { retentionStatus: 'eligible_for_purge' },
    };
    const prisma = buildPrisma({
      generatedStudentDocumentFindManyResult: [
        expiredDocument,
        alreadyMarkedDocument,
      ],
    });
    const { service, auditService } = buildService(prisma);

    const result = await service.processGeneratedDocumentRetention(
      new Date('2026-03-01T00:00:00.000Z'),
    );

    expect(result).toEqual({
      reviewedAt: '2026-03-01T00:00:00.000Z',
      eligibleDocuments: 2,
      markedDocuments: 1,
    });
    expect(prisma.generatedStudentDocument.update).toHaveBeenCalledWith({
      where: { id: expiredDocument.id },
      data: {
        metadata: {
          previous: true,
          retentionStatus: 'eligible_for_purge',
          retentionReviewedAt: '2026-03-01T00:00:00.000Z',
        },
      },
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'retention_mark_eligible',
        resource: 'generated_student_document',
        userId: null,
        resourceId: expiredDocument.id,
      }),
    );
  });

  it('queues guardian reminders for active student documents expiring within the reminder window', async () => {
    const expiringDocument = {
      id: 'student-doc-1',
      tenantId: actor.tenantId,
      studentId: 'student-1',
      kind: 'BIRTH_CERTIFICATE',
      status: 'ACTIVE',
      title: 'Birth Certificate',
      fileName: 'birth.pdf',
      contentType: 'application/pdf',
      sizeBytes: 512,
      objectKey: 'tenant-1/students/student-1/birth.pdf',
      expiryDate: new Date('2026-03-20T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      student: {
        id: 'student-1',
        tenantId: actor.tenantId,
        studentSystemId: 'SCH-2026-0001',
        firstNameEn: 'Asha',
        lastNameEn: 'Shrestha',
        guardianLinks: [
          {
            isPrimary: true,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            guardian: {
              email: 'guardian@example.com',
              primaryPhone: '9800000000',
              receivesAlerts: true,
            },
          },
        ],
      },
    };
    const prisma = buildPrisma({
      studentDocumentFindManyResult: [expiringDocument],
    });
    const { service, notificationsService, auditService } =
      buildService(prisma);

    const result = await service.processStudentDocumentExpiryReminders(
      new Date('2026-03-01T10:30:00.000Z'),
    );

    expect(result).toEqual({
      reviewedAt: '2026-03-01T10:30:00.000Z',
      reminderWindowEnd: '2026-03-31T00:00:00.000Z',
      candidateDocuments: 1,
      remindedDocuments: 1,
      skippedDocuments: 0,
    });
    expect(prisma.studentDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['ACTIVE', 'VERIFIED'] },
          expiryDate: { lte: new Date('2026-03-31T00:00:00.000Z') },
        }),
        take: 500,
      }),
    );
    expect(notificationsService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'guardian@example.com',
        subject: 'Asha Shrestha: document expires soon',
        text: expect.stringContaining('expires in 19 days'),
        metadata: expect.objectContaining({
          tenantId: actor.tenantId,
          studentId: 'student-1',
          documentId: 'student-doc-1',
          reminderType: 'student_document_expiry',
        }),
      }),
    );
    expect(notificationsService.sendSms).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '9800000000',
        message: expect.stringContaining('Birth Certificate for Asha Shrestha'),
      }),
    );
    expect(prisma.studentDocumentHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: actor.tenantId,
        documentId: 'student-doc-1',
        action: 'EXPIRY_REMINDER_SENT',
        performedBy: 'system',
        metadata: expect.objectContaining({
          daysUntilExpiry: 19,
          reminderStatus: 'expiring',
          recipientCount: 1,
        }),
      }),
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'expiry_reminder_sent',
        resource: 'student_document',
        tenantId: actor.tenantId,
        userId: null,
        resourceId: 'student-doc-1',
      }),
    );
  });

  it('uses tenant document expiry templates for reminder copy', async () => {
    const expiringDocument = {
      id: 'student-doc-1',
      tenantId: actor.tenantId,
      studentId: 'student-1',
      kind: 'BIRTH_CERTIFICATE',
      status: 'ACTIVE',
      title: 'Birth Certificate',
      fileName: 'birth.pdf',
      contentType: 'application/pdf',
      sizeBytes: 512,
      objectKey: 'tenant-1/students/student-1/birth.pdf',
      expiryDate: new Date('2026-03-20T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      tenant: { slug: 'school-one' },
      student: {
        id: 'student-1',
        tenantId: actor.tenantId,
        studentSystemId: 'SCH-2026-0001',
        firstNameEn: 'Asha',
        lastNameEn: 'Shrestha',
        guardianLinks: [
          {
            isPrimary: true,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            guardian: {
              email: 'guardian@example.com',
              primaryPhone: '9800000000',
              receivesAlerts: true,
            },
          },
        ],
      },
    };
    const prisma = buildPrisma({
      studentDocumentFindManyResult: [expiringDocument],
      studentDocumentExpiryTemplateFindManyResult: [
        {
          id: 'email-template-1',
          tenantId: actor.tenantId,
          channel: 'email',
          reminderStatus: 'expiring',
          subjectTemplate: '{{studentName}} needs {{documentTitle}}',
          messageTemplate:
            '{{tenantSlug}}: {{documentTitle}} expires on {{expiryLabel}}',
        },
        {
          id: 'sms-template-1',
          tenantId: actor.tenantId,
          channel: 'sms',
          reminderStatus: 'expiring',
          subjectTemplate: null,
          messageTemplate:
            '{{studentName}} {{documentTitle}} expires in {{daysUntilExpiry}} days',
        },
      ],
    });
    const { service, notificationsService } = buildService(prisma);

    await service.processStudentDocumentExpiryReminders(
      new Date('2026-03-01T10:30:00.000Z'),
    );

    expect(notificationsService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Asha Shrestha needs Birth Certificate',
        text: 'school-one: Birth Certificate expires on 2026-03-20',
      }),
    );
    expect(notificationsService.sendSms).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Asha Shrestha Birth Certificate expires in 19 days',
      }),
    );
    expect(prisma.studentDocumentHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: expect.objectContaining({
          templateIds: {
            email: 'email-template-1',
            sms: 'sms-template-1',
          },
        }),
      }),
    });
  });

  it('upserts document expiry templates with audit', async () => {
    const prisma = buildPrisma({});
    const { service, auditService } = buildService(prisma);

    const result = await service.upsertDocumentExpiryTemplate(
      {
        channel: 'email',
        reminderStatus: 'expiring',
        subjectTemplate: '{{studentName}} document expires soon',
        messageTemplate: '{{documentTitle}} expires on {{expiryLabel}}',
        daysBeforeExpiry: 14,
        isActive: true,
      },
      actor,
    );

    expect(prisma.studentDocumentExpiryTemplate.upsert).toHaveBeenCalledWith({
      where: {
        tenantId_channel_reminderStatus: {
          tenantId: actor.tenantId,
          channel: 'email',
          reminderStatus: 'expiring',
        },
      },
      update: expect.objectContaining({
        messageTemplate: '{{documentTitle}} expires on {{expiryLabel}}',
        daysBeforeExpiry: 14,
        updatedById: actor.userId,
      }),
      create: expect.objectContaining({
        tenantId: actor.tenantId,
        channel: 'email',
        reminderStatus: 'expiring',
      }),
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'document_expiry_template_upsert',
        resource: 'student_document_expiry_template',
        tenantId: actor.tenantId,
        resourceId: 'template-1',
      }),
    );
    expect(result.id).toBe('template-1');
  });

  it('does not send duplicate student document expiry reminders on the same day', async () => {
    const document = {
      id: 'student-doc-1',
      tenantId: actor.tenantId,
      studentId: 'student-1',
      kind: 'ID_CARD',
      status: 'VERIFIED',
      title: 'Guardian ID',
      fileName: 'guardian-id.pdf',
      contentType: 'application/pdf',
      sizeBytes: 512,
      objectKey: 'tenant-1/students/student-1/guardian-id.pdf',
      expiryDate: new Date('2026-03-02T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      student: {
        id: 'student-1',
        tenantId: actor.tenantId,
        studentSystemId: 'SCH-2026-0001',
        firstNameEn: 'Asha',
        lastNameEn: 'Shrestha',
        guardianLinks: [
          {
            isPrimary: true,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            guardian: {
              email: 'guardian@example.com',
              primaryPhone: '9800000000',
              receivesAlerts: true,
            },
          },
        ],
      },
    };
    const prisma = buildPrisma({
      studentDocumentFindManyResult: [document],
      studentDocumentHistoryFindManyResult: [{ documentId: 'student-doc-1' }],
    });
    const { service, notificationsService, auditService } =
      buildService(prisma);

    const result = await service.processStudentDocumentExpiryReminders(
      new Date('2026-03-01T10:30:00.000Z'),
    );

    expect(result.remindedDocuments).toBe(0);
    expect(result.skippedDocuments).toBe(1);
    expect(notificationsService.sendEmail).not.toHaveBeenCalled();
    expect(notificationsService.sendSms).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'expiry_reminder_sent',
      }),
    );
  });

  it('creates and approves guardian identity verification records with audit history', async () => {
    const guardian = {
      id: 'guardian-1',
      tenantId: actor.tenantId,
      fullName: 'Maya Shrestha',
    };
    const evidenceDocument = {
      id: 'document-1',
      tenantId: actor.tenantId,
    };
    const createdVerification = {
      id: 'verification-1',
      tenantId: actor.tenantId,
      guardianId: guardian.id,
      status: 'PENDING',
      documentType: 'citizenship',
      documentNumber: '12-34-56',
      evidenceDocumentId: evidenceDocument.id,
      createdAt: new Date('2026-04-27T00:00:00.000Z'),
      reviewedAt: null,
    };
    const reviewedVerification = {
      ...createdVerification,
      status: 'VERIFIED',
      reviewedById: actor.userId,
      reviewedAt: new Date('2026-04-28T00:00:00.000Z'),
      reviewNote: 'Document matches guardian profile',
    };
    const prisma = buildPrisma({
      guardianFindFirstQueue: [guardian, guardian],
      studentDocumentFindFirstQueue: [evidenceDocument],
      guardianIdentityVerificationCreateResult: createdVerification,
      guardianIdentityVerificationFindFirstQueue: [createdVerification],
      transactionGuardianIdentityVerificationUpdateResult: reviewedVerification,
    });
    const { service, auditService } = buildService(prisma);

    const created = await service.createGuardianIdentityVerification(
      guardian.id,
      {
        documentType: 'citizenship',
        documentNumber: '12-34-56',
        evidenceDocumentId: evidenceDocument.id,
      },
      actor,
    );
    const reviewed = await service.reviewGuardianIdentityVerification(
      guardian.id,
      createdVerification.id,
      {
        status: 'VERIFIED',
        reviewNote: 'Document matches guardian profile',
      },
      actor,
    );

    expect(created.status).toBe('PENDING');
    expect(created).toEqual(
      expect.objectContaining({
        documentNumberRecorded: true,
        evidenceDocumentRecorded: true,
      }),
    );
    expect(created).not.toHaveProperty('documentNumber');
    expect(created).not.toHaveProperty('evidenceDocumentId');
    expect(prisma.guardianIdentityVerification.create).toHaveBeenCalledWith({
      data: {
        tenantId: actor.tenantId,
        guardianId: guardian.id,
        status: 'PENDING',
        documentType: 'citizenship',
        documentNumber: '12-34-56',
        evidenceDocumentId: evidenceDocument.id,
        notes: null,
        submittedById: actor.userId,
      },
    });
    expect(
      prisma.transaction.guardianIdentityVerification.updateMany,
    ).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        guardianId: guardian.id,
        status: 'VERIFIED',
        id: { not: createdVerification.id },
      },
      data: expect.objectContaining({
        status: 'REVOKED',
        reviewedById: actor.userId,
      }),
    });
    expect(reviewed.status).toBe('VERIFIED');
    expect(reviewed).not.toHaveProperty('documentNumber');
    expect(reviewed).not.toHaveProperty('evidenceDocumentId');
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'review',
        resource: 'guardian_identity_verification',
        resourceId: reviewedVerification.id,
      }),
    );
  });

  it('requires fee clearance before transfer when no waiver is provided', async () => {
    const student = buildStudent({
      lifecycleStatus: StudentLifecycleStatus.ACTIVE,
    });
    const invoice = {
      id: 'invoice-1',
      invoiceNumber: 'INV-1',
      status: 'ISSUED',
      totalAmount: new Prisma.Decimal(1000),
      dueDate: new Date('2026-05-01T00:00:00.000Z'),
      payments: [],
    };
    const prisma = buildPrisma({
      studentFindFirstQueue: [student],
      invoiceFindManyQueue: [[invoice]],
    });
    const { service } = buildService(prisma);

    await expect(
      service.requestTransfer(
        student.id,
        { reason: 'Relocating family' },
        actor,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('uses active payment allocations instead of legacy invoice links for clearance', async () => {
    const student = buildStudent({
      lifecycleStatus: StudentLifecycleStatus.ACTIVE,
    });
    const prisma = buildPrisma({
      studentFindFirstQueue: [student],
      invoiceFindManyQueue: [
        [
          {
            id: 'invoice-allocated-1',
            invoiceNumber: 'INV-ALLOCATED-1',
            status: 'ISSUED',
            totalAmount: new Prisma.Decimal(1000),
            dueDate: new Date('2026-05-01T00:00:00.000Z'),
            paymentAllocations: [
              { amount: new Prisma.Decimal(600), reversedAt: null },
              {
                amount: new Prisma.Decimal(400),
                reversedAt: new Date('2026-08-28T00:00:00.000Z'),
              },
            ],
            payments: [
              {
                amount: new Prisma.Decimal(1000),
                status: 'SUCCESS',
                refunds: [],
              },
            ],
          },
        ],
      ],
    });
    const { service } = buildService(prisma);

    const clearance = await service.getFeeClearance(student.id, actor);

    expect(clearance.cleared).toBe(false);
    expect(clearance.outstandingAmount).toBe(400);
    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          paymentAllocations: true,
          payments: { include: { refunds: true } },
        },
      }),
    );
  });

  it('requires finance-adjust authority before accepting a fee-clearance waiver', async () => {
    const prisma = buildPrisma({
      studentFindFirstQueue: [
        buildStudent({ lifecycleStatus: StudentLifecycleStatus.ACTIVE }),
      ],
    });
    const { service } = buildService(prisma);

    await expect(
      service.requestTransfer(
        'student-1',
        { reason: 'Principal-approved exception', waiveFeeClearance: true },
        actor,
      ),
    ).rejects.toThrow(
      'Waiving fee clearance requires the fees:adjust permission',
    );

    expect(prisma.student.findFirst).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('grants a finance-authorized clearance waiver from transactional fee truth', async () => {
    const student = buildStudent({
      lifecycleStatus: StudentLifecycleStatus.ACTIVE,
    });
    const invoice = {
      id: 'invoice-waiver-1',
      invoiceNumber: 'INV-WAIVER-1',
      status: 'ISSUED',
      totalAmount: new Prisma.Decimal(1500),
      dueDate: new Date('2026-05-01T00:00:00.000Z'),
      payments: [],
    };
    const prisma = buildPrisma({
      studentFindFirstQueue: [student],
      invoiceFindManyQueue: [[invoice], []],
      transactionInvoiceFindManyResult: [invoice],
    });
    const { service, auditService } = buildService(prisma);

    await service.requestTransfer(
      student.id,
      { reason: 'Approved relocation exception', waiveFeeClearance: true },
      { ...actor, permissions: [...actor.permissions, 'fees:adjust'] },
    );

    expect(prisma.transaction.student.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          feeClearanceWaivedAt: expect.any(Date),
          feeClearanceWaivedById: actor.userId,
        }),
      }),
    );
    expect(
      prisma.transaction.studentLifecycleTransition.create,
    ).toHaveBeenCalledWith({
      data: expect.objectContaining({
        feeClearanceWaived: true,
        metadata: expect.objectContaining({
          feeClearance: expect.objectContaining({
            clearedBeforeDecision: false,
            outstandingAmountAtDecision: 1500,
            waiverGranted: true,
          }),
        }),
      }),
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'transfer_with_fee_waiver',
        after: expect.objectContaining({
          feeClearance: expect.objectContaining({
            outstandingAmountAtDecision: 1500,
            waiverGranted: true,
          }),
        }),
      }),
      prisma.transaction,
    );
  });

  it('rejects an exit when transactional revalidation finds new debt', async () => {
    const student = buildStudent({
      lifecycleStatus: StudentLifecycleStatus.ACTIVE,
    });
    const prisma = buildPrisma({
      studentFindFirstQueue: [student],
      invoiceFindManyQueue: [[]],
      transactionInvoiceFindManyResult: [
        {
          id: 'invoice-concurrent-1',
          invoiceNumber: 'INV-CONCURRENT-1',
          status: 'ISSUED',
          totalAmount: new Prisma.Decimal(750),
          dueDate: new Date('2026-05-01T00:00:00.000Z'),
          payments: [],
        },
      ],
    });
    const { service, auditService } = buildService(prisma);

    await expect(
      service.archiveStudent(
        student.id,
        { reason: 'Guardian-requested withdrawal' },
        actor,
      ),
    ).rejects.toThrow(
      'Fee clearance is required before student exit or archive',
    );

    expect(prisma.transaction.student.updateMany).not.toHaveBeenCalled();
    expect(prisma.transaction.enrollment.updateMany).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('maps serializable lifecycle conflicts to a bounded retry response', async () => {
    const student = buildStudent({
      lifecycleStatus: StudentLifecycleStatus.ACTIVE,
    });
    const prisma = buildPrisma({
      studentFindFirstQueue: [student],
      invoiceFindManyQueue: [[]],
    });
    prisma.$transaction.mockRejectedValueOnce({ code: 'P2034' });
    const { service } = buildService(prisma);

    await expect(
      service.archiveStudent(
        student.id,
        { reason: 'Guardian-requested withdrawal' },
        actor,
      ),
    ).rejects.toThrow(
      'Student or fee-clearance state changed while this action was being finalized',
    );
  });

  it('requires fee clearance before exiting or archiving an active student', async () => {
    const student = buildStudent({
      lifecycleStatus: StudentLifecycleStatus.ACTIVE,
    });
    const invoice = {
      id: 'invoice-1',
      invoiceNumber: 'INV-1',
      status: 'ISSUED',
      totalAmount: new Prisma.Decimal(1000),
      dueDate: new Date('2026-05-01T00:00:00.000Z'),
      payments: [],
    };
    const prisma = buildPrisma({
      studentFindFirstQueue: [student],
      invoiceFindManyQueue: [[invoice]],
    });
    const { service } = buildService(prisma);

    await expect(
      service.archiveStudent(
        student.id,
        { reason: 'Withdrawal requested by guardian' },
        actor,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('requires fee clearance before moving a student into alumni history', async () => {
    const student = buildStudent({
      lifecycleStatus: StudentLifecycleStatus.ACTIVE,
    });
    const prisma = buildPrisma({
      studentFindFirstQueue: [student],
      invoiceFindManyQueue: [
        [
          {
            id: 'invoice-alumni-1',
            invoiceNumber: 'INV-ALUMNI-1',
            status: 'ISSUED',
            totalAmount: new Prisma.Decimal(1000),
            dueDate: new Date('2026-05-01T00:00:00.000Z'),
            payments: [],
          },
        ],
      ],
    });
    const { service } = buildService(prisma);

    await expect(
      service.archiveAlumni(
        student.id,
        { reason: 'Graduation completed' },
        actor,
      ),
    ).rejects.toThrow('Fee clearance is required before alumni archival');

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not complete a lifecycle exit when its audit append fails', async () => {
    const student = buildStudent({
      lifecycleStatus: StudentLifecycleStatus.ACTIVE,
    });
    const prisma = buildPrisma({
      studentFindFirstQueue: [student],
      invoiceFindManyQueue: [[]],
    });
    const { service, auditService } = buildService(prisma);
    auditService.record.mockRejectedValueOnce(
      new Error('audit persistence unavailable'),
    );

    await expect(
      service.archiveStudent(
        student.id,
        { reason: 'Guardian-requested withdrawal' },
        actor,
      ),
    ).rejects.toThrow('audit persistence unavailable');

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'exit',
        resourceId: student.id,
      }),
      prisma.transaction,
    );
  });

  it('rejects missing students in tenant-scoped operations', async () => {
    const prisma = buildPrisma({
      studentFindFirstQueue: [null],
    });
    const { service } = buildService(prisma);

    await expect(service.getFeeClearance('missing', actor)).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('attendance history', () => {
  it('returns student attendance history with summary and records', async () => {
    const student = buildStudent({
      id: 'student-1',
      firstNameEn: 'Erwin',
      lastNameEn: 'Shrestha',
      class: { id: 'class-1', name: 'Grade 10' },
      sectionRef: { id: 'section-1', name: 'A' },
    });

    const records = [
      {
        id: 'record-1',
        attendanceSessionId: 'session-1',
        status: AttendanceStatus.PRESENT,
        remark: 'On time',
        attendanceSession: {
          attendanceDate: new Date('2026-05-01'),
          class: { name: 'Grade 10' },
          section: { name: 'A' },
          submittedById: 'user-2',
          submittedAt: new Date('2026-05-01T09:00:00Z'),
          submittedBy: {
            email: 'teacher@schoolos.test',
            staff: { firstName: 'John', lastName: 'Doe' },
          },
        },
      },
      {
        id: 'record-2',
        attendanceSessionId: 'session-2',
        status: AttendanceStatus.ABSENT,
        remark: 'Sick',
        attendanceSession: {
          attendanceDate: new Date('2026-05-02'),
          class: { name: 'Grade 10' },
          section: { name: 'A' },
          submittedById: 'user-2',
          submittedAt: new Date('2026-05-02T09:00:00Z'),
          submittedBy: {
            email: 'teacher@schoolos.test',
            staff: { firstName: 'John', lastName: 'Doe' },
          },
        },
      },
    ];

    const prisma = buildPrisma({
      studentFindFirstQueue: [student],
      attendanceRecordFindManyResult: records,
    });
    const { service } = buildService(prisma);

    const result = await service.getAttendanceHistory(
      student.id,
      { status: AttendanceStatus.PRESENT },
      actor,
    );

    expect(prisma.student.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: student.id, tenantId: actor.tenantId },
      }),
    );

    expect(prisma.attendanceRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          studentId: student.id,
          tenantId: actor.tenantId,
          status: AttendanceStatus.PRESENT,
        }),
      }),
    );

    expect(result.summary.totalRecords).toBe(2);
    expect(result.summary.presentCount).toBe(1);
    expect(result.summary.absentCount).toBe(1);
    expect(result.summary.attendancePercentage).toBe(50);
    expect(result.records).toHaveLength(2);
    expect(result.records[0].markedByName).toBe('John Doe');
    expect(result.student.fullNameEn).toBe('Erwin Shrestha');
  });

  it('enforces tenant isolation for attendance history', async () => {
    const prisma = buildPrisma({
      studentFindFirstQueue: [null],
    });
    const { service } = buildService(prisma);

    await expect(
      service.getAttendanceHistory('student-other-tenant', {}, actor),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('Cross-Tenant Access Hardening', () => {
  it('rejects getStudentProfile for a student outside the actor tenant', async () => {
    const prisma = buildPrisma({ studentFindFirstQueue: [null] });
    const { service } = buildService(prisma);

    await expect(
      service.getStudentProfile('student-cross-tenant', actor),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects getStudentProfile for an unassigned teacher', async () => {
    const student = buildStudent({
      enrollments: [
        {
          id: 'enrollment-1',
          status: EnrollmentStatus.ACTIVE,
          academicYearId: 'academic-year-1',
          classId: 'class-1',
          sectionId: 'section-1',
          academicYear: { name: '2083' },
          class: { name: 'Grade 1' },
          section: { name: 'A' },
          rollNumber: 7,
          admissionDate: new Date('2026-04-01T00:00:00.000Z'),
        },
      ],
    });
    const prisma = buildPrisma({
      studentFindFirstQueue: [student],
      staffFindFirstResult: { id: 'staff-unassigned' },
      subjectTeacherAssignmentFindFirstResult: null,
      sectionFindFirstResult: null,
    });
    const { service } = buildService(prisma, {
      requireActorAccess: jest
        .fn()
        .mockRejectedValue(createTeacherScopeDeniedException()),
    });

    const denied = service.getStudentProfile(student.id, {
      ...actor,
      userId: 'teacher-user-1',
      roles: ['teacher'],
      permissions: ['students:read'],
    });

    await expect(denied).rejects.toBeInstanceOf(ForbiddenException);
    await expect(denied).rejects.toMatchObject({
      response: expect.objectContaining({
        code: TEACHER_SCOPE_DENIED_CODE,
      }),
    });
  });

  it('allows getStudentProfile through the canonical homeroom assignment scope', async () => {
    const student = buildStudent({
      enrollments: [
        {
          id: 'enrollment-1',
          status: EnrollmentStatus.ACTIVE,
          academicYearId: 'academic-year-1',
          classId: 'class-1',
          sectionId: 'section-1',
          academicYear: { name: '2083' },
          class: { name: 'Grade 1' },
          section: { name: 'A' },
          rollNumber: 7,
          admissionDate: new Date('2026-04-01T00:00:00.000Z'),
        },
      ],
    });
    const prisma = buildPrisma({
      studentFindFirstQueue: [student],
      staffFindFirstResult: { id: 'staff-homeroom-1' },
      subjectTeacherAssignmentFindFirstResult: null,
      sectionFindFirstResult: { id: 'section-1' },
    });
    const { service, teacherScopeService } = buildService(prisma);

    await expect(
      service.getStudentProfile(student.id, {
        ...actor,
        userId: 'teacher-user-1',
        roles: ['teacher'],
        permissions: ['students:read'],
      }),
    ).resolves.toBeDefined();
    expect(teacherScopeService.requireActorAccess).toHaveBeenCalledWith(
      {
        academicYearId: 'academic-year-1',
        classId: 'class-1',
        sectionId: 'section-1',
        capability: TeacherCapability.CLASS_ROSTER_READ,
      },
      expect.objectContaining({ userId: 'teacher-user-1' }),
    );
  });

  it('rejects updateStudent for a student outside the actor tenant', async () => {
    const prisma = buildPrisma({ studentFindFirstQueue: [null] });
    const { service } = buildService(prisma);

    await expect(
      service.updateStudent(
        'student-cross-tenant',
        { firstNameEn: 'Aarav' },
        actor,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects getIemisReadiness for a student outside the actor tenant', async () => {
    const prisma = buildPrisma({ studentFindFirstQueue: [null] });
    const { service } = buildService(prisma);

    await expect(
      service.getIemisReadiness('student-cross-tenant', actor),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects getStudentLifecycleTimeline for a student outside the actor tenant', async () => {
    const prisma = buildPrisma({ studentFindFirstQueue: [null] });
    const { service } = buildService(prisma);

    await expect(
      service.getStudentLifecycleTimeline('student-cross-tenant', actor),
    ).rejects.toThrow(NotFoundException);
  });
});

async function createTestJpeg(width: number, height: number) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 120, g: 140, b: 180 },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
}

const SCHOOL_LOGO_FILE_ASSET_ID = '11111111-1111-1111-1111-111111111111';

function configureSchoolLogo(
  prisma: ReturnType<typeof buildPrisma>,
  fileRegistryService: ReturnType<typeof buildService>['fileRegistryService'],
  content: Buffer,
) {
  prisma.tenantSetting.findUnique.mockResolvedValue({
    value: SCHOOL_LOGO_FILE_ASSET_ID,
  });
  fileRegistryService.getFileMetadata.mockResolvedValue({
    id: SCHOOL_LOGO_FILE_ASSET_ID,
    tenantId: actor.tenantId,
    module: 'settings',
    entityId: actor.tenantId,
    status: FileStatus.UPLOADED,
    originalFilename: 'school-logo.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: BigInt(content.length),
    metadata: { kind: 'SCHOOL_LOGO' },
  });
  fileRegistryService.getProtectedDownload.mockResolvedValue({ content });
}

function buildGuardianAdministrationLink() {
  return {
    id: 'student-guardian-1',
    tenantId: actor.tenantId,
    studentId: 'student-1',
    guardianId: 'guardian-1',
    relation: 'MOTHER',
    isPrimary: true,
    appLoginLinked: true,
    capabilities: [
      GuardianCapability.ACADEMICS_VIEW,
      GuardianCapability.ATTENDANCE_VIEW,
    ],
    verificationStatus: GuardianRelationshipVerificationStatus.VERIFIED,
    status: GuardianRelationshipStatus.ACTIVE,
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveUntil: null,
    emergencyContactPriority: 1,
    approvalStatus: GuardianRelationshipApprovalStatus.APPROVED,
    restrictionReasonRef: null,
    approvedById: actor.userId,
    approvedAt: new Date('2026-01-01T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    guardian: {
      id: 'guardian-1',
      tenantId: actor.tenantId,
      userId: 'guardian-user-1',
      fullName: 'Maya Shrestha',
      relation: 'MOTHER',
      primaryPhone: '+9779800000000',
      secondaryPhone: null,
      email: 'maya@example.com',
      occupation: null,
      homeAddress: null,
      wardNumber: null,
      receivesAlerts: true,
      privacyConsentAt: new Date('2026-01-01T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      user: {
        id: 'guardian-user-1',
        tenantId: actor.tenantId,
        email: 'maya@example.com',
        phone: '+9779800000000',
        status: 'ACTIVE',
        lastLoginAt: new Date('2026-07-28T01:00:00.000Z'),
      },
    },
  };
}

function buildStudent(
  overrides: Partial<{
    id: string;
    studentSystemId: string;
    firstNameEn: string;
    lastNameEn: string;
    firstNameNp: string | null;
    lastNameNp: string | null;
    dateOfBirth: Date;
    gender: string;
    nationality: string | null;
    motherTongue: string | null;
    ethnicity: string | null;
    disabilityFlag: string | null;
    admissionDate: Date;
    admissionNumber: string | null;
    lifecycleStatus: StudentLifecycleStatus;
    classId: string;
    class: { id: string; name: string };
    section: string | null;
    sectionRef: { id: string; name: string } | null;
    rollNumber: number | null;
    guardianLinks: {
      guardianId?: string;
      guardian: {
        id?: string;
        fullName: string;
        relation?: string;
        primaryPhone: string | null;
        email: string | null;
        wardNumber: string | null;
      };
      relation: string;
      isPrimary: boolean;
      appLoginLinked?: boolean;
      capabilities?: GuardianCapability[];
      verificationStatus?: GuardianRelationshipVerificationStatus;
      status?: GuardianRelationshipStatus;
      effectiveFrom?: Date;
      effectiveUntil?: Date | null;
      emergencyContactPriority?: number | null;
      approvalStatus?: GuardianRelationshipApprovalStatus;
      restrictionReasonRef?: string | null;
    }[];
    enrollments: {
      id?: string;
      academicYearId?: string;
      academicYear: { name: string; startsOn?: Date };
      classId: string;
      sectionId?: string | null;
      rollNumber?: number | null;
      admissionDate?: Date;
      class?: { name: string };
      section: { name: string } | null;
      status: EnrollmentStatus;
    }[];
    tenant: { name: string };
    documents: unknown[];
    generatedDocuments: unknown[];
    invoices: unknown[];
    attendanceRecords: unknown[];
    identities: unknown[];
    _count?: {
      invoices: number;
      payments: number;
      studentFeeAssignments: number;
    };
  }> = {},
) {
  return {
    id: overrides.id ?? 'student-1',
    tenantId: actor.tenantId,
    studentSystemId: overrides.studentSystemId ?? 'SCH-2026-0001',
    firstNameEn: overrides.firstNameEn ?? 'Erwin',
    lastNameEn: overrides.lastNameEn ?? 'Shrestha',
    firstNameNp: 'firstNameNp' in overrides ? overrides.firstNameNp : 'एरविन',
    lastNameNp: 'lastNameNp' in overrides ? overrides.lastNameNp : 'श्रेष्ठ',
    dateOfBirth: overrides.dateOfBirth ?? new Date('2016-01-02T00:00:00.000Z'),
    gender: overrides.gender ?? 'MALE',
    nationality: overrides.nationality ?? 'Nepali',
    motherTongue: overrides.motherTongue ?? 'Nepali',
    ethnicity: overrides.ethnicity ?? 'Brahmin',
    disabilityFlag: overrides.disabilityFlag ?? null,
    admissionDate:
      overrides.admissionDate ?? new Date('2026-04-01T00:00:00.000Z'),
    admissionNumber: overrides.admissionNumber ?? 'ADM-1',
    lifecycleStatus: overrides.lifecycleStatus ?? StudentLifecycleStatus.ACTIVE,
    classId: overrides.classId ?? 'class-1',
    class: overrides.class ?? { id: 'class-1', name: 'Grade 1' },
    section: 'section' in overrides ? overrides.section : 'A',
    sectionRef:
      'sectionRef' in overrides
        ? overrides.sectionRef
        : { id: 'section-1', name: 'A' },
    rollNumber: overrides.rollNumber ?? 7,
    destinationSchool: null,
    conductRemark: null,
    exitedAt: null,
    exitReason: null,
    feeClearanceWaivedAt: null,
    guardianLinks: overrides.guardianLinks ?? [],
    enrollments: overrides.enrollments ?? [],
    documents: overrides.documents ?? [],
    generatedDocuments: overrides.generatedDocuments ?? [],
    invoices: overrides.invoices ?? [],
    attendanceRecords: overrides.attendanceRecords ?? [],
    identities: overrides.identities ?? [],
    tenant: overrides.tenant ?? { name: 'Everest Academy' },
    _count: overrides._count ?? {
      invoices: 0,
      payments: 0,
      studentFeeAssignments: 0,
    },
  };
}

function buildService(
  prisma: ReturnType<typeof buildPrisma>,
  teacherScopeOverrides: Partial<{
    resolveReadableScope: jest.Mock;
    requireActorAccess: jest.Mock;
  }> = {},
) {
  const usersService = {
    createManagedUser: jest.fn().mockResolvedValue({
      id: 'guardian-user-provisioned',
      email: 'maya@example.com',
      phone: '+9779800000000',
      status: 'ACTIVE',
    }),
  };
  const communicationsService = {
    recordDeliveryRecords: jest.fn(),
  };
  const notificationsService = {
    sendEmail: jest.fn(),
    sendSms: jest.fn(),
  };
  const auditService = {
    record: jest.fn(),
  };
  const storageService = {
    saveBufferObject: jest.fn(
      async (input: { prefix: string; content?: Buffer }) => ({
        provider: 'LOCAL',
        objectKey: `tenant-1/${input.prefix}/generated-doc.pdf`,
        publicUrl: '/storage/generated-doc.pdf',
        sizeBytes: 512,
      }),
    ),
    deleteObject: jest.fn().mockResolvedValue(undefined),
  };
  const fileRegistryService = {
    registerFile: jest.fn().mockResolvedValue({ id: 'generated-file-asset' }),
    markUploaded: jest.fn().mockResolvedValue({ id: 'generated-file-asset' }),
    registerGeneratedFile: jest.fn().mockResolvedValue({
      id: 'generated-file-asset',
      objectKey:
        'tenant-1/students/student-1/generated-documents/enrollment-confirmation/generated-doc.pdf',
      sizeBytes: BigInt(512),
      storageProvider: 'LOCAL',
    }),
    getSignedUrl: jest.fn(),
    listFilesByEntity: jest.fn().mockResolvedValue([]),
    getFileMetadata: jest.fn(),
    getProtectedDownload: jest.fn(),
    softDeleteFile: jest.fn(),
  };
  const usageService = {
    verifyLimit: jest.fn(),
    checkLimit: jest.fn(),
  };
  const studentPhotoService = {
    getPhotoContent: jest
      .fn()
      .mockRejectedValue(new Error('No student photo in this test')),
  };
  const teacherScopeService = {
    resolveReadableScope: jest.fn().mockResolvedValue({
      assignments: [],
      homeroomSectionIds: new Set<string>(),
      subjectsBySection: new Map<string, Set<string>>(),
      allSectionIds: new Set<string>(),
    }),
    requireActorAccess: jest.fn().mockResolvedValue({
      source: 'ASSIGNMENT',
      assignmentId: 'assignment-1',
    }),
    ...teacherScopeOverrides,
  };

  return {
    service: new StudentsService(
      prisma as never,
      usersService as never,
      communicationsService as never,
      notificationsService as never,
      auditService as never,
      storageService as never,
      fileRegistryService as never,
      usageService as never,
      studentPhotoService as never,
      teacherScopeService as never,
    ),
    prisma,
    auditService,
    notificationsService,
    storageService,
    fileRegistryService,
    studentPhotoService,
    teacherScopeService,
    usersService,
  };
}

function buildPrisma(options: {
  studentFindFirstQueue?: unknown[];
  studentFindManyResult?: unknown[];
  studentCountQueue?: number[];
  studentGroupByResult?: unknown[];
  admissionApplicationCountResult?: number;
  studentQrCredentialCountResult?: number;
  studentDocumentFindManyResult?: unknown[];
  studentDocumentHistoryFindManyResult?: unknown[];
  refreshTokenFindManyResult?: unknown[];
  refreshTokenFindFirstResult?: unknown;
  otpCodeFindFirstResult?: unknown;
  auditLogFindManyResult?: unknown[];
  guardianFindFirstQueue?: unknown[];
  studentGuardianFindFirstResult?: unknown;
  studentGuardianFindManyResult?: unknown[];
  studentDocumentFindFirstQueue?: unknown[];
  invoiceFindManyQueue?: unknown[];
  transactionInvoiceFindManyResult?: unknown[];
  classFindFirstResult?: unknown;
  sectionFindFirstResult?: unknown;
  enrollmentFindFirstResult?: unknown;
  generatedStudentDocumentFindFirstQueue?: unknown[];
  generatedStudentDocumentFindUniqueResult?: unknown;
  generatedStudentDocumentFindManyResult?: unknown[];
  guardianIdentityVerificationCreateResult?: unknown;
  guardianIdentityVerificationFindManyResult?: unknown[];
  guardianIdentityVerificationFindFirstQueue?: unknown[];
  activityPostFindManyResult?: unknown[];
  transactionGuardianIdentityVerificationUpdateResult?: unknown;
  transactionStudentUpdateResult?: unknown;
  transactionStudentUpdateManyCount?: number;
  attendanceRecordFindManyResult?: unknown[];
  studentDocumentExpiryTemplateFindManyResult?: unknown[];
  studentDocumentExpiryTemplateUpsertResult?: unknown;
  subjectTeacherAssignmentFindFirstResult?: unknown;
  staffFindFirstResult?: unknown;
  subjectTeacherAssignmentFindManyResult?: unknown[];
  sectionFindManyResult?: unknown[];
  transactionRefreshTokenUpdateManyCount?: number;
  transactionStudentGuardianUpdateManyCount?: number;
}) {
  const transaction = {
    enrollment: {
      create: jest.fn().mockResolvedValue({ id: 'enrollment-created' }),
      update: jest.fn().mockResolvedValue({ id: 'enrollment-updated' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    student: {
      findFirst: jest.fn().mockImplementation(async () => {
        const queue = options.studentFindFirstQueue ?? [];

        if (queue.length === 0) {
          return null;
        }

        if (queue.length === 1) {
          return queue[0];
        }

        return queue.shift();
      }),
      update: jest
        .fn()
        .mockResolvedValue(options.transactionStudentUpdateResult ?? null),
      updateMany: jest.fn().mockResolvedValue({
        count: options.transactionStudentUpdateManyCount ?? 1,
      }),
    },
    studentGuardian: {
      findFirst: jest
        .fn()
        .mockResolvedValue(options.studentGuardianFindFirstResult ?? null),
      findMany: jest
        .fn()
        .mockResolvedValue(options.studentGuardianFindManyResult ?? []),
      create: jest.fn().mockImplementation(async ({ data }) => ({
        id: 'student-guardian-created',
        ...data,
      })),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({ id: 'student-guardian-updated' }),
      updateMany: jest.fn().mockResolvedValue({
        count: options.transactionStudentGuardianUpdateManyCount ?? 1,
      }),
    },
    guardian: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'guardian-3',
        fullName: 'Sita Rai',
        primaryPhone: '+9779800000003',
        relation: 'LOCAL_GUARDIAN',
      }),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue({ id: 'guardian-updated' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    user: {
      update: jest.fn().mockImplementation(async ({ data }) => ({
        id: 'guardian-user-1',
        ...data,
      })),
    },
    refreshToken: {
      updateMany: jest.fn().mockResolvedValue({
        count: options.transactionRefreshTokenUpdateManyCount ?? 1,
      }),
    },
    studentDocument: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
    generatedStudentDocument: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue({ id: 'doc-created' }),
    },
    invoice: {
      findMany: jest
        .fn()
        .mockResolvedValue(options.transactionInvoiceFindManyResult ?? []),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    payment: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    feeWaiver: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    notificationDelivery: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    attendanceRecord: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    developmentalMilestone: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    moodLog: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    libraryIssue: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    transportEnrollment: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    transportLog: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    conversation: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    conversationParticipant: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    studentLifecycleTransition: {
      create: jest.fn().mockResolvedValue({ id: 'transition-merge' }),
    },
    studentMergeHistory: {
      create: jest.fn().mockResolvedValue({ id: 'merge-history-1' }),
    },
    studentDuplicateReview: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    reportExport: {
      update: jest.fn().mockResolvedValue({ id: 'export-1' }),
    },
    guardianIdentityVerification: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest
        .fn()
        .mockResolvedValue(
          options.transactionGuardianIdentityVerificationUpdateResult ?? null,
        ),
    },
    attendanceCorrectionRequest: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    canteenStudentEnrollment: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    canteenMealServing: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    canteenWalletTransaction: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };

  const prisma = {
    student: {
      findFirst: jest.fn().mockImplementation(async () => {
        const queue = options.studentFindFirstQueue ?? [];

        if (queue.length === 0) {
          return null;
        }

        if (queue.length === 1) {
          return queue[0];
        }

        return queue.shift();
      }),
      findMany: jest
        .fn()
        .mockResolvedValue(options.studentFindManyResult ?? []),
      findUnique: jest.fn().mockImplementation(async () => {
        const queue = options.studentFindFirstQueue ?? [];
        return queue.length > 0 ? queue[0] : null;
      }),
      count: jest
        .fn()
        .mockImplementation(
          async () => options.studentCountQueue?.shift() ?? 0,
        ),
      groupBy: jest.fn().mockResolvedValue(options.studentGroupByResult ?? []),
    },
    admissionApplication: {
      count: jest
        .fn()
        .mockResolvedValue(options.admissionApplicationCountResult ?? 0),
    },
    studentQrCredential: {
      count: jest
        .fn()
        .mockResolvedValue(options.studentQrCredentialCountResult ?? 0),
    },
    subjectTeacherAssignment: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          options.subjectTeacherAssignmentFindFirstResult ?? null,
        ),
      findMany: jest
        .fn()
        .mockResolvedValue(
          options.subjectTeacherAssignmentFindManyResult ?? [],
        ),
    },
    staff: {
      findFirst: jest
        .fn()
        .mockResolvedValue(options.staffFindFirstResult ?? null),
    },
    class: {
      findFirst: jest
        .fn()
        .mockResolvedValue(options.classFindFirstResult ?? { id: 'class-1' }),
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 'class-1', name: 'Grade 1' }),
    },
    section: {
      findFirst: jest
        .fn()
        .mockResolvedValue(options.sectionFindFirstResult ?? null),
      findMany: jest
        .fn()
        .mockResolvedValue(options.sectionFindManyResult ?? []),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    tenant: {
      findUnique: jest.fn().mockResolvedValue({ name: 'Everest Academy' }),
    },
    role: {
      findUnique: jest.fn().mockResolvedValue({ id: 'parent-role-1' }),
    },
    enrollment: {
      findFirst: jest
        .fn()
        .mockResolvedValue(options.enrollmentFindFirstResult ?? null),
    },
    guardian: {
      findFirst: jest.fn().mockImplementation(async () => {
        const queue = options.guardianFindFirstQueue ?? [];

        if (queue.length === 0) {
          return null;
        }

        if (queue.length === 1) {
          return queue[0];
        }

        return queue.shift();
      }),
    },
    studentGuardian: {
      findFirst: jest
        .fn()
        .mockResolvedValue(options.studentGuardianFindFirstResult ?? null),
      findMany: jest
        .fn()
        .mockResolvedValue(options.studentGuardianFindManyResult ?? []),
    },
    studentDocument: {
      findFirst: jest.fn().mockImplementation(async () => {
        const queue = options.studentDocumentFindFirstQueue ?? [];

        if (queue.length === 0) {
          return null;
        }

        if (queue.length === 1) {
          return queue[0];
        }

        return queue.shift();
      }),
      findMany: jest
        .fn()
        .mockResolvedValue(options.studentDocumentFindManyResult ?? []),
    },
    studentDocumentHistory: {
      findMany: jest
        .fn()
        .mockResolvedValue(options.studentDocumentHistoryFindManyResult ?? []),
      create: jest.fn().mockResolvedValue({ id: 'document-history-1' }),
    },
    studentDocumentExpiryTemplate: {
      findMany: jest
        .fn()
        .mockResolvedValue(
          options.studentDocumentExpiryTemplateFindManyResult ?? [],
        ),
      upsert: jest.fn().mockResolvedValue(
        options.studentDocumentExpiryTemplateUpsertResult ?? {
          id: 'template-1',
          channel: 'email',
          reminderStatus: 'expiring',
          subjectTemplate: '{{studentName}} document reminder',
          messageTemplate:
            '{{documentTitle}} for {{studentName}} expires on {{expiryLabel}}',
          daysBeforeExpiry: 30,
          isActive: true,
          updatedById: actor.userId,
          createdAt: new Date('2026-03-01T00:00:00.000Z'),
          updatedAt: new Date('2026-03-01T00:00:00.000Z'),
        },
      ),
    },
    invoice: {
      findMany: jest
        .fn()
        .mockImplementation(
          async () => options.invoiceFindManyQueue?.shift() ?? [],
        ),
    },
    generatedStudentDocument: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          options.generatedStudentDocumentFindUniqueResult ?? null,
        ),
      findFirst: jest
        .fn()
        .mockImplementation(
          async () =>
            options.generatedStudentDocumentFindFirstQueue?.shift() ?? null,
        ),
      findMany: jest
        .fn()
        .mockResolvedValue(
          options.generatedStudentDocumentFindManyResult ?? [],
        ),
      update: jest.fn(),
    },
    guardianIdentityVerification: {
      create: jest
        .fn()
        .mockResolvedValue(options.guardianIdentityVerificationCreateResult),
      findMany: jest
        .fn()
        .mockResolvedValue(
          options.guardianIdentityVerificationFindManyResult ?? [],
        ),
      findFirst: jest.fn().mockImplementation(async () => {
        const queue = options.guardianIdentityVerificationFindFirstQueue ?? [];

        if (queue.length === 0) {
          return null;
        }

        if (queue.length === 1) {
          return queue[0];
        }

        return queue.shift();
      }),
    },
    refreshToken: {
      findMany: jest
        .fn()
        .mockResolvedValue(options.refreshTokenFindManyResult ?? []),
      findFirst: jest
        .fn()
        .mockResolvedValue(options.refreshTokenFindFirstResult ?? null),
    },
    otpCode: {
      findFirst: jest
        .fn()
        .mockResolvedValue(options.otpCodeFindFirstResult ?? null),
    },
    auditLog: {
      findMany: jest
        .fn()
        .mockResolvedValue(options.auditLogFindManyResult ?? []),
    },
    activityPost: {
      findMany: jest
        .fn()
        .mockResolvedValue(options.activityPostFindManyResult ?? []),
    },
    studentLifecycleTransition: {
      create: jest.fn().mockResolvedValue({ id: 'transition-1' }),
    },
    attendanceRecord: {
      findMany: jest
        .fn()
        .mockResolvedValue(options.attendanceRecordFindManyResult ?? []),
    },
    reportExport: {
      create: jest.fn().mockResolvedValue({ id: 'export-1' }),
      update: jest.fn().mockResolvedValue({ id: 'export-1' }),
    },
    tenantSetting: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    $transaction: jest
      .fn()
      .mockImplementation(
        async (callback: (tx: typeof transaction) => unknown) =>
          callback(transaction),
      ),
    transaction,
  };

  return prisma;
}
