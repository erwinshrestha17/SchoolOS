import { PATH_METADATA } from '@nestjs/common/constants';
import { AuthMethod } from '@prisma/client';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { REQUIRED_MODULE_KEY } from '../auth/decorators/required-module.decorator';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import type { AuthContext } from '../auth/auth.types';
import { LearningImprovementController } from './learning-improvement.controller';
import { LearningImprovementService } from './learning-improvement.service';

describe('LearningImprovementController', () => {
  const actor: AuthContext = {
    tenantId: 'tenant-1',
    tenantSlug: 'school',
    userId: 'teacher-user-1',
    email: 'teacher@school.test',
    authMethod: AuthMethod.PASSWORD,
    roles: ['teacher'],
    permissions: ['academics:read', 'academics:enter_marks'],
  };

  it('keeps the deferred P2 workspace behind the disabled Learning boundary', () => {
    expect(
      Reflect.getMetadata(REQUIRED_MODULE_KEY, LearningImprovementController),
    ).toBe('learning');
    expect(
      Reflect.getMetadata(ROLES_KEY, LearningImprovementController),
    ).toEqual([
      'admin',
      'principal',
      'teacher',
      'subject_teacher',
      'platform_super_admin',
    ]);
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        LearningImprovementController.prototype.earlyWarning,
      ),
    ).toEqual(['academics:read']);
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        LearningImprovementController.prototype.createFormativeAssessment,
      ),
    ).toEqual(['academics:enter_marks']);
  });

  it('uses kebab-case module-owned routes for every Stage 3 workflow', () => {
    const routes = [
      ['earlyWarning', 'early-warning'],
      ['outcomes', 'outcomes'],
      ['formativeAssessments', 'formative-assessments'],
      ['interventions', 'interventions'],
      ['remedialGroups', 'remedial-groups'],
      ['curriculumProgress', 'curriculum-progress'],
      ['parentGuidance', 'parent-guidance'],
    ] as const;

    for (const [method, path] of routes) {
      expect(
        Reflect.getMetadata(
          PATH_METADATA,
          LearningImprovementController.prototype[method],
        ),
      ).toBe(path);
    }
  });

  it('delegates reads and audited writes with the authenticated tenant context', async () => {
    const service = {
      getEarlyWarnings: jest.fn().mockResolvedValue({ items: [] }),
      createFormativeAssessment: jest.fn().mockResolvedValue({ id: 'check-1' }),
      createIntervention: jest.fn().mockResolvedValue({ id: 'case-1' }),
      addRemedialMembers: jest.fn().mockResolvedValue({ id: 'group-1' }),
      updateGuidanceStatus: jest.fn().mockResolvedValue({ id: 'guidance-1' }),
    };
    const controller = new LearningImprovementController(
      service as unknown as LearningImprovementService,
    );
    const query = { academicYearId: 'year-1', page: 1, limit: 20 };
    const checkDto = { clientSubmissionId: 'request-1' } as never;
    const caseDto = { clientRequestId: 'request-2' } as never;
    const guidanceDto = {
      status: 'PUBLISHED',
      reason: 'Teacher approved the family guidance.',
    } as never;

    await controller.earlyWarning(actor, query);
    await controller.createFormativeAssessment(actor, checkDto);
    await controller.createIntervention(actor, caseDto);
    await controller.addRemedialMembers(actor, 'group-1', {
      studentIds: ['student-1'],
    });
    await controller.updateParentGuidanceStatus(
      actor,
      'guidance-1',
      guidanceDto,
    );

    expect(service.getEarlyWarnings).toHaveBeenCalledWith(actor, query);
    expect(service.createFormativeAssessment).toHaveBeenCalledWith(
      actor,
      checkDto,
    );
    expect(service.createIntervention).toHaveBeenCalledWith(actor, caseDto);
    expect(service.addRemedialMembers).toHaveBeenCalledWith(actor, 'group-1', {
      studentIds: ['student-1'],
    });
    expect(service.updateGuidanceStatus).toHaveBeenCalledWith(
      actor,
      'guidance-1',
      guidanceDto,
    );
  });
});
