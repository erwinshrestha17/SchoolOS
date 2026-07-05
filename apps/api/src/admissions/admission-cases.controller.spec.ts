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

  it('delegates the case id, bounded command, and authenticated actor', () => {
    const service = {
      reviewCase: jest.fn().mockReturnValue({ id: 'case-a' }),
    };
    const controller = new AdmissionCasesController(service as never);
    const dto = {
      action: 'REJECT' as const,
      reason: 'Recorded admission requirements were not met.',
    };

    expect(controller.reviewCase('case-a', dto, actor)).toEqual({
      id: 'case-a',
    });
    expect(service.reviewCase).toHaveBeenCalledWith('case-a', dto, actor);
  });
});
