import {
  permissionCatalog,
  systemRoleDefinitions,
  systemRolePermissions,
} from '@schoolos/core';

export interface PermissionDefinition {
  resource: string;
  action: string;
  description: string;
}

export const PERMISSION_CATALOG: PermissionDefinition[] = permissionCatalog.map(p => ({
  resource: p.resource,
  action: p.action,
  description: p.description,
}));
export const SYSTEM_ROLE_DEFINITIONS = systemRoleDefinitions;
export const SYSTEM_ROLE_PERMISSIONS = systemRolePermissions;

export function buildPermissionKey(resource: string, action: string) {
  return `${resource}:${action}`;
}
