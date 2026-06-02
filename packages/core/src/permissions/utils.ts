export function buildPermissionKey(resource: string, action: string) {
  return `${resource}:${action}`;
}
