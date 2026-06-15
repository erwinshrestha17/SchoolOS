import { INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthMethod, StorageProvider } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import type { AuthContext } from '../src/auth/auth.types';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { NotificationsProcessor } from '../src/notifications/notifications.processor';
import { ActivityMediaProcessor } from '../src/activity-feed/processors/activity-media.processor';
import { FinanceProcessor } from '../src/finance/finance.processor';
import { PayrollProcessor } from '../src/payroll/payroll.processor';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { StorageService } from '../src/storage/storage.service';
import {
  createPrismaMock,
  createQueueMock,
  ensureTenantDefaultsWithState,
  type PrismaMock,
} from './test-helpers';

const tenantAId = 'tenant-m1-http-a';
const tenantBId = 'tenant-m1-http-b';

const actorA = buildActor(tenantAId, 'registrar-a');
const actorB = buildActor(tenantBId, 'registrar-b');

describe('M1 Admissions HTTP ownership hardening (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();
    seedTenant(prisma, tenantAId);
    seedTenant(prisma, tenantBId);
    seedM1Data(prisma);
    overrideGeneratedDocumentReads(prisma);
    overrideStudentGuardianReads(prisma);
    overrideAdmissionDraftReads(prisma);
    overrideImportReviewReads(prisma);
    overrideFileAssetCount(prisma);
    overrideAdmissionConversionWrites(prisma);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(RedisService)
      .useValue({
        ping: jest.fn(() => Promise.resolve('PONG')),
        onModuleDestroy: jest.fn(() => Promise.resolve(undefined)),
      })
      .overrideProvider(StorageService)
      .useValue({
        saveBufferObject: jest.fn(
          async (input: {
            tenantId: string;
            prefix: string;
            fileName: string;
            content: Buffer;
          }) => ({
            provider: StorageProvider.LOCAL,
            bucket: null,
            objectKey: `${input.tenantId}/${input.prefix}/${input.fileName}`,
            sizeBytes: input.content.byteLength,
            checksumSha256: 'test-generated-document-checksum',
            publicUrl: null,
          }),
        ),
        checkReadiness: jest.fn(async () => true),
      })
      .overrideProvider(getQueueToken('finance'))
      .useValue(createQueueMock())
      .overrideProvider(getQueueToken('notifications'))
      .useValue(createQueueMock())
      .overrideProvider(getQueueToken('payroll'))
      .useValue(createQueueMock())
      .overrideProvider(getQueueToken('activity-media'))
      .useValue(createQueueMock())
      .overrideProvider(FinanceProcessor)
      .useValue({ process: jest.fn() })
      .overrideProvider(NotificationsProcessor)
      .useValue({ process: jest.fn() })
      .overrideProvider(ActivityMediaProcessor)
      .useValue({ process: jest.fn() })
      .overrideProvider(PayrollProcessor)
      .useValue({ process: jest.fn() })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => {
            getRequest: () => {
              headers: Record<string, string>;
              auth?: AuthContext;
            };
          };
        }) => {
          const req = context.switchToHttp().getRequest();
          req.auth =
            req.headers['x-test-tenant'] === tenantBId ? actorB : actorA;
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('returns tenant-owned ownership audit data over HTTP without leaking QR token hashes', async () => {
    const response = await request(app.getHttpServer())
      .get('/admissions/m1/students/student-a/ownership-audit')
      .set('x-test-tenant', tenantAId)
      .expect(200);

    expect(response.body.student.id).toBe('student-a');
    expect(response.body.documents).toHaveLength(1);
    expect(response.body.generatedDocuments).toHaveLength(1);
    expect(response.body.registryFiles).toHaveLength(1);
    expect(response.body.qrAnalytics).toHaveLength(1);
    expect(JSON.stringify(response.body)).not.toContain('secret-token-hash');
    expect(response.body.policy).toEqual(
      expect.objectContaining({
        tenantScoped: true,
        generatedDocumentsRequireTenantAndStudentMatch: true,
        qrAnalyticsNeverReturnsTokenHash: true,
      }),
    );
  });

  it('denies cross-tenant ownership audit over HTTP', async () => {
    const response = await request(app.getHttpServer())
      .get('/admissions/m1/students/student-a/ownership-audit')
      .set('x-test-tenant', tenantBId)
      .expect(404);

    expect(response.body.message).toBe('Student not found in this tenant');
    expect(JSON.stringify(response.body)).not.toContain('tenant-m1-http-a');
    expect(JSON.stringify(response.body)).not.toContain('secret-token-hash');
  });

  it('removes guardian access for same-tenant links and writes document review history over HTTP', async () => {
    const response = await request(app.getHttpServer())
      .delete('/admissions/m1/students/student-a/guardians/guardian-a')
      .set('x-test-tenant', tenantAId)
      .set('authorization', 'Bearer test-token')
      .send({
        confirmFileAccessReview: true,
        reason: 'Guardian changed after admission review',
      })
      .expect(200);

    expect(response.body.removed).toBe(true);
    expect(response.body.accessReview).toEqual(
      expect.objectContaining({
        canAccessStudentFiles: false,
        documentsReviewed: 1,
        generatedDocumentsReviewed: 1,
        registryFilesReviewed: 1,
      }),
    );
    expect(
      prisma.__state.studentGuardians.some((link) => link.id === 'link-a'),
    ).toBe(false);
    expect(prisma.__state.studentDocumentHistory).toContainEqual(
      expect.objectContaining({
        tenantId: tenantAId,
        documentId: 'doc-a',
        action: 'GUARDIAN_ACCESS_REVIEW',
      }),
    );
  });

  it('denies cross-tenant guardian removal over HTTP without mutating tenant-owned links', async () => {
    await request(app.getHttpServer())
      .delete('/admissions/m1/students/student-a/guardians/guardian-a')
      .set('x-test-tenant', tenantBId)
      .set('authorization', 'Bearer test-token')
      .send({
        confirmFileAccessReview: true,
        reason: 'Cross-tenant attempt',
      })
      .expect(404);

    expect(prisma.__state.studentGuardians).toContainEqual(
      expect.objectContaining({
        id: 'link-a',
        tenantId: tenantAId,
        studentId: 'student-a',
        guardianId: 'guardian-a',
      }),
    );
    expect(prisma.__state.studentDocumentHistory).toHaveLength(0);
  });

  it('autosaves and recovers admission drafts only inside the actor tenant over HTTP', async () => {
    const autosaveResponse = await request(app.getHttpServer())
      .post('/admissions/m1/drafts/autosave')
      .set('x-test-tenant', tenantAId)
      .set('authorization', 'Bearer test-token')
      .send({
        draftKey: 'front-desk-1',
        firstNameEn: 'Asha',
        lastNameEn: 'Tamang',
        firstNameNp: 'आशा',
        lastNameNp: 'तामाङ',
        dateOfBirth: '2020-01-02',
        guardianFullName: 'Maya Tamang',
        guardianPhone: '9800000000',
        classId: 'class-a',
        sectionId: 'section-a',
        previousSchool: 'Little Flower',
        payload: { intendedSection: 'A' },
      })
      .expect(201);

    expect(autosaveResponse.body).toEqual(
      expect.objectContaining({
        draftKey: 'front-desk-1',
        fullNameEn: 'Asha Tamang',
        guardianPhone: '9800000000',
      }),
    );
    expect(prisma.__state.admissionApplications).toContainEqual(
      expect.objectContaining({
        id: autosaveResponse.body.id,
        tenantId: tenantAId,
        source: 'autosave:front-desk-1',
      }),
    );

    const recoveryResponse = await request(app.getHttpServer())
      .get('/admissions/m1/drafts/recover')
      .set('x-test-tenant', tenantAId)
      .query({ draftKey: 'front-desk-1' })
      .expect(200);

    expect(recoveryResponse.body.total).toBe(1);
    expect(recoveryResponse.body.items[0]).toEqual(
      expect.objectContaining({
        id: autosaveResponse.body.id,
        draftKey: 'front-desk-1',
      }),
    );

    const crossTenantRecovery = await request(app.getHttpServer())
      .get('/admissions/m1/drafts/recover')
      .set('x-test-tenant', tenantBId)
      .query({ draftKey: 'front-desk-1' })
      .expect(200);

    expect(crossTenantRecovery.body.items).toEqual([]);
    expect(JSON.stringify(crossTenantRecovery.body)).not.toContain(tenantAId);
  });

  it('returns import-review rows only for the actor tenant over HTTP', async () => {
    const tenantAResponse = await request(app.getHttpServer())
      .get('/admissions/m1/import-review/queue')
      .set('x-test-tenant', tenantAId)
      .query({ limit: 10 })
      .expect(200);

    expect(tenantAResponse.body.total).toBe(1);
    expect(tenantAResponse.body.items[0]).toEqual(
      expect.objectContaining({
        id: 'import-row-a',
        batchId: 'import-batch-a',
        sourceFileName: 'tenant-a-import.csv',
        workflowLabel: 'Needs review',
      }),
    );
    expect(JSON.stringify(tenantAResponse.body)).not.toContain(
      'tenant-b-import.csv',
    );

    const tenantBResponse = await request(app.getHttpServer())
      .get('/admissions/m1/import-review/queue')
      .set('x-test-tenant', tenantBId)
      .query({ limit: 10 })
      .expect(200);

    expect(tenantBResponse.body.items).toEqual([
      expect.objectContaining({
        id: 'import-row-b',
        sourceFileName: 'tenant-b-import.csv',
      }),
    ]);
    expect(JSON.stringify(tenantBResponse.body)).not.toContain(
      'tenant-a-import.csv',
    );
  });

  it('returns import batch history detail only for the actor tenant over HTTP', async () => {
    const tenantAResponse = await request(app.getHttpServer())
      .get('/admissions/bulk-import/batches/import-batch-a')
      .set('x-test-tenant', tenantAId)
      .expect(200);

    expect(tenantAResponse.body).toEqual(
      expect.objectContaining({
        id: 'import-batch-a',
        sourceFileName: 'tenant-a-import.csv',
        totalRows: 1,
        failed: 0,
      }),
    );
    expect(tenantAResponse.body.rows).toEqual([
      expect.objectContaining({
        rowNumber: 2,
        status: 'duplicate_review',
      }),
    ]);
    expect(JSON.stringify(tenantAResponse.body)).not.toContain(
      'tenant-b-import.csv',
    );

    await request(app.getHttpServer())
      .get('/admissions/bulk-import/batches/import-batch-a')
      .set('x-test-tenant', tenantBId)
      .expect(404);
  });

  it('hardens admission application status mutations over HTTP', async () => {
    const directEnroll = await request(app.getHttpServer())
      .post('/admissions/applications/application-a/status')
      .set('x-test-tenant', tenantAId)
      .set('authorization', 'Bearer test-token')
      .send({ status: 'ENROLLED' })
      .expect(400);

    expect(directEnroll.body.message).toBe(
      'Use the application enrollment endpoint so a tenant-owned student record is created and linked.',
    );
    expect(
      prisma.__state.admissionApplications.find(
        (application) => application.id === 'application-a',
      )?.status,
    ).toBe('ACCEPTED');

    await request(app.getHttpServer())
      .post('/admissions/applications/application-a/status')
      .set('x-test-tenant', tenantBId)
      .set('authorization', 'Bearer test-token')
      .send({ status: 'REJECTED', reason: 'Cross-tenant attempt' })
      .expect(404);

    expect(
      prisma.__state.admissionApplications.find(
        (application) => application.id === 'application-a',
      )?.status,
    ).toBe('ACCEPTED');

    const accepted = await request(app.getHttpServer())
      .post('/admissions/applications/application-a/status')
      .set('x-test-tenant', tenantAId)
      .set('authorization', 'Bearer test-token')
      .send({ status: 'REJECTED', reason: 'Family withdrew application' })
      .expect(201);

    expect(accepted.body).toEqual(
      expect.objectContaining({
        id: 'application-a',
        status: 'REJECTED',
        rejectedReason: 'Family withdrew application',
      }),
    );
  });

  it('converts an accepted application to a tenant-owned student over HTTP exactly once', async () => {
    const conversion = await request(app.getHttpServer())
      .post('/admissions/applications/application-a/enroll')
      .set('x-test-tenant', tenantAId)
      .set('authorization', 'Bearer test-token')
      .send(buildAdmissionConversionPayload())
      .expect(201);

    expect(conversion.body.application).toEqual(
      expect.objectContaining({
        id: 'application-a',
        status: 'ENROLLED',
      }),
    );
    expect(conversion.body.admission.student).toEqual(
      expect.objectContaining({
        studentSystemId: 'SCH-2083-0001',
        fullNameEn: 'Kiran Tamang',
      }),
    );
    expect(
      prisma.__state.admissionApplications.find(
        (application) => application.id === 'application-a',
      ),
    ).toEqual(
      expect.objectContaining({
        status: 'ENROLLED',
        convertedStudentId: conversion.body.admission.student.id,
      }),
    );
    expect(
      prisma.__state.students.find(
        (student) => student.id === conversion.body.admission.student.id,
      ),
    ).toEqual(
      expect.objectContaining({
        tenantId: tenantAId,
        studentSystemId: 'SCH-2083-0001',
      }),
    );

    await request(app.getHttpServer())
      .post('/admissions/applications/application-a/enroll')
      .set('x-test-tenant', tenantAId)
      .set('authorization', 'Bearer test-token')
      .send(buildAdmissionConversionPayload())
      .expect(409);

    await request(app.getHttpServer())
      .post('/admissions/applications/application-a/enroll')
      .set('x-test-tenant', tenantBId)
      .set('authorization', 'Bearer test-token')
      .send(buildAdmissionConversionPayload())
      .expect(404);
  });

  it('generates and retrieves student document PDFs over HTTP without cross-tenant access', async () => {
    const generated = await request(app.getHttpServer())
      .post('/admissions/m1/students/student-a/id-card')
      .set('x-test-tenant', tenantAId)
      .set('authorization', 'Bearer test-token')
      .expect(201);

    expect(generated.body).toEqual(
      expect.objectContaining({
        studentId: 'student-a',
        kind: 'ID_CARD',
        workflowLabel: 'Student ID card generated',
      }),
    );
    expect(prisma.__state.generatedStudentDocuments).toContainEqual(
      expect.objectContaining({
        tenantId: tenantAId,
        studentId: 'student-a',
        kind: 'id-card',
        storageObjectKey: expect.stringContaining(
          'tenant-m1-http-a/students/student-a/generated-documents/id-card',
        ),
      }),
    );
    expect(JSON.stringify(generated.body)).not.toContain('secret-token-hash');

    await request(app.getHttpServer())
      .get('/students/student-a/documents/ID_CARD.pdf')
      .set('x-test-tenant', tenantAId)
      .expect(200)
      .expect('content-type', /application\/pdf/);

    await request(app.getHttpServer())
      .get('/students/student-a/documents/ID_CARD.pdf')
      .set('x-test-tenant', tenantBId)
      .expect(404);
  });

  it('returns QR analytics over HTTP without token hash exposure or cross-tenant reads', async () => {
    const analytics = await request(app.getHttpServer())
      .get('/students/student-a/qr/analytics')
      .set('x-test-tenant', tenantAId)
      .expect(200);

    expect(analytics.body).toEqual(
      expect.objectContaining({
        studentId: 'student-a',
        credentialCount: 1,
        activeCredentialCount: 1,
        successfulScans: 1,
        failedScans: 1,
      }),
    );
    expect(analytics.body.scansByPurpose).toEqual([
      { purpose: 'ATTENDANCE', successfulScans: 1, failedScans: 1 },
    ]);
    expect(analytics.body.failuresByCode).toEqual([
      { failureCode: 'revoked', count: 1 },
    ]);
    expect(JSON.stringify(analytics.body)).not.toContain('secret-token-hash');

    await request(app.getHttpServer())
      .get('/students/student-a/qr/analytics')
      .set('x-test-tenant', tenantBId)
      .expect(404);
  });

  it('confirms removed guardians cannot reach the old student ownership surface', async () => {
    await request(app.getHttpServer())
      .delete('/admissions/m1/students/student-a/guardians/guardian-a')
      .set('x-test-tenant', tenantAId)
      .set('authorization', 'Bearer test-token')
      .send({
        confirmFileAccessReview: true,
        reason: 'Guardian access revoked before document handover',
      })
      .expect(200);

    const audit = await request(app.getHttpServer())
      .get('/admissions/m1/students/student-a/ownership-audit')
      .set('x-test-tenant', tenantAId)
      .expect(200);

    expect(audit.body.guardians).toEqual([]);
    expect(audit.body.policy).toEqual(
      expect.objectContaining({
        guardianFileAccessRequiresActiveStudentGuardianLink: true,
      }),
    );
  });
});

