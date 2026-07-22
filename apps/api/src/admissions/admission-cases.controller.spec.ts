import { AuthMethod } from '@prisma/client';
import { ENTITLEMENT_KEY } from '../auth/decorators/entitlement.decorator';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { AdmissionCasesController } from './admission-cases.controller';

const actor: AuthContext = {
  tenantId: 'tenant-a',
  tenantSlug: 'tenant-a',
  userId: 'reviewer-a',
  email: 'reviewer@school.test',
  authMethod: AuthMethod.PASSWORD,
  roles: ['admin'],
  permissions: ['students:manage_lifecycle'],
};

describe('AdmissionCasesController review contract', () => {
  it('keeps admission cases behind the students entitlement', () => {
    expect(Reflect.getMetadata(ENTITLEMENT_KEY, AdmissionCasesController)).toBe(
      'module.students',
    );
  });

  it('requires the lifecycle permission for review decisions', () => {
    const permissions: unknown = Reflect.getMetadata(
      PERMISSIONS_KEY,
      AdmissionCasesController.prototype.reviewCase,
    );

    expect(permissions).toEqual(['students:manage_lifecycle']);
  });

  it('requires admission read permissions for document request lists', () => {
    const permissions: unknown = Reflect.getMetadata(
      PERMISSIONS_KEY,
      AdmissionCasesController.prototype.listDocumentRequests,
    );

    expect(permissions).toEqual([
      'enrollments:read',
      'students:read',
      'guardians:read',
    ]);
  });

  it('requires lifecycle and guardian-read permissions for document reminders', () => {
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        AdmissionCasesController.prototype.requestDocumentReminders,
      ),
    ).toEqual(['students:manage_lifecycle', 'guardians:read']);
  });

  it('requires admission read permissions for assessment workspace lists', () => {
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        AdmissionCasesController.prototype.listAssessmentSessions,
      ),
    ).toEqual(['enrollments:read', 'students:read', 'guardians:read']);
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        AdmissionCasesController.prototype.listAssessmentCandidates,
      ),
    ).toEqual(['enrollments:read', 'students:read', 'guardians:read']);
  });

  it('requires lifecycle permission for assessment schedule and result commands', () => {
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        AdmissionCasesController.prototype.scheduleAssessmentSession,
      ),
    ).toEqual(['students:manage_lifecycle']);
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        AdmissionCasesController.prototype.recordAssessmentResult,
      ),
    ).toEqual(['students:manage_lifecycle']);
  });

  it('delegates document request filters to the service with the actor', () => {
    const service = {
      listDocumentRequests: jest.fn().mockReturnValue({ items: [] }),
    };
    const controller = new AdmissionCasesController(
      service as never,
      {} as never,
    );
    const query = {
      classId: 'class-a',
      documentKind: 'TRANSFER_CERTIFICATE',
      minDaysPending: 7,
    };

    expect(controller.listDocumentRequests(query, actor)).toEqual({
      items: [],
    });
    expect(service.listDocumentRequests).toHaveBeenCalledWith(query, actor);
  });

  it('delegates assessment workspace filters and commands to the service with the actor', () => {
    const service = {
      listAssessmentSessions: jest.fn().mockReturnValue({ items: [] }),
      listAssessmentCandidates: jest.fn().mockReturnValue({ items: [] }),
      scheduleAssessmentSession: jest.fn().mockReturnValue({ id: 'session-a' }),
      recordAssessmentResult: jest.fn().mockReturnValue({ id: 'session-a' }),
    };
    const controller = new AdmissionCasesController(
      service as never,
      {} as never,
    );
    const sessionQuery = { tab: 'TODAY' as const, classId: 'class-a' };
    const candidateQuery = { policyId: 'policy-a' };
    const scheduleDto = {
      bsDate: '2083-04-01',
      startTime: '10:00',
      durationMinutes: 30,
    };
    const resultDto = { result: 'PASSED' as const, score: 80 };

    expect(controller.listAssessmentSessions(sessionQuery, actor)).toEqual({
      items: [],
    });
    expect(controller.listAssessmentCandidates(candidateQuery, actor)).toEqual({
      items: [],
    });
    expect(
      controller.scheduleAssessmentSession('case-a', scheduleDto, actor),
    ).toEqual({ id: 'session-a' });
    expect(
      controller.recordAssessmentResult('session-a', resultDto, actor),
    ).toEqual({ id: 'session-a' });
    expect(service.listAssessmentSessions).toHaveBeenCalledWith(
      sessionQuery,
      actor,
    );
    expect(service.listAssessmentCandidates).toHaveBeenCalledWith(
      candidateQuery,
      actor,
    );
    expect(service.scheduleAssessmentSession).toHaveBeenCalledWith(
      'case-a',
      scheduleDto,
      actor,
    );
    expect(service.recordAssessmentResult).toHaveBeenCalledWith(
      'session-a',
      resultDto,
      actor,
    );
  });

  it('delegates the case id, bounded command, and authenticated actor', () => {
    const service = {
      reviewCase: jest.fn().mockReturnValue({ id: 'case-a' }),
    };
    const controller = new AdmissionCasesController(
      service as never,
      {} as never,
    );
    const dto = {
      action: 'REJECT' as const,
      reason: 'Recorded admission requirements were not met.',
    };

    expect(controller.reviewCase('case-a', dto, actor)).toEqual({
      id: 'case-a',
    });
    expect(service.reviewCase).toHaveBeenCalledWith('case-a', dto, actor);
  });

  it('delegates the bounded reminder command with authenticated context', () => {
    const reminders = {
      requestReminders: jest.fn().mockReturnValue({
        requested: 1,
        queued: 1,
        alreadyQueued: 0,
        skipped: 0,
        results: [],
      }),
    };
    const controller = new AdmissionCasesController(
      {} as never,
      reminders as never,
    );
    const dto = {
      admissionCaseIds: ['11111111-1111-4111-8111-111111111111'],
    };

    expect(controller.requestDocumentReminders(dto, actor)).toEqual(
      expect.objectContaining({ requested: 1, queued: 1 }),
    );
    expect(reminders.requestReminders).toHaveBeenCalledWith(dto, actor);
  });
});
