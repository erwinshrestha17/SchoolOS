import {
  PLATFORM_SYSTEM_ROLE_DEFINITIONS,
  PLATFORM_SYSTEM_ROLE_PERMISSIONS,
  SCHOOL_SYSTEM_ROLE_DEFINITIONS,
  SCHOOL_SYSTEM_ROLE_PERMISSIONS,
  permissionCatalog,
  systemRoleDefinitions,
  systemRolePermissions,
} from '@schoolos/core';

export interface PermissionDefinition {
  resource: string;
  action: string;
  description: string;
}

export const PERMISSION_CATALOG: PermissionDefinition[] = permissionCatalog.map(
  (p) => ({
    resource: p.resource,
    action: p.action,
    description: p.description,
  }),
);
export const SYSTEM_ROLE_DEFINITIONS = systemRoleDefinitions;
export const SYSTEM_ROLE_PERMISSIONS = systemRolePermissions;
export const SCHOOL_ROLE_DEFINITIONS = SCHOOL_SYSTEM_ROLE_DEFINITIONS;
export const SCHOOL_ROLE_PERMISSIONS = SCHOOL_SYSTEM_ROLE_PERMISSIONS;
export const PLATFORM_ROLE_DEFINITIONS = PLATFORM_SYSTEM_ROLE_DEFINITIONS;
export const PLATFORM_ROLE_PERMISSIONS = PLATFORM_SYSTEM_ROLE_PERMISSIONS;

export function buildPermissionKey(resource: string, action: string) {
  return `${resource}:${action}`;
}