function buildActor(tenantId: string, userId: string): AuthContext {
  return {
    tenantId,
    tenantSlug: tenantId,
    userId,
    email: `${userId}@schoolos.test`,
    authMethod: AuthMethod.PASSWORD,
    roles: ['admin'],
    permissions: [
      'students:read',
      'students:create',
      'student_documents:manage',
      'enrollments:create',
      'enrollments:read',
      'guardians:create',
      'guardians:read',
      'guardians:update',
      'students:manage_lifecycle',
      'students:qr:read',
    ],
  };
}

function buildAdmissionConversionPayload() {
  return {
    studentSystemId: 'SCH-2083-0001',
    firstNameEn: 'Kiran',
    lastNameEn: 'Tamang',
    dateOfBirth: '2020-02-02',
    gender: 'MALE',
    admissionDate: '2026-04-06',
    academicYearId: 'ay-a',
    classId: 'class-a',
    sectionId: 'section-a',
    confirmNoDisability: true,
    confirmDuplicate: true,
    guardians: [
      {
        fullName: 'Sita Tamang',
        relation: 'mother',
        primaryPhone: '9822222222',
        isPrimary: true,
      },
    ],
  };
}

function seedTenant(prisma: PrismaMock, tenantId: string) {
  ensureTenantDefaultsWithState(prisma.__state, tenantId);
  const planId = `plan-${tenantId}`;
  prisma.__state.platformPlans.push({
    id: planId,
    key: 'standard',
    name: 'Standard',
  });
  prisma.__state.platformPlanFeatures.push({
    id: `feature-students-${tenantId}`,
    planId,
    featureKey: 'module.students',
    enabled: true,
  });
  prisma.__state.tenantSubscriptions.push({
    id: `sub-${tenantId}`,
    tenantId,
    planId,
    status: 'ACTIVE',
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
  });
}

