import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ENTITLEMENT_KEY } from '../auth/decorators/entitlement.decorator';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { SectionsController } from './sections.controller';

describe('SectionsController class-teacher assignment authorization (DEF-04)', () => {
  it('guards the sections controller with JwtAuthGuard, RolesPermissionsGuard, and EntitlementGuard', () => {
    const guards = (Reflect.getMetadata(GUARDS_METADATA, SectionsController) ??
      []) as unknown[];

    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(RolesPermissionsGuard);
    expect(guards).toContain(EntitlementGuard);
  });

  it('requires module.students entitlement on the controller', () => {
    const entitlement = Reflect.getMetadata(
      ENTITLEMENT_KEY,
      SectionsController,
    ) as string | undefined;

    expect(entitlement).toBe('module.students');
  });

  it('requires academics:update on PUT /sections/:sectionId/class-teacher', () => {
    const permissions = (Reflect.getMetadata(
      PERMISSIONS_KEY,
      SectionsController.prototype.assignClassTeacher,
    ) ?? []) as string[];

    expect(permissions).toEqual(['academics:update']);
  });

  it('requires academics:update on DELETE /sections/:sectionId/class-teacher', () => {
    const permissions = (Reflect.getMetadata(
      PERMISSIONS_KEY,
      SectionsController.prototype.removeClassTeacher,
    ) ?? []) as string[];

    expect(permissions).toEqual(['academics:update']);
  });

  it('does not attach route-level guards beyond the controller defaults', () => {
    const assignGuards = (Reflect.getMetadata(
      GUARDS_METADATA,
      SectionsController.prototype.assignClassTeacher,
    ) ?? []) as unknown[];
    const removeGuards = (Reflect.getMetadata(
      GUARDS_METADATA,
      SectionsController.prototype.removeClassTeacher,
    ) ?? []) as unknown[];

    expect(assignGuards).toEqual([]);
    expect(removeGuards).toEqual([]);
  });
});
