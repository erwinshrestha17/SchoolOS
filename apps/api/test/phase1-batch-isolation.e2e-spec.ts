import {
  ExecutionContext,
  ValidationPipe,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthMethod } from '@prisma/client';
import request from 'supertest';
import type { Server } from 'node:http';
import { AuthorizationModule } from '../src/authorization/authorization.module';
import { RolesPermissionsGuard } from '../src/auth/guards/roles-permissions.guard';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { EntitlementGuard } from '../src/auth/guards/entitlement.guard';
import { AcademicsController } from '../src/academics/academics.controller';
import { AcademicsService } from '../src/academics/academics.service';
import { AcademicsFoundationService } from '../src/academics/academics-foundation.service';
import { AssessmentComponentsService } from '../src/academics/assessment-components.service';
import { AssessmentRetakesService } from '../src/academics/assessment-retakes.service';
import { CasRecordsService } from '../src/academics/cas-records.service';
import { MarkLockWorkflowService } from '../src/academics/mark-lock-workflow.service';
import { ReportCardPdfService } from '../src/academics/report-card-pdf.service';
import { ReportCardsService } from '../src/academics/report-cards.service';
import { MarksService } from '../src/academics/marks.service';
import { ResultPublishingService } from '../src/academics/result-publishing.service';
import { GradeCalculatorService } from '../src/academics/grade-calculator.service';
import { ResultsService } from '../src/academics/results.service';
import { PromotionReadinessService } from '../src/academics/promotion-readiness.service';
import type { AuthenticatedRequest } from '../src/auth/auth-request.interface';
import { recordTestAuthorizationIdentity } from './helpers/authorization-test-helpers';

// Actual controller, kernel and batch service; synthetic auth and explicit persistence fixtures.
describe('Phase 1D production batch route isolation', () => {
  let app: INestApplication;
  let server: Server;
  const students = jest.fn();
  const prisma = {
    academicYear: {
      findFirst: jest.fn((args: { where: { id: string } }) =>
        Promise.resolve({ id: args.where.id }),
      ),
    },
    class: { findFirst: jest.fn().mockResolvedValue({ id: 'class' }) },
    section: { findFirst: jest.fn().mockResolvedValue({ id: 'section' }) },
    student: { findMany: students },
  };
  const service = new PromotionReadinessService(
    prisma as never,
    { record: jest.fn() } as never,
    {} as never,
  );
  const transition = jest
    .spyOn(service, 'promoteStudent')
    .mockResolvedValue({} as never);
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AuthorizationModule],
      controllers: [AcademicsController],
      providers: [
        RolesPermissionsGuard,
        {
          provide: EntitlementGuard,
          useValue: { canActivate: () => Promise.resolve(true) },
        },
        { provide: PromotionReadinessService, useValue: service },
        ...[
          AcademicsService,
          AcademicsFoundationService,
          AssessmentComponentsService,
          AssessmentRetakesService,
          CasRecordsService,
          MarkLockWorkflowService,
          ReportCardPdfService,
          ReportCardsService,
          MarksService,
          ResultPublishingService,
          GradeCalculatorService,
          ResultsService,
        ].map((provide) => ({ provide, useValue: {} })),
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
          req.auth = {
            userId: 'synthetic-admin',
            tenantId: 'school',
            tenantSlug: 'school',
            email: null,
            authMethod: AuthMethod.PASSWORD,
            securityDomain: 'SCHOOL',
            roles: ['admin'],
            permissions: ['academics:update'],
            accessGrants: [
              {
                assignmentId: 'admin-role',
                tenantId: 'school',
                role: 'admin',
                permissions: ['academics:update'],
                scopes: [
                  {
                    scopeType: 'TENANT',
                    scopeId: 'school',
                    effectiveFrom: new Date(0),
                    expiresAt: null,
                    revokedAt: null,
                  },
                ],
              },
            ],
          };
          recordTestAuthorizationIdentity(req);
          return true;
        },
      })
      .overrideGuard(EntitlementGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication({ logger: false });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    server = app.getHttpServer() as Server;
  });
  beforeEach(() => {
    transition.mockClear();
    students.mockImplementation(
      (args: { where: { tenantId: string; id: { in: string[] } } }) =>
        Promise.resolve(
          args.where.id.in
            .filter((id) => id.startsWith('own-'))
            .map((id) => ({ id, tenantId: args.where.tenantId })),
        ),
    );
  });
  afterAll(async () => {
    await app.close();
    transition.mockRestore();
  });
  const mapping = (studentIds: string[]) => ({
    fromClassId: 'source',
    toClassId: 'target',
    studentIds,
  });
  it.each([
    [mapping(['own-one', 'foreign'])],
    [mapping(['own-one']), mapping(['foreign'])],
  ])(
    'rejects an entire mixed batch before any authorized transition',
    async (...classMappings) => {
      await request(server)
        .post('/academics/promotions/batch')
        .send({
          academicYearId: 'year-one',
          targetAcademicYearId: 'year-two',
          classMappings,
          tenantId: 'foreign',
          permissions: ['admin:all'],
        })
        .expect(404);
      expect(transition).not.toHaveBeenCalled();
      expect(students).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'school' }),
        }),
      );
    },
  );
  it('retains the legitimate batch path after complete scope validation', async () => {
    await request(server)
      .post('/academics/promotions/batch')
      .send({
        academicYearId: 'year-one',
        targetAcademicYearId: 'year-two',
        classMappings: [mapping(['own-one'])],
      })
      .expect(201);
    expect(transition).toHaveBeenCalledTimes(1);
  });
});