function seedM1Data(prisma: PrismaMock) {
  prisma.__state.classes.push({
    id: 'class-a',
    tenantId: tenantAId,
    name: 'Class 1',
    level: 1,
  });
  prisma.__state.sections.push({
    id: 'section-a',
    tenantId: tenantAId,
    classId: 'class-a',
    name: 'A',
  });
  prisma.__state.academicYears.push({
    id: 'ay-a',
    tenantId: tenantAId,
    name: '2083',
    startsOn: new Date('2026-04-14T00:00:00.000Z'),
    endsOn: new Date('2027-04-13T00:00:00.000Z'),
    isActive: true,
  });
  prisma.__state.students = [
    {
      id: 'student-a',
      tenantId: tenantAId,
      tenant: {
        id: tenantAId,
        slug: tenantAId,
        name: 'Tenant A School',
      },
      studentSystemId: 'ST-A',
      firstNameEn: 'Asha',
      lastNameEn: 'Tamang',
      firstNameNp: 'आशा',
      lastNameNp: 'तामाङ',
      dateOfBirth: new Date('2020-01-02T00:00:00.000Z'),
      gender: 'FEMALE',
      admissionDate: new Date('2026-04-01T00:00:00.000Z'),
      classId: 'class-a',
      sectionId: 'section-a',
      lifecycleStatus: 'ACTIVE',
      class: { id: 'class-a', name: 'Class 1' },
      sectionRef: { id: 'section-a', name: 'A' },
      enrollments: [
        {
          id: 'enrollment-a',
          tenantId: tenantAId,
          studentId: 'student-a',
          academicYearId: 'ay-a',
          classId: 'class-a',
          sectionId: 'section-a',
          status: 'ACTIVE',
          academicYear: { id: 'ay-a', name: '2083' },
          section: { id: 'section-a', name: 'A' },
          createdAt: new Date('2026-04-01T00:00:00.000Z'),
        },
      ],
    },
  ];
  prisma.__state.enrollments.push({
    id: 'enrollment-a',
    tenantId: tenantAId,
    studentId: 'student-a',
    academicYearId: 'ay-a',
    classId: 'class-a',
    sectionId: 'section-a',
    status: 'ACTIVE',
    academicYear: { id: 'ay-a', name: '2083' },
    section: { id: 'section-a', name: 'A' },
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
  });
  prisma.__state.guardians.push({
    id: 'guardian-a',
    tenantId: tenantAId,
    fullName: 'Maya Tamang',
    relation: 'mother',
    primaryPhone: '9800000000',
  });
  prisma.__state.studentGuardians.push({
    id: 'link-a',
    tenantId: tenantAId,
    studentId: 'student-a',
    guardianId: 'guardian-a',
    relation: 'mother',
    isPrimary: true,
  });
  prisma.__state.studentDocuments.push({
    id: 'doc-a',
    tenantId: tenantAId,
    studentId: 'student-a',
    fileId: 'file-a',
    kind: 'BIRTH_CERTIFICATE',
    status: 'ACTIVE',
    title: 'Birth certificate',
    fileName: 'birth.pdf',
    contentType: 'application/pdf',
    sizeBytes: 1024,
    objectKey: 'tenant-a/students/student-a/birth.pdf',
    uploadedById: 'registrar-a',
  });
  prisma.__state.fileAssets.push({
    id: 'file-a',
    tenantId: tenantAId,
    module: 'students',
    entityId: 'student-a',
    originalFilename: 'birth.pdf',
    objectKey: 'tenant-a/students/student-a/birth.pdf',
    ownerType: 'student',
    ownerId: 'student-a',
    visibility: 'PRIVATE',
    status: 'UPLOADED',
    deletedAt: null,
    softDeletedAt: null,
    sizeBytes: 1024,
  });
  prisma.__state.generatedStudentDocuments.push({
    id: 'generated-a',
    tenantId: tenantAId,
    studentId: 'student-a',
    kind: 'ID_CARD',
    title: 'Student Identity Card',
    fileName: 'id-card.pdf',
    contentType: 'application/pdf',
    sizeBytes: 2048,
    pdfUrl: '/files/generated-a',
    storageObjectKey: 'tenant-a/students/student-a/id-card.pdf',
    generatedAt: new Date('2026-04-02T00:00:00.000Z'),
    revokedAt: null,
  });
  prisma.__state.studentQrCredentials.push({
    id: 'qr-a',
    tenantId: tenantAId,
    studentId: 'student-a',
    tokenHash: 'secret-token-hash',
    status: 'ACTIVE',
    lastScannedAt: new Date('2026-04-03T00:00:00.000Z'),
    expiresAt: new Date('2026-05-01T00:00:00.000Z'),
    revokedAt: null,
    rotatedAt: null,
    createdAt: new Date('2026-04-02T00:00:00.000Z'),
  });
  prisma.__state.auditLogs.push(
    {
      id: 'audit-qr-success-a',
      tenantId: tenantAId,
      action: 'QR_RESOLVED',
      resource: 'student_qr',
      resourceId: 'qr-a',
      after: { purpose: 'ATTENDANCE' },
      createdAt: new Date('2026-04-03T08:00:00.000Z'),
    },
    {
      id: 'audit-qr-failure-a',
      tenantId: tenantAId,
      action: 'QR_RESOLVE_FAILED',
      resource: 'student_qr',
      resourceId: 'qr-a',
      after: { purpose: 'ATTENDANCE', failureCode: 'revoked' },
      createdAt: new Date('2026-04-03T09:00:00.000Z'),
    },
    {
      id: 'audit-qr-tenant-b',
      tenantId: tenantBId,
      action: 'QR_RESOLVED',
      resource: 'student_qr',
      resourceId: 'qr-b',
      after: { purpose: 'ATTENDANCE' },
      createdAt: new Date('2026-04-03T10:00:00.000Z'),
    },
  );
  prisma.__state.admissionApplications = [
    {
      id: 'application-a',
      tenantId: tenantAId,
      status: 'ACCEPTED',
      firstNameEn: 'Asha',
      lastNameEn: 'Tamang',
      firstNameNp: null,
      lastNameNp: null,
      dateOfBirth: new Date('2020-01-02T00:00:00.000Z'),
      gender: 'FEMALE',
      guardianFullName: 'Maya Tamang',
      guardianRelation: 'mother',
      guardianPhone: '9800000000',
      guardianEmail: null,
      academicYearId: null,
      classId: null,
      sectionId: null,
      previousSchool: null,
      source: 'front-desk',
      notes: null,
      duplicateReview: null,
      convertedStudentId: null,
      rejectedReason: null,
      createdById: 'registrar-a',
      updatedById: 'registrar-a',
      createdAt: new Date('2026-04-04T00:00:00.000Z'),
      updatedAt: new Date('2026-04-04T00:00:00.000Z'),
    },
    {
      id: 'draft-b',
      tenantId: tenantBId,
      status: 'INQUIRY',
      gender: null,
      firstNameEn: 'Bina',
      lastNameEn: 'Rai',
      firstNameNp: null,
      lastNameNp: null,
      dateOfBirth: new Date('2020-03-03T00:00:00.000Z'),
      guardianFullName: 'Tenant B Guardian',
      guardianRelation: null,
      guardianPhone: '9811111111',
      guardianEmail: null,
      academicYearId: null,
      classId: null,
      sectionId: null,
      previousSchool: null,
      source: 'autosave:tenant-b-draft',
      notes: JSON.stringify({ payload: { tenant: 'B' } }),
      duplicateReview: { matches: [] },
      convertedStudentId: null,
      rejectedReason: null,
      createdById: 'registrar-b',
      updatedById: 'registrar-b',
      createdAt: new Date('2026-04-04T00:00:00.000Z'),
      updatedAt: new Date('2026-04-04T00:00:00.000Z'),
    },
  ];
  prisma.__state.admissionImportBatches = [
    {
      id: 'import-batch-a',
      tenantId: tenantAId,
      sourceFileName: 'tenant-a-import.csv',
      status: 'COMPLETED',
      totalRows: 1,
      createdRows: 0,
      validatedRows: 1,
      failedRows: 0,
      dryRun: false,
      confirmDuplicates: true,
      errorReportCsv: null,
      metadata: null,
      createdById: 'registrar-a',
      startedAt: new Date('2026-04-05T00:00:00.000Z'),
      completedAt: new Date('2026-04-05T00:01:00.000Z'),
      createdAt: new Date('2026-04-05T00:00:00.000Z'),
    },
    {
      id: 'import-batch-b',
      tenantId: tenantBId,
      sourceFileName: 'tenant-b-import.csv',
      status: 'COMPLETED',
      totalRows: 1,
      createdRows: 0,
      validatedRows: 0,
      failedRows: 1,
      dryRun: false,
      confirmDuplicates: false,
      errorReportCsv: null,
      metadata: null,
      createdById: 'registrar-b',
      startedAt: new Date('2026-04-05T00:00:00.000Z'),
      completedAt: new Date('2026-04-05T00:01:00.000Z'),
      createdAt: new Date('2026-04-05T00:00:00.000Z'),
    },
  ];
  prisma.__state.admissionImportRows = [
    {
      id: 'import-row-a',
      tenantId: tenantAId,
      batchId: 'import-batch-a',
      rowNumber: 2,
      status: 'DUPLICATE_REVIEW',
      errors: [],
      duplicates: [{ studentId: 'student-a', score: 94 }],
      rawData: { firstNameEn: 'Asha' },
      createdAt: new Date('2026-04-05T00:00:00.000Z'),
    },
    {
      id: 'import-row-b',
      tenantId: tenantBId,
      batchId: 'import-batch-b',
      rowNumber: 3,
      status: 'FAILED',
      errors: ['Missing guardian phone'],
      duplicates: [],
      rawData: { firstNameEn: 'Bina' },
      createdAt: new Date('2026-04-05T00:00:00.000Z'),
    },
  ];
}

