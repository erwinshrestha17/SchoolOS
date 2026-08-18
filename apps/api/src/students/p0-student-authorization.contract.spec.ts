import { systemRolePermissions } from '@schoolos/core';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { StudentsController } from './students.controller';

function requiredPermissions(methodName: keyof StudentsController): string[] {
  const handler = StudentsController.prototype[methodName];
  return Reflect.getMetadata(PERMISSIONS_KEY, handler) ?? [];
}

function roleCanSatisfy(role: string, required: string[]) {
  const granted = systemRolePermissions[role] ?? [];
  return required.every((permission) => granted.includes(permission));
}

describe('P0 student authorization contract', () => {
  it('keeps iEMIS validation and exports behind administrative permissions', () => {
    expect(requiredPermissions('getIemisValidationList')).toEqual([
      'students:manage_lifecycle',
    ]);
    expect(requiredPermissions('exportIemis')).toEqual([
      'students:manage_lifecycle',
      'reports:export',
    ]);
    expect(requiredPermissions('exportRoster')).toEqual([
      'students:manage_lifecycle',
      'reports:export',
    ]);
  });

  it.each(['teacher', 'subject_teacher', 'support_staff', 'librarian', 'driver'])(
    '%s cannot satisfy the iEMIS export permission contract',
    (role) => {
      expect(roleCanSatisfy(role, requiredPermissions('exportIemis'))).toBe(
        false,
      );
    },
  );

  it('preserves teacher student reads while removing generic student-directory access from non-teaching operational personas', () => {
    expect(systemRolePermissions.teacher).toContain('students:read');
    expect(systemRolePermissions.subject_teacher).toContain('students:read');

    expect(systemRolePermissions.support_staff).not.toContain('students:read');
    expect(systemRolePermissions.librarian).not.toContain('students:read');
    expect(systemRolePermissions.driver).not.toContain('students:read');
  });

  it('does not grant Librarian school fee administration', () => {
    expect(systemRolePermissions.librarian).not.toContain('fees:manage');
  });
});
