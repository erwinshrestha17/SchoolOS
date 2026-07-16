import {
  ActivityCategory,
  ActivityPostStatus,
  ActivityReactionType,
  AudienceType,
  AuthMethod,
  ConsentType,
  DevelopmentalMilestoneStatus,
  EnrollmentStatus,
  StaffStatus,
  StudentLifecycleStatus,
  StorageProvider,
} from '@prisma/client';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { AuthContext } from '../auth/auth.types.js';
import { ActivityFeedService } from './activity-feed.service';

describe('ActivityFeedService', () => {
  let prisma: any;
  let storageService: any;
  let communicationsService: any;
  let auditService: any;
  let fileRegistry: any;
  let mediaQueue: any;
  let service: ActivityFeedService;
  let actor: AuthContext;

  beforeEach(() => {
    prisma = {
      class: {
        findFirst: jest.fn(),
      },
      section: {
        findFirst: jest.fn(),
      },
      student: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      subjectTeacherAssignment: {
        findMany: jest.fn(),
      },
      staff: {
        findFirst: jest.fn(),
      },
      guardian: {
        findFirst: jest.fn(),
      },
      guardianConsent: {
        findFirst: jest.fn(),
      },
      activityPost: {
        create: jest.fn(),
        deleteMany: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      activityReaction: {
        findFirst: jest.fn(),
        create: jest.fn(),
        groupBy: jest.fn(),
      },
      fileAsset: {
        delete: jest.fn(),
        update: jest.fn(),
      },
      moodLog: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      developmentalMilestone: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    };
    storageService = {
      deleteObject: jest.fn(),
      saveBase64Object: jest.fn(),
    };
    communicationsService = {
      recordDeliveryRecords: jest.fn(),
    };
    auditService = {
      record: jest.fn(),
    };
    actor = {
      userId: 'teacher-1',
      tenantId: 'tenant-1',
      tenantSlug: 'green-valley',
      email: 'teacher@school.test',
      authMethod: AuthMethod.PASSWORD,
      roles: ['teacher'],
      permissions: ['activity_feed:create'],
    };

    fileRegistry = {
      registerFile: jest.fn(),
      markUploaded: jest.fn(),
      getSignedUrl: jest.fn(),
      auditAccess: jest.fn(),
    };
    mediaQueue = { add: jest.fn() };

    service = new ActivityFeedService(
      prisma,
      storageService,
      communicationsService,
      auditService,
      { emit: jest.fn() } as any,
      fileRegistry,
      mediaQueue,
    );
  });

  it('returns milestone templates filtered by stage aliases and domain', () => {
    const templates = service.listMilestoneTemplates({
      stage: 'montessori',
      domain: 'Language',
    });

    expect(templates).toEqual([
      expect.objectContaining({
        key: 'ecd-language-follows-two-step',
        stage: 'ECD',
        domain: 'Language',
        milestone: 'Follows two-step classroom instructions',
      }),
      expect.objectContaining({
        key: 'ecd-language-communicates-needs',
        stage: 'ECD',
        domain: 'Language',
        milestone: 'Communicates needs more clearly',
      }),
    ]);
    expect(templates[0]).not.toHaveProperty('stageAliases');
  });

  it('stores post attachments, student tags, delivery records, and audit trail in one tenant scope', async () => {
    prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });
    prisma.section.findFirst.mockResolvedValue({
      id: 'section-1',
      classId: 'class-1',
    });
    prisma.student.findMany.mockResolvedValue([
      {
        id: 'student-1',
        guardianLinks: [
          {
            guardian: {
              consents: [{ granted: true, revokedAt: null }],
            },
          },
        ],
      },
    ]);
    prisma.staff.findFirst.mockResolvedValue({ id: 'staff-1' });
    fileRegistry.registerFile.mockResolvedValue({ id: 'file-asset-1' });
    storageService.saveBase64Object.mockResolvedValue({
      provider: StorageProvider.LOCAL,
      objectKey: 'tenant-1/activity-feed/class-1/photo.jpg',
      publicUrl: '/storage/tenant-1/activity-feed/class-1/photo.jpg',
      sizeBytes: 42,
    });
    prisma.activityPost.create.mockImplementation(async ({ data }: any) => ({
      id: 'post-1',
      classId: data.classId,
      sectionId: data.sectionId,
      title: data.title,
      caption: data.caption,
      category: data.category,
      audienceType: data.audienceType,
      attachments: [{ id: 'attachment-1' }],
      studentTags: [{ studentId: 'student-1' }],
    }));

    const result = await service.createPost(
      {
        classId: 'class-1',
        sectionId: 'section-1',
        title: 'Science day',
        caption: 'Students built plant life-cycle charts.',
        category: ActivityCategory.LEARNING,
        studentIds: ['student-1'],
        attachments: [
          {
            fileName: 'photo.jpg',
            contentType: 'image/jpeg',
            base64Content: Buffer.from([0xff, 0xd8, 0xff, 0xdb]).toString(
              'base64',
            ),
          },
        ],
      },
      actor,
    );

    expect(result.id).toBe('post-1');
    expect(prisma.student.findMany).toHaveBeenCalledWith({
      select: {
        guardianLinks: {
          include: {
            guardian: {
              include: {
                consents: {
                  orderBy: { capturedAt: 'desc' },
                  take: 1,
                  where: { consentType: ConsentType.PHOTO_USAGE },
                },
              },
            },
          },
        },
        id: true,
        firstNameEn: true,
        lastNameEn: true,
      },
      where: {
        tenantId: 'tenant-1',
        classId: 'class-1',
        sectionId: 'section-1',
        lifecycleStatus: StudentLifecycleStatus.ACTIVE,
        id: { in: ['student-1'] },
      },
    });
    expect(prisma.activityPost.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          createdById: 'teacher-1',
          attachments: expect.objectContaining({
            create: [
              expect.objectContaining({
                tenantId: 'tenant-1',
                provider: StorageProvider.LOCAL,
                publicUrl: null,
                sortOrder: 0,
              }),
            ],
          }),
        }),
      }),
    );
    expect(fileRegistry.markUploaded).toHaveBeenCalledWith(
      'tenant-1',
      'file-asset-1',
      'teacher-1',
    );
    // Individually-tagged posts require approval, so guardian delivery is
    // deferred until a moderator approves the post rather than firing at
    // creation time.
    expect(communicationsService.recordDeliveryRecords).not.toHaveBeenCalled();
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'create',
        resource: 'activity_post',
        tenantId: 'tenant-1',
        after: expect.objectContaining({ requiresApproval: true }),
      }),
    );
  });

  it('replays a mobile client submission without storing duplicate media', async () => {
    prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });
    prisma.section.findFirst.mockResolvedValue({
      id: 'section-1',
      classId: 'class-1',
    });
    prisma.staff.findFirst.mockResolvedValue({ id: 'staff-1' });
    prisma.student.findMany.mockResolvedValue([
      {
        id: 'student-1',
        guardianLinks: [
          {
            guardian: {
              consents: [{ granted: true, revokedAt: null }],
            },
          },
        ],
      },
    ]);
    prisma.activityPost.findFirst.mockResolvedValue({
      id: 'post-existing',
      clientSubmissionId: '6731ea4f-5c37-4b16-bb72-955abbadc31b',
      attachments: [
        {
          id: 'attachment-existing',
          fileName: 'photo.jpg',
          contentType: 'image/jpeg',
          sizeBytes: 42,
          sortOrder: 0,
          processingStatus: 'READY',
          fileAssetId: 'file-asset-1',
        },
      ],
      studentTags: [{ studentId: 'student-1' }],
    });

    const result = await service.createPost(
      {
        clientSubmissionId: '6731ea4f-5c37-4b16-bb72-955abbadc31b',
        classId: 'class-1',
        sectionId: 'section-1',
        title: 'Science day',
        caption: 'Students built plant life-cycle charts.',
        category: ActivityCategory.LEARNING,
        studentIds: ['student-1'],
        attachments: [
          {
            fileName: 'photo.jpg',
            contentType: 'image/jpeg',
            base64Content: Buffer.from([0xff, 0xd8, 0xff, 0xdb]).toString(
              'base64',
            ),
          },
        ],
      },
      actor,
    );

    expect(result).toEqual(
      expect.objectContaining({
        id: 'post-existing',
        attachments: [
          expect.objectContaining({
            id: 'attachment-existing',
            previewUrl: expect.stringContaining(
              '/activity-feed/attachments/attachment-existing/preview',
            ),
          }),
        ],
      }),
    );
    expect(storageService.saveBase64Object).not.toHaveBeenCalled();
    expect(prisma.activityPost.create).not.toHaveBeenCalled();
  });

  it('resolves a concurrent idempotent create race to the existing post', async () => {
    prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });
    prisma.staff.findFirst.mockResolvedValue({ id: 'staff-1' });
    prisma.student.findMany.mockResolvedValue([
      {
        id: 'student-1',
        guardianLinks: [
          {
            guardian: {
              consents: [{ granted: true, revokedAt: null }],
            },
          },
        ],
      },
    ]);
    storageService.saveBase64Object.mockResolvedValue({
      provider: StorageProvider.LOCAL,
      objectKey: 'tenant-1/activity-feed/class-1/photo.jpg',
      sizeBytes: 42,
    });
    fileRegistry.registerFile.mockResolvedValue({ id: 'file-asset-race' });
    prisma.activityPost.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'post-existing',
        attachments: [],
        studentTags: [{ studentId: 'student-1' }],
      });
    prisma.activityPost.create.mockRejectedValue({ code: 'P2002' });

    await expect(
      service.createPost(
        {
          clientSubmissionId: '6731ea4f-5c37-4b16-bb72-955abbadc31b',
          classId: 'class-1',
          title: 'Science day',
          caption: 'Students built plant life-cycle charts.',
          studentIds: ['student-1'],
          attachments: [
            {
              fileName: 'photo.jpg',
              contentType: 'image/jpeg',
              base64Content: Buffer.from([0xff, 0xd8, 0xff, 0xdb]).toString(
                'base64',
              ),
            },
          ],
        },
        actor,
      ),
    ).resolves.toEqual(expect.objectContaining({ id: 'post-existing' }));

    expect(storageService.deleteObject).toHaveBeenCalledWith(
      'tenant-1/activity-feed/class-1/photo.jpg',
    );
    expect(prisma.fileAsset.delete).toHaveBeenCalledWith({
      where: { id: 'file-asset-race' },
    });
  });

  it('blocks activity media before storage when a tagged student lacks photo consent', async () => {
    prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });
    prisma.staff.findFirst.mockResolvedValue({ id: 'staff-1' });
    prisma.student.findMany.mockResolvedValue([
      {
        id: 'student-1',
        firstNameEn: 'Aarav',
        lastNameEn: 'Sharma',
        guardianLinks: [
          {
            guardian: {
              consents: [{ granted: false, revokedAt: null }],
            },
          },
        ],
      },
    ]);

    await expect(
      service.createPost(
        {
          classId: 'class-1',
          title: 'Class activity',
          caption: 'A consent-safe activity update.',
          studentIds: ['student-1'],
          attachments: [
            {
              fileName: 'photo.jpg',
              contentType: 'image/jpeg',
              base64Content: Buffer.from([0xff, 0xd8, 0xff, 0xdb]).toString(
                'base64',
              ),
            },
          ],
        },
        actor,
      ),
    ).rejects.toThrow('photo consent declined: Aarav Sharma');

    expect(storageService.saveBase64Object).not.toHaveBeenCalled();
    expect(fileRegistry.registerFile).not.toHaveBeenCalled();
  });

  it('returns a paginated assignment-scoped mobile student picker with consent state', async () => {
    prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });
    prisma.section.findFirst.mockResolvedValue({
      id: 'section-1',
      classId: 'class-1',
    });
    prisma.staff.findFirst.mockResolvedValue({ id: 'staff-1' });
    prisma.student.findMany.mockResolvedValue([
      {
        id: 'student-1',
        studentSystemId: 'STU-001',
        firstNameEn: 'Aarav',
        lastNameEn: 'Sharma',
        rollNumber: 1,
        guardianLinks: [
          {
            guardian: {
              consents: [{ granted: true, revokedAt: null }],
            },
          },
        ],
      },
    ]);
    prisma.student.count.mockResolvedValue(1);

    await expect(
      service.listTeacherMobileStudents(actor, {
        classId: 'class-1',
        sectionId: 'section-1',
        page: 1,
        limit: 20,
      }),
    ).resolves.toEqual({
      items: [
        {
          id: 'student-1',
          studentSystemId: 'STU-001',
          fullName: 'Aarav Sharma',
          rollNumber: 1,
          mediaConsentStatus: 'ALLOWED',
          mediaConsentGranted: true,
        },
      ],
      meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
    });
  });

  it('previews class, section, and student-specific audience with media consent counts', async () => {
    prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });
    prisma.section.findFirst.mockResolvedValue({
      id: 'section-1',
      classId: 'class-1',
    });
    prisma.student.findMany.mockResolvedValue([
      {
        id: 'student-1',
        firstNameEn: 'Aarav',
        lastNameEn: 'Sharma',
        classId: 'class-1',
        sectionId: 'section-1',
        guardianLinks: [
          {
            guardianId: 'guardian-1',
            isPrimary: true,
            guardian: {
              id: 'guardian-1',
              userId: 'guardian-user-1',
              receivesAlerts: true,
              consents: [{ granted: true, revokedAt: null }],
            },
          },
        ],
      },
      {
        id: 'student-2',
        firstNameEn: 'Mina',
        lastNameEn: 'Rai',
        classId: 'class-1',
        sectionId: 'section-1',
        guardianLinks: [
          {
            guardianId: 'guardian-2',
            isPrimary: true,
            guardian: {
              id: 'guardian-2',
              userId: null,
              receivesAlerts: true,
              consents: [{ granted: false, revokedAt: null }],
            },
          },
        ],
      },
    ]);

    await expect(
      service.previewAudience(actor, {
        classId: 'class-1',
        sectionId: 'section-1',
        studentIds: 'student-1,student-2',
      }),
    ).resolves.toEqual({
      audienceType: AudienceType.STUDENT,
      classId: 'class-1',
      sectionId: 'section-1',
      requestedStudentIds: ['student-1', 'student-2'],
      studentCount: 2,
      guardianRecipientCount: 2,
      pushRecipientCount: 1,
      mediaConsent: {
        grantedStudentCount: 1,
        blockedStudentCount: 1,
        allowedCount: 1,
        notAllowedCount: 1,
        restrictedCount: 0,
        notRecordedCount: 0,
      },
      students: [
        expect.objectContaining({
          id: 'student-1',
          mediaConsentStatus: 'ALLOWED',
          mediaConsentGranted: true,
        }),
        expect.objectContaining({
          id: 'student-2',
          mediaConsentStatus: 'NOT_ALLOWED',
          mediaConsentGranted: false,
        }),
      ],
    });

    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          classId: 'class-1',
          sectionId: 'section-1',
          lifecycleStatus: StudentLifecycleStatus.ACTIVE,
          id: { in: ['student-1', 'student-2'] },
        }),
      }),
    );
  });

  it('blocks teachers who are not assigned to the selected class or section', async () => {
    prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });
    prisma.section.findFirst.mockResolvedValue({
      id: 'section-1',
      classId: 'class-1',
    });
    prisma.staff.findFirst.mockResolvedValue(null);

    await expect(
      service.createPost(
        {
          classId: 'class-1',
          sectionId: 'section-1',
          title: 'Science day',
          caption: 'Students built plant life-cycle charts.',
          category: ActivityCategory.LEARNING,
          studentIds: [],
          attachments: [
            {
              fileName: 'photo.jpg',
              contentType: 'image/jpeg',
              base64Content: Buffer.from([0xff, 0xd8, 0xff, 0xdb]).toString(
                'base64',
              ),
            },
          ],
        },
        actor,
      ),
    ).rejects.toThrow('Teacher is not assigned to this class/section');
  });

  it('rejects inactive tagged students before storing activity media', async () => {
    prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });
    prisma.section.findFirst.mockResolvedValue({
      id: 'section-1',
      classId: 'class-1',
    });
    prisma.staff.findFirst.mockResolvedValue({ id: 'staff-1' });
    prisma.student.findMany.mockResolvedValue([]);

    await expect(
      service.createPost(
        {
          classId: 'class-1',
          sectionId: 'section-1',
          title: 'Science day',
          caption: 'Archived students should not receive new activity media.',
          category: ActivityCategory.LEARNING,
          studentIds: ['student-archived'],
          attachments: [
            {
              fileName: 'photo.jpg',
              contentType: 'image/jpeg',
              base64Content: Buffer.from([0xff, 0xd8, 0xff, 0xdb]).toString(
                'base64',
              ),
            },
          ],
        },
        actor,
      ),
    ).rejects.toThrow(
      'One or more tagged students were not active in this class/section',
    );

    expect(prisma.student.findMany).toHaveBeenCalledWith({
      select: {
        guardianLinks: {
          include: {
            guardian: {
              include: {
                consents: {
                  orderBy: { capturedAt: 'desc' },
                  take: 1,
                  where: { consentType: ConsentType.PHOTO_USAGE },
                },
              },
            },
          },
        },
        id: true,
        firstNameEn: true,
        lastNameEn: true,
      },
      where: {
        tenantId: 'tenant-1',
        classId: 'class-1',
        sectionId: 'section-1',
        lifecycleStatus: StudentLifecycleStatus.ACTIVE,
        id: { in: ['student-archived'] },
      },
    });
    expect(storageService.saveBase64Object).not.toHaveBeenCalled();
    expect(fileRegistry.registerFile).not.toHaveBeenCalled();
    expect(prisma.activityPost.create).not.toHaveBeenCalled();
    expect(mediaQueue.add).not.toHaveBeenCalled();
    expect(communicationsService.recordDeliveryRecords).not.toHaveBeenCalled();
  });

  it('rejects non-image activity attachments before storage', async () => {
    prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });
    prisma.staff.findFirst.mockResolvedValue({ id: 'staff-1' });

    await expect(
      service.createPost(
        {
          classId: 'class-1',
          title: 'Worksheet',
          caption: 'A PDF should not be uploaded as an activity photo.',
          category: ActivityCategory.LEARNING,
          studentIds: [],
          attachments: [
            {
              fileName: 'worksheet.pdf',
              contentType: 'application/pdf',
              base64Content: 'aGVsbG8=',
            },
          ],
        },
        actor,
      ),
    ).rejects.toThrow('Only standard images are allowed');
    expect(storageService.saveBase64Object).not.toHaveBeenCalled();
  });

  it('scopes parent feed reads to own child tagged, section, and whole-class posts', async () => {
    const parentActor: AuthContext = {
      ...actor,
      userId: 'guardian-user-1',
      roles: ['parent'],
      permissions: ['activity_feed:read'],
    };
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [{ studentId: 'student-1' }],
    });
    prisma.student.findMany.mockResolvedValue([
      { id: 'student-1', classId: 'class-1', sectionId: 'section-1' },
    ]);
    prisma.activityPost.findMany.mockResolvedValue([]);

    await service.listPosts(parentActor);

    expect(prisma.activityPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          OR: [
            { studentTags: { some: { studentId: { in: ['student-1'] } } } },
            {
              studentTags: { none: {} },
              classId: 'class-1',
              sectionId: null,
            },
            {
              studentTags: { none: {} },
              classId: 'class-1',
              sectionId: 'section-1',
            },
          ],
        }),
      }),
    );
  });

  it('blocks parent feed reads for another child', async () => {
    const parentActor: AuthContext = {
      ...actor,
      userId: 'guardian-user-1',
      roles: ['parent'],
      permissions: ['activity_feed:read'],
    };
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [{ studentId: 'student-1' }],
    });

    await expect(
      service.listPosts(parentActor, { studentId: 'student-2' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.activityPost.findMany).not.toHaveBeenCalled();
  });

  it('stores milestone photo references as private object metadata', async () => {
    prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });
    prisma.section.findFirst.mockResolvedValue({
      id: 'section-1',
      classId: 'class-1',
    });
    prisma.student.findFirst.mockResolvedValue({
      id: 'student-1',
      classId: 'class-1',
      sectionId: 'section-1',
    });
    prisma.staff.findFirst.mockResolvedValue({ id: 'staff-1' });
    prisma.developmentalMilestone.create.mockImplementation(
      async ({ data }: any) => ({
        id: 'milestone-1',
        ...data,
        createdAt: new Date('2026-04-28T00:00:01.000Z'),
      }),
    );

    const result = await service.createMilestone(
      {
        classId: 'class-1',
        sectionId: 'section-1',
        studentId: 'student-1',
        domain: 'Motor skills',
        milestone: 'Uses classroom materials independently',
        status: DevelopmentalMilestoneStatus.PROGRESSING,
        observationNote: 'Needs occasional prompting.',
        photoUrl: '/storage/public/photo.jpg',
        observedAt: '2026-04-28T00:00:00.000Z',
      },
      actor,
    );

    expect(result.photoObjectKey).toBe('/storage/public/photo.jpg');
    expect(result.photoUrl).toBeNull();
    expect(result.replayed).toBe(false);
    expect(result.serverReceivedAt).toBe('2026-04-28T00:00:01.000Z');
    expect(prisma.student.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          lifecycleStatus: StudentLifecycleStatus.ACTIVE,
          enrollments: {
            some: expect.objectContaining({
              status: EnrollmentStatus.ACTIVE,
              academicYear: { isCurrent: true },
            }),
          },
        }),
      }),
    );
    expect(prisma.staff.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: StaffStatus.ACTIVE,
          teacherAssignments: {
            some: expect.objectContaining({
              academicYear: { isCurrent: true },
            }),
          },
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'create',
        resource: 'developmental_milestone',
      }),
    );
  });

  it('replays a duplicate milestone submission using clientSubmissionId without creating a second record', async () => {
    prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });
    prisma.section.findFirst.mockResolvedValue({
      id: 'section-1',
      classId: 'class-1',
    });
    prisma.student.findFirst.mockResolvedValue({
      id: 'student-1',
      classId: 'class-1',
      sectionId: 'section-1',
    });
    prisma.staff.findFirst.mockResolvedValue({ id: 'staff-1' });
    prisma.developmentalMilestone.findFirst.mockResolvedValue({
      id: 'milestone-existing',
      clientSubmissionId: '6731ea4f-5c37-4b16-bb72-955abbadc31b',
      classId: 'class-1',
      sectionId: 'section-1',
      studentId: 'student-1',
      domain: 'Motor skills',
      milestone: 'Uses classroom materials independently',
      status: DevelopmentalMilestoneStatus.PROGRESSING,
      observationNote: null,
      photoObjectKey: null,
      observedAt: new Date('2026-04-28T00:00:00.000Z'),
      createdAt: new Date('2026-04-28T00:00:01.000Z'),
    });

    const result = await service.createMilestone(
      {
        clientSubmissionId: '6731ea4f-5c37-4b16-bb72-955abbadc31b',
        classId: 'class-1',
        sectionId: 'section-1',
        studentId: 'student-1',
        domain: 'Motor skills',
        milestone: 'Uses classroom materials independently',
        status: DevelopmentalMilestoneStatus.PROGRESSING,
        observedAt: '2026-04-28T00:00:00.000Z',
      },
      actor,
    );

    expect(result).toEqual(
      expect.objectContaining({ id: 'milestone-existing', replayed: true }),
    );
    expect(prisma.developmentalMilestone.create).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('rejects a milestone replay key reused with different content', async () => {
    prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });
    prisma.section.findFirst.mockResolvedValue({
      id: 'section-1',
      classId: 'class-1',
    });
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    prisma.staff.findFirst.mockResolvedValue({ id: 'staff-1' });
    prisma.developmentalMilestone.findFirst.mockResolvedValue({
      id: 'milestone-existing',
      clientSubmissionId: '6731ea4f-5c37-4b16-bb72-955abbadc31b',
      classId: 'class-1',
      sectionId: 'section-1',
      studentId: 'student-1',
      domain: 'Motor skills',
      milestone: 'Uses classroom materials independently',
      status: DevelopmentalMilestoneStatus.PROGRESSING,
      observationNote: null,
      photoObjectKey: null,
      observedAt: new Date('2026-04-28T00:00:00.000Z'),
      createdAt: new Date('2026-04-28T00:00:01.000Z'),
    });

    await expect(
      service.createMilestone(
        {
          clientSubmissionId: '6731ea4f-5c37-4b16-bb72-955abbadc31b',
          classId: 'class-1',
          sectionId: 'section-1',
          studentId: 'student-1',
          domain: 'Motor skills',
          milestone: 'Changed milestone content',
          status: DevelopmentalMilestoneStatus.PROGRESSING,
          observedAt: '2026-04-28T00:00:00.000Z',
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.developmentalMilestone.create).not.toHaveBeenCalled();
  });

  it('resolves a concurrent idempotent milestone create race to the existing record', async () => {
    prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });
    prisma.section.findFirst.mockResolvedValue({
      id: 'section-1',
      classId: 'class-1',
    });
    prisma.student.findFirst.mockResolvedValue({
      id: 'student-1',
      classId: 'class-1',
      sectionId: 'section-1',
    });
    prisma.staff.findFirst.mockResolvedValue({ id: 'staff-1' });
    prisma.developmentalMilestone.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'milestone-existing',
        clientSubmissionId: '6731ea4f-5c37-4b16-bb72-955abbadc31b',
        classId: 'class-1',
        sectionId: 'section-1',
        studentId: 'student-1',
        domain: 'Motor skills',
        milestone: 'Uses classroom materials independently',
        status: DevelopmentalMilestoneStatus.PROGRESSING,
        observationNote: null,
        photoObjectKey: null,
        observedAt: new Date('2026-04-28T00:00:00.000Z'),
        createdAt: new Date('2026-04-28T00:00:01.000Z'),
      });
    prisma.developmentalMilestone.create.mockRejectedValue({ code: 'P2002' });

    await expect(
      service.createMilestone(
        {
          clientSubmissionId: '6731ea4f-5c37-4b16-bb72-955abbadc31b',
          classId: 'class-1',
          sectionId: 'section-1',
          studentId: 'student-1',
          domain: 'Motor skills',
          milestone: 'Uses classroom materials independently',
          status: DevelopmentalMilestoneStatus.PROGRESSING,
          observedAt: '2026-04-28T00:00:00.000Z',
        },
        actor,
      ),
    ).resolves.toEqual(expect.objectContaining({ id: 'milestone-existing' }));
  });

  it('cleans up storage objects and database records if post creation fails', async () => {
    prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });
    prisma.staff.findFirst.mockResolvedValue({ id: 'staff-1' });
    prisma.student.findMany.mockResolvedValue([
      {
        id: 'student-1',
        guardianLinks: [
          {
            guardian: {
              consents: [{ granted: true, revokedAt: null }],
            },
          },
        ],
      },
    ]);
    storageService.saveBase64Object.mockResolvedValue({
      provider: StorageProvider.LOCAL,
      objectKey: 'tenant-1/activity-feed/class-1/photo.jpg',
      sizeBytes: 42,
    });
    fileRegistry.registerFile.mockResolvedValue({ id: 'file-asset-1' });

    prisma.activityPost.create.mockRejectedValue(
      new Error('DB connection lost'),
    );
    await expect(
      service.createPost(
        {
          classId: 'class-1',
          title: 'Science day',
          caption: 'Students built plant life-cycle charts.',
          category: ActivityCategory.LEARNING,
          studentIds: ['student-1'],
          attachments: [
            {
              fileName: 'photo.jpg',
              contentType: 'image/jpeg',
              base64Content: Buffer.from([0xff, 0xd8, 0xff, 0xdb]).toString(
                'base64',
              ),
            },
          ],
        },
        actor,
      ),
    ).rejects.toThrow('DB connection lost');

    expect(storageService.deleteObject).toHaveBeenCalledWith(
      'tenant-1/activity-feed/class-1/photo.jpg',
    );
    expect(prisma.fileAsset.delete).toHaveBeenCalledWith({
      where: { id: 'file-asset-1' },
    });
  });

  it('deletes the created post if downstream activity-post setup fails', async () => {
    prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });
    prisma.staff.findFirst.mockResolvedValue({ id: 'staff-1' });
    prisma.student.findMany.mockResolvedValue([
      {
        id: 'student-1',
        guardianLinks: [
          {
            guardian: {
              consents: [{ granted: true, revokedAt: null }],
            },
          },
        ],
      },
    ]);
    storageService.saveBase64Object.mockResolvedValue({
      provider: StorageProvider.LOCAL,
      objectKey: 'tenant-1/activity-feed/class-1/photo.jpg',
      sizeBytes: 42,
    });
    fileRegistry.registerFile.mockResolvedValue({ id: 'file-asset-1' });
    prisma.activityPost.create.mockResolvedValue({
      id: 'post-1',
      classId: 'class-1',
      sectionId: null,
      title: 'Science day',
      caption: 'Students built plant life-cycle charts.',
      audienceType: AudienceType.CLASS,
      attachments: [
        {
          id: 'attachment-1',
          fileAssetId: 'file-asset-1',
        },
      ],
      studentTags: [],
    });
    mediaQueue.add.mockRejectedValue(new Error('queue unavailable'));

    await expect(
      service.createPost(
        {
          classId: 'class-1',
          title: 'Science day',
          caption: 'Students built plant life-cycle charts.',
          category: ActivityCategory.LEARNING,
          studentIds: ['student-1'],
          attachments: [
            {
              fileName: 'photo.jpg',
              contentType: 'image/jpeg',
              base64Content: Buffer.from([0xff, 0xd8, 0xff, 0xdb]).toString(
                'base64',
              ),
            },
          ],
        },
        actor,
      ),
    ).rejects.toThrow('queue unavailable');

    expect(prisma.activityPost.deleteMany).toHaveBeenCalledWith({
      where: { id: 'post-1', tenantId: 'tenant-1' },
    });
    expect(storageService.deleteObject).toHaveBeenCalledWith(
      'tenant-1/activity-feed/class-1/photo.jpg',
    );
    expect(prisma.fileAsset.delete).toHaveBeenCalledWith({
      where: { id: 'file-asset-1' },
    });
  });

  it('blocks media preview for parent actor if tagged student is inactive or lacks photo consent', async () => {
    const parentActor: AuthContext = {
      ...actor,
      userId: 'guardian-user-1',
      roles: ['parent'],
      permissions: ['activity_feed:read'],
    };

    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [{ studentId: 'student-1' }],
    });
    prisma.guardianConsent.findFirst.mockResolvedValue({
      granted: true,
      revokedAt: null,
    });

    prisma.activityPost.findMany.mockResolvedValue([
      {
        id: 'post-1',
        classId: 'class-1',
        studentTags: [{ studentId: 'student-1' }],
        attachments: [
          {
            id: 'attachment-1',
            fileName: 'photo.jpg',
            contentType: 'image/jpeg',
            fileAssetId: 'file-asset-1',
          },
        ],
      },
    ]);

    // Tagged student is ARCHIVED
    prisma.student.findMany.mockResolvedValue([
      {
        id: 'student-1',
        lifecycleStatus: 'ARCHIVED',
        guardianLinks: [],
      },
    ]);

    let results = await service.listPosts(parentActor);
    expect(results[0].attachments[0].previewUrl).toBeNull();
    expect(results[0].attachments[0].accessBlockedReason).toBe(
      'PHOTO_USAGE_CONSENT_REQUIRED',
    );

    // Tagged student is active but lacks photo consent
    prisma.student.findMany.mockResolvedValue([
      {
        id: 'student-1',
        lifecycleStatus: 'ACTIVE',
        guardianLinks: [
          {
            guardian: {
              id: 'guardian-other',
              consents: [
                {
                  consentType: 'PHOTO_USAGE',
                  granted: false,
                  revokedAt: null,
                },
              ],
            },
          },
        ],
      },
    ]);

    results = await service.listPosts(parentActor);
    expect(results[0].attachments[0].previewUrl).toBeNull();
    expect(results[0].attachments[0].accessBlockedReason).toBe(
      'PHOTO_USAGE_CONSENT_REQUIRED',
    );
  });

  it('fails closed for parent feed visibility after guardian links are removed', async () => {
    const parentActor: AuthContext = {
      ...actor,
      userId: 'guardian-user-removed',
      roles: ['parent'],
      permissions: ['activity_feed:read'],
    };

    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-removed',
      studentLinks: [],
    });
    prisma.activityPost.findMany.mockResolvedValue([]);

    const results = await service.listPosts(parentActor);

    expect(results).toEqual([]);
    expect(prisma.activityPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: actor.tenantId,
          id: '__no_visible_activity_posts__',
        }),
      }),
    );
  });

  it('returns the existing guardian SEEN acknowledgement on idempotent replay', async () => {
    const parentActor: AuthContext = {
      ...actor,
      userId: 'guardian-user-1',
      roles: ['parent'],
      permissions: ['activity_feed:read'],
    };
    const existing = {
      id: 'reaction-seen-1',
      tenantId: actor.tenantId,
      activityPostId: 'post-1',
      guardianId: 'guardian-1',
      studentId: null,
      reaction: ActivityReactionType.SEEN,
      createdAt: new Date('2026-07-01T06:30:00.000Z'),
    };

    prisma.activityPost.findFirst
      .mockResolvedValueOnce({
        id: 'post-1',
        tenantId: actor.tenantId,
        status: ActivityPostStatus.APPROVED,
        softDeletedAt: null,
      })
      .mockResolvedValueOnce({ id: 'post-1' });
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      userId: parentActor.userId,
      studentLinks: [{ studentId: 'student-1' }],
    });
    prisma.student.findMany.mockResolvedValue([
      {
        id: 'student-1',
        classId: 'class-1',
        sectionId: 'section-1',
      },
    ]);
    prisma.activityReaction.findFirst.mockResolvedValue(existing);

    await expect(
      service.createReaction(
        'post-1',
        {
          guardianId: 'guardian-1',
          reaction: ActivityReactionType.SEEN,
        },
        parentActor,
      ),
    ).resolves.toBe(existing);

    expect(prisma.activityReaction.create).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it.each([
    ActivityPostStatus.DRAFT,
    ActivityPostStatus.PENDING_APPROVAL,
    ActivityPostStatus.ARCHIVED,
  ])('blocks parent SEEN acknowledgement for %s posts', async (status) => {
    const parentActor: AuthContext = {
      ...actor,
      userId: 'guardian-user-1',
      roles: ['parent'],
      permissions: ['activity_feed:read'],
    };
    prisma.activityPost.findFirst.mockResolvedValue({
      id: 'post-1',
      tenantId: actor.tenantId,
      status,
      softDeletedAt: status === ActivityPostStatus.ARCHIVED ? new Date() : null,
    });

    await expect(
      service.createReaction(
        'post-1',
        {
          guardianId: 'guardian-1',
          reaction: ActivityReactionType.SEEN,
        },
        parentActor,
      ),
    ).rejects.toThrow('Activity post is no longer available');

    expect(prisma.activityReaction.create).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: 'archived',
      status: ActivityPostStatus.ARCHIVED,
      softDeletedAt: null,
    },
    {
      label: 'rejected',
      status: ActivityPostStatus.REJECTED,
      softDeletedAt: null,
    },
    {
      label: 'soft-deleted',
      status: ActivityPostStatus.REJECTED,
      softDeletedAt: new Date('2026-05-06T10:00:00.000Z'),
    },
  ])(
    'blocks direct signed media previews for $label activity posts',
    async ({ status, softDeletedAt }) => {
      prisma.activityAttachment = {
        findFirst: jest.fn().mockResolvedValue({
          id: 'attachment-1',
          tenantId: 'tenant-1',
          activityPostId: 'post-1',
          fileAssetId: 'file-asset-1',
          activityPost: {
            id: 'post-1',
            status,
            softDeletedAt,
          },
        }),
      };

      await expect(
        service.getAttachmentPreview(actor, 'attachment-1'),
      ).rejects.toThrow('Activity post is no longer available');

      expect(fileRegistry.auditAccess).not.toHaveBeenCalled();
      expect(fileRegistry.getSignedUrl).not.toHaveBeenCalled();
    },
  );
});