function overrideGeneratedDocumentReads(prisma: PrismaMock) {
  const findDocuments = (where?: Record<string, unknown>) =>
    prisma.__state.generatedStudentDocuments.filter(
      (document) =>
        (!where?.id || document.id === where.id) &&
        (!where?.tenantId || document.tenantId === where.tenantId) &&
        (!where?.studentId || document.studentId === where.studentId) &&
        (!where?.kind || document.kind === where.kind) &&
        (!where?.revokedAt || document.revokedAt === where.revokedAt),
    );

  prisma.generatedStudentDocument.findFirst.mockImplementation(
    (query: { where?: Record<string, unknown> }) =>
      Promise.resolve(
        findDocuments(query.where).sort(
          (left, right) =>
            Number(Boolean(left.revokedAt)) -
              Number(Boolean(right.revokedAt)) ||
            Number(right.version ?? 1) - Number(left.version ?? 1) ||
            new Date(right.generatedAt as Date).getTime() -
              new Date(left.generatedAt as Date).getTime(),
        )[0] ?? null,
      ),
  );
  prisma.generatedStudentDocument.findMany.mockImplementation(
    (query: { where?: Record<string, unknown> }) =>
      Promise.resolve(findDocuments(query.where)),
  );
  prisma.generatedStudentDocument.create.mockImplementation(
    (query: { data?: Record<string, unknown> }) => {
      const now = new Date('2026-04-06T00:10:00.000Z');
      const document = {
        id: `generated-${String(
          prisma.__state.generatedStudentDocuments.length + 1,
        )}`,
        generatedAt: now,
        revokedAt: null,
        version: 1,
        ...(query.data ?? {}),
      };
      prisma.__state.generatedStudentDocuments.push(document);
      return Promise.resolve(document);
    },
  );
  prisma.generatedStudentDocument.count = jest.fn();
  prisma.generatedStudentDocument.count.mockImplementation(
    (query: { where?: Record<string, unknown> }) =>
      Promise.resolve(findDocuments(query.where).length),
  );
}

