import { INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AuthMethod,
  LibraryCopyStatus,
  LibraryIssueStatus,
} from '@prisma/client';
import request from 'supertest';
import type { AuthContext } from '../src/auth/auth.types';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import {
  createPrismaMock,
  createQueueMock,
  ensureTenantDefaultsWithState,
  mockBullQueues,
  type PrismaMock,
} from './test-helpers';

const entitledTenantId = 'tenant-m8-library-e2e';
const noEntitlementTenantId = 'tenant-m8-library-e2e-no-entitlement';
const otherEntitledTenantId = 'tenant-m8-library-e2e-other';

const librarianActor = buildActor(entitledTenantId, 'librarian-user-1', {
  roles: ['librarian'],
  permissions: [
    'library:books:read',
    'library:copies:read',
    'library:issues:read',
    'library:issues:create',
    'library:issues:return',
  ],
});

const teacherActor = buildActor(entitledTenantId, 'teacher-user-1', {
  roles: ['subject_teacher'],
  permissions: [
    'library:books:read',
    'library:copies:read',
    'library:issues:read',
  ],
});

const noEntitlementActor = buildActor(
  noEntitlementTenantId,
  'librarian-user-2',
  {
    roles: ['librarian'],
    permissions: [
      'library:books:read',
      'library:copies:read',
      'library:issues:read',
      'library:issues:create',
    ],
  },
);

const otherTenantActor = buildActor(otherEntitledTenantId, 'librarian-user-3', {
  roles: ['librarian'],
  permissions: ['library:books:read', 'library:copies:read'],
});

const bookId = 'book-m8-e2e-1';
const availableCopyId = 'copy-m8-e2e-available';
const issuedCopyId = 'copy-m8-e2e-issued';
const issuedIssueId = 'issue-m8-e2e-1';
const studentId = 'student-m8-e2e-1';

