import { join } from 'node:path';
import { inventoryAuthorizationRoutes } from '../../test/helpers/authorization-route-inventory';
import reviewed from './reviewed-metadata-less-routes.json';
import { SERVICE_AUTHORIZATION_POLICIES } from './service-authorization.decorator';

describe('Reviewed controller authorization boundaries', () => {
  const routes = inventoryAuthorizationRoutes(join(__dirname, '..'));
  it('requires review for every new or changed metadata-less route, including service-only/self/public endpoints', () => {
    const current = routes
      .filter((r) => !r.permissions.length && !r.roles.length)
      .map((r) => ({
        controller: r.controller,
        handler: r.handler,
        method: r.method,
        prefix: r.prefix,
        path: r.path,
        guards: r.guards,
        servicePolicy: r.servicePolicy,
      }));
    expect(JSON.parse(JSON.stringify(current))).toEqual(reviewed);
  });
  it('permits only the 13 reviewed method-bound dynamic policies under RolesPermissionsGuard', () => {
    const dynamic = routes.filter(
      (r) =>
        !r.permissions.length &&
        !r.roles.length &&
        r.guards.includes('RolesPermissionsGuard'),
    );
    expect(dynamic).toHaveLength(13);
    for (const r of dynamic) {
      expect(r.guards).toContain('JwtAuthGuard');
      expect(r.guards.indexOf('JwtAuthGuard')).toBeLessThan(
        r.guards.indexOf('RolesPermissionsGuard'),
      );
      expect(SERVICE_AUTHORIZATION_POLICIES).toContain(r.servicePolicy);
      expect(r.calls.length).toBeGreaterThan(0);
    }
  });
  it('keeps every Platform endpoint explicitly permissioned with authentication before its guard', () => {
    const platform = routes.filter((r) => r.guards.includes('PlatformGuard'));
    expect(platform.length).toBeGreaterThan(0);
    for (const r of platform) {
      expect(r.permissions.length).toBeGreaterThan(0);
      expect(r.guards).toContain('JwtAuthGuard');
      expect(r.guards.indexOf('JwtAuthGuard')).toBeLessThan(
        r.guards.indexOf('PlatformGuard'),
      );
    }
  });
  it('does not allow a reviewed service marker to replace permission metadata on other routes', () => {
    expect(
      routes
        .filter((r) => r.servicePolicy)
        .map((r) => `${r.controller}.${r.handler}`),
    ).toEqual(
      reviewed
        .filter((r) => r.servicePolicy)
        .map((r) => `${r.controller}.${r.handler}`),
    );
  });
});