function overrideStudentGuardianReads(prisma: PrismaMock) {
  prisma.studentGuardian.create.mockImplementation(
    (query: { data?: Record<string, unknown> }) => {
      const data = query.data ?? {};
      const link = {
        id: `link-${String(prisma.__state.studentGuardians.length + 1)}`,
        ...data,
        guardian: prisma.__state.guardians.find(
          (guardian) => guardian.id === data.guardianId,
        ),
      };
      prisma.__state.studentGuardians.push(link);
      return Promise.resolve(link);
    },
  );
  prisma.studentGuardian.findMany.mockImplementation(
    (query: { where?: Record<string, unknown> }) =>
      Promise.resolve(
        prisma.__state.studentGuardians
          .filter(
            (link) =>
              (!query.where?.tenantId ||
                link.tenantId === query.where.tenantId) &&
              (!query.where?.studentId ||
                link.studentId === query.where.studentId) &&
              (!query.where?.guardianId ||
                link.guardianId === query.where.guardianId),
          )
          .map((link) => ({
            ...link,
            guardian: prisma.__state.guardians.find(
              (guardian) => guardian.id === link.guardianId,
            ),
          })),
      ),
  );
  prisma.studentGuardian.findFirst.mockImplementation(
    (query: { where?: Record<string, unknown> }) =>
      Promise.resolve(
        prisma.__state.studentGuardians
          .filter(
            (link) =>
              (!query.where?.tenantId ||
                link.tenantId === query.where.tenantId) &&
              (!query.where?.studentId ||
                link.studentId === query.where.studentId) &&
              (!query.where?.guardianId ||
                link.guardianId === query.where.guardianId),
          )
          .map((link) => ({
            ...link,
            guardian: prisma.__state.guardians.find(
              (guardian) => guardian.id === link.guardianId,
            ),
            student: prisma.__state.students.find(
              (student) => student.id === link.studentId,
            ),
          }))[0] ?? null,
      ),
  );
  prisma.studentGuardian.deleteMany.mockImplementation(
    (query: { where?: Record<string, unknown> }) => {
      const before = prisma.__state.studentGuardians.length;
      prisma.__state.studentGuardians = prisma.__state.studentGuardians.filter(
        (link) =>
          !(
            (!query.where?.id || link.id === query.where.id) &&
            (!query.where?.tenantId ||
              link.tenantId === query.where.tenantId) &&
            (!query.where?.studentId ||
              link.studentId === query.where.studentId) &&
            (!query.where?.guardianId ||
              link.guardianId === query.where.guardianId)
          ),
      );
      return Promise.resolve({
        count: before - prisma.__state.studentGuardians.length,
      });
    },
  );
}

