import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ENTITLEMENT_KEY } from '../auth/decorators/entitlement.decorator';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { TenantActiveGuard } from '../auth/guards/tenant-active.guard';
import { TeacherTodayController } from './teacher-today.controller';

describe('TeacherTodayController entitlement gating (DEF-06)', () => {
  it('uses JwtAuthGuard, TenantActiveGuard, RolesPermissionsGuard, and EntitlementGuard', () => {
    const guards = (Reflect.getMetadata(
      GUARDS_METADATA,
      TeacherTodayController,
    ) ?? []) as unknown[];

    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(TenantActiveGuard);
    expect(guards).toContain(RolesPermissionsGuard);
    expect(guards).toContain(EntitlementGuard);
  });

  it('requires module.attendance entitlement', () => {
    const entitlement = Reflect.getMetadata(
      ENTITLEMENT_KEY,
      TeacherTodayController,
    ) as string | undefined;

    expect(entitlement).toBe('module.attendance');
  });
});