describe('M8 Library HTTP circulation lifecycle (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();
    seedTenant(prisma, entitledTenantId, true);
    seedTenant(prisma, noEntitlementTenantId, false);
    seedTenant(prisma, otherEntitledTenantId, true);
    seedCirculationFixtures(prisma);
    patchLibraryIssueFindUniqueOrThrow(prisma);

    let moduleBuilder = Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(RedisService)
      .useValue({
        ping: jest.fn(() => Promise.resolve('PONG')),
        onModuleDestroy: jest.fn(() => Promise.resolve(undefined)),
      })
      .overrideProvider(getQueueToken('finance'))
      .useValue(createQueueMock())
      .overrideProvider(getQueueToken('payroll'))
      .useValue(createQueueMock())
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
          const actorKey = req.headers['x-test-actor'];
          req.auth =
            actorKey === 'teacher'
              ? teacherActor
              : actorKey === 'no-entitlement'
                ? noEntitlementActor
                : actorKey === 'other-tenant'
                  ? otherTenantActor
                  : librarianActor;
          return true;
        },
      });

    moduleBuilder = mockBullQueues(moduleBuilder);

    const moduleFixture: TestingModule = await moduleBuilder.compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('denies library access when the tenant is not entitled to module.library', async () => {
    const response = await request(app.getHttpServer())
      .get('/library/books')
      .set('x-test-actor', 'no-entitlement')
      .set('authorization', 'Bearer test-token');

    expect(response.status).toBe(403);
  });

  it('denies issuing a copy for an actor without library:issues:create', async () => {
    const response = await request(app.getHttpServer())
      .post('/library/issues')
      .set('x-test-actor', 'teacher')
      .set('authorization', 'Bearer test-token')
      .send({
        copyId: availableCopyId,
        borrowerStudentId: studentId,
        dueAt: futureIso(),
      });

    expect(response.status).toBe(403);
  });

  it('issues an available copy to a student over HTTP and flips its status', async () => {
    const response = await request(app.getHttpServer())
      .post('/library/issues')
      .set('x-test-actor', 'librarian')
      .set('authorization', 'Bearer test-token')
      .send({
        copyId: availableCopyId,
        borrowerStudentId: studentId,
        dueAt: futureIso(),
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual(
      expect.objectContaining({
        copyId: availableCopyId,
        borrowerStudentId: studentId,
        status: LibraryIssueStatus.ISSUED,
      }),
    );

    const updatedCopy = prisma.__state.libraryCopies.find(
      (copy) => copy.id === availableCopyId,
    );
    expect(updatedCopy?.status).toBe(LibraryCopyStatus.ISSUED);
  });

  it('rejects a second issue attempt while the copy is already checked out', async () => {
    const first = await request(app.getHttpServer())
      .post('/library/issues')
      .set('x-test-actor', 'librarian')
      .set('authorization', 'Bearer test-token')
      .send({
        copyId: availableCopyId,
        borrowerStudentId: studentId,
        dueAt: futureIso(),
      });
    expect(first.status).toBe(201);

    const second = await request(app.getHttpServer())
      .post('/library/issues')
      .set('x-test-actor', 'librarian')
      .set('authorization', 'Bearer test-token')
      .send({
        copyId: availableCopyId,
        borrowerStudentId: studentId,
        dueAt: futureIso(),
      });

    expect(second.status).toBe(409);
  });

  it('returns an issued copy over HTTP and clears it back to AVAILABLE', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/library/issues/${issuedIssueId}/return`)
      .set('x-test-actor', 'librarian')
      .set('authorization', 'Bearer test-token')
      .send({ returnCondition: 'Good' });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe(LibraryIssueStatus.RETURNED);

    const updatedCopy = prisma.__state.libraryCopies.find(
      (copy) => copy.id === issuedCopyId,
    );
    expect(updatedCopy?.status).toBe(LibraryCopyStatus.AVAILABLE);
  });

  it('returns 404 for a book that does not belong to the actor tenant', async () => {
    const response = await request(app.getHttpServer())
      .get(`/library/books/${bookId}/history`)
      .set('x-test-actor', 'other-tenant')
      .set('authorization', 'Bearer test-token');

    // otherTenantActor's tenant IS entitled to module.library (unlike
    // noEntitlementActor), so this confirms tenant-scoping on the lookup
    // itself, not just the entitlement gate.
    expect(response.status).toBe(404);
  });
});

function buildActor(
  tenantId: string,
  userId: string,
  overrides: Partial<AuthContext>,
): AuthContext {
  return {
    userId,
    tenantId,
    tenantSlug: tenantId,
    email: `${userId}@schoolos.test`,
    authMethod: AuthMethod.PASSWORD,
    roles: [],
    permissions: [],
    ...overrides,
  };
}

function seedTenant(prisma: PrismaMock, tenantId: string, entitled: boolean) {
  ensureTenantDefaultsWithState(prisma.__state, tenantId);
  const planId = `plan-${tenantId}`;
  prisma.__state.platformPlans.push({
    id: planId,
    key: entitled ? 'professional' : 'basic',
    name: entitled ? 'Professional' : 'Basic',
  });
  if (entitled) {
    prisma.__state.platformPlanFeatures.push({
      id: `feature-library-${tenantId}`,
      planId,
      featureKey: 'module.library',
      enabled: true,
    });
  }
  prisma.__state.tenantSubscriptions.push({
    id: `sub-${tenantId}`,
    tenantId,
    planId,
    status: 'ACTIVE',
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
  });
}

function seedCirculationFixtures(prisma: PrismaMock) {
  prisma.__state.students.push({
    id: studentId,
    tenantId: entitledTenantId,
    studentSystemId: 'M8-E2E-01',
    firstNameEn: 'M8',
    lastNameEn: 'E2E Student',
  });

  prisma.__state.libraryBooks.push({
    id: bookId,
    tenantId: entitledTenantId,
    title: 'M8 E2E Fixture Book',
    author: 'E2E Author',
    isbn: '978-1111100001',
    archivedAt: null,
  });

  prisma.__state.libraryCopies.push(
    {
      id: availableCopyId,
      tenantId: entitledTenantId,
      bookId,
      barcode: 'M8-E2E-AVAILABLE',
      qrCode: 'M8-E2E-AVAILABLE',
      status: LibraryCopyStatus.AVAILABLE,
      archivedAt: null,
    },
    {
      id: issuedCopyId,
      tenantId: entitledTenantId,
      bookId,
      barcode: 'M8-E2E-ISSUED',
      qrCode: 'M8-E2E-ISSUED',
      status: LibraryCopyStatus.ISSUED,
      archivedAt: null,
    },
  );

  prisma.__state.libraryIssues.push({
    id: issuedIssueId,
    tenantId: entitledTenantId,
    copyId: issuedCopyId,
    borrowerStudentId: studentId,
    borrowerStaffId: null,
    issuedAt: new Date('2026-06-01T00:00:00.000Z'),
    dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status: LibraryIssueStatus.ISSUED,
    fineAmount: 0,
    invoiceId: null,
    notes: null,
  });
}

interface LibraryIssueQuery {
  where?: Record<string, unknown>;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

function patchLibraryIssueFindUniqueOrThrow(prisma: PrismaMock) {
  prisma.libraryIssue.findUniqueOrThrow = jest.fn(
    async (q: LibraryIssueQuery) => {
      const result = await prisma.libraryIssue.findFirst(q);
      if (!result) throw new Error('LibraryIssue not found');
      return result;
    },
  );

  // The shared generic mock's create() defaults every model's `status` to
  // 'NEW' when the caller omits it -- correct for other dummy models, but
  // wrong here: issueCopy relies on Prisma's schema-level
  // `LibraryIssue.status @default(ISSUED)` and never sets it explicitly.
  const genericCreate = prisma.libraryIssue.create;
  prisma.libraryIssue.create = jest.fn(async (q: LibraryIssueQuery) => {
    const created = await genericCreate({
      ...q,
      data: { status: LibraryIssueStatus.ISSUED, ...q.data },
    });
    return created;
  });
}

function futureIso() {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
}