function overrideAdmissionDraftReads(prisma: PrismaMock) {
  prisma.admissionApplication = {
    findFirst: jest.fn((query: { where?: Record<string, unknown> }) =>
      Promise.resolve(
        prisma.__state.admissionApplications.find((application) =>
          matchesRecordWhere(application, query.where),
        ) ?? null,
      ),
    ),
    findMany: jest.fn(
      (query: { where?: Record<string, unknown>; take?: number }) =>
        Promise.resolve(
          prisma.__state.admissionApplications
            .filter((application) =>
              matchesRecordWhere(application, query.where),
            )
            .slice(0, query.take ?? 10),
        ),
    ),
    create: jest.fn((query: { data?: Record<string, unknown> }) => {
      const now = new Date('2026-04-06T00:00:00.000Z');
      const application = {
        id: `draft-${String(prisma.__state.admissionApplications.length + 1)}`,
        ...(query.data ?? {}),
        createdAt: now,
        updatedAt: now,
      };
      prisma.__state.admissionApplications.push(application);
      return Promise.resolve(application);
    }),
    updateMany: jest.fn(
      (query: {
        where?: Record<string, unknown>;
        data?: Record<string, unknown>;
      }) => {
        let count = 0;
        for (const application of prisma.__state.admissionApplications) {
          if (matchesRecordWhere(application, query.where)) {
            Object.assign(application, query.data ?? {}, {
              updatedAt: new Date('2026-04-06T00:05:00.000Z'),
            });
            count += 1;
          }
        }
        return Promise.resolve({ count });
      },
    ),
    update: jest.fn(
      (query: {
        where?: Record<string, unknown>;
        data?: Record<string, unknown>;
      }) => {
        const application = prisma.__state.admissionApplications.find(
          (candidate) => matchesRecordWhere(candidate, query.where),
        );
        if (!application) {
          return Promise.resolve(null);
        }
        Object.assign(application, query.data ?? {}, {
          updatedAt: new Date('2026-04-06T00:05:00.000Z'),
        });
        return Promise.resolve(application);
      },
    ),
  };
}

function overrideImportReviewReads(prisma: PrismaMock) {
  prisma.admissionImportBatch = {
    count: jest.fn((query: { where?: Record<string, unknown> }) =>
      Promise.resolve(
        prisma.__state.admissionImportBatches.filter((batch) =>
          matchesRecordWhere(batch, query.where),
        ).length,
      ),
    ),
    findMany: jest.fn(
      (query: {
        where?: Record<string, unknown>;
        skip?: number;
        take?: number;
      }) =>
        Promise.resolve(
          prisma.__state.admissionImportBatches
            .filter((batch) => matchesRecordWhere(batch, query.where))
            .slice(query.skip ?? 0, (query.skip ?? 0) + (query.take ?? 25)),
        ),
    ),
    findFirst: jest.fn((query: { where?: Record<string, unknown> }) => {
      const batch = prisma.__state.admissionImportBatches.find((candidate) =>
        matchesRecordWhere(candidate, query.where),
      );
      if (!batch) {
        return Promise.resolve(null);
      }
      return Promise.resolve({
        ...batch,
        rows: prisma.__state.admissionImportRows
          .filter((row) => row.batchId === batch.id)
          .sort(
            (left, right) => Number(left.rowNumber) - Number(right.rowNumber),
          ),
      });
    }),
  };

  prisma.admissionImportRow = {
    findMany: jest.fn(
      (query: { where?: Record<string, unknown>; take?: number }) =>
        Promise.resolve(
          prisma.__state.admissionImportRows
            .filter((row) => matchesRecordWhere(row, query.where))
            .slice(0, query.take ?? 50)
            .map((row) => ({
              ...row,
              batch: prisma.__state.admissionImportBatches.find(
                (batch) => batch.id === row.batchId,
              ),
            })),
        ),
    ),
  };
}

function overrideFileAssetCount(prisma: PrismaMock) {
  prisma.fileAsset.count = jest.fn(
    (query: { where?: Record<string, unknown> }) =>
      Promise.resolve(
        prisma.__state.fileAssets.filter(
          (asset) =>
            (!query.where?.tenantId ||
              asset.tenantId === query.where.tenantId) &&
            (!query.where?.module || asset.module === query.where.module) &&
            (!query.where?.entityId ||
              asset.entityId === query.where.entityId) &&
            (!query.where?.deletedAt ||
              asset.deletedAt === query.where.deletedAt),
        ).length,
      ),
  );
}

function overrideAdmissionConversionWrites(prisma: PrismaMock) {
  prisma.feePlan = {
    findMany: jest.fn(() => Promise.resolve([])),
  };
  prisma.studentFeeAssignment = {
    findMany: jest.fn(() => Promise.resolve([])),
    upsert: jest.fn(),
  };
  prisma.enrollment.create = jest.fn(
    (query: { data?: Record<string, unknown> }) => {
      const data = query.data ?? {};
      const enrollment = {
        id: `enrollment-${String(prisma.__state.enrollments.length + 1)}`,
        status: 'ACTIVE',
        createdAt: new Date('2026-04-06T00:20:00.000Z'),
        ...data,
        academicYear: prisma.__state.academicYears.find(
          (year) => year.id === data.academicYearId,
        ),
        class: prisma.__state.classes.find(
          (classroom) => classroom.id === data.classId,
        ),
        section: prisma.__state.sections.find(
          (section) => section.id === data.sectionId,
        ),
      };
      prisma.__state.enrollments.push(enrollment);
      return Promise.resolve(enrollment);
    },
  );
}

function matchesRecordWhere(
  record: Record<string, unknown>,
  where?: Record<string, unknown>,
): boolean {
  if (!where) {
    return true;
  }

  return Object.entries(where).every(([key, value]) => {
    if (key === 'OR' && Array.isArray(value)) {
      return value.some((clause) =>
        matchesRecordWhere(record, clause as Record<string, unknown>),
      );
    }
    if (value && typeof value === 'object' && 'in' in value) {
      return (value as { in: unknown[] }).in.includes(record[key]);
    }
    if (value && typeof value === 'object' && 'startsWith' in value) {
      return stringifyScalar(record[key]).startsWith(
        String((value as { startsWith: unknown }).startsWith),
      );
    }
    if (value && typeof value === 'object' && 'not' in value) {
      return record[key] !== (value as { not: unknown }).not;
    }

    return record[key] === value;
  });
}

function stringifyScalar(value: unknown): string {
  return ['string', 'number', 'boolean'].includes(typeof value)
    ? String(value)
    : '';
}
