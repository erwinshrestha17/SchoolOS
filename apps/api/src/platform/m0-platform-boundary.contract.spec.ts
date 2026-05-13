import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * M0 Platform Boundary Hardening – Route-Denial Contracts
 *
 * These tests guarantee the platform/school separation contract:
 * 1. School-role users cannot access /platform/* routes.
 * 2. Platform users are restricted by granular permissions.
 * 3. Tenant-affecting platform operations require audited reasons.
 * 4. No platform endpoint leaks without proper guards.
 */
describe('M0 Platform/School boundary – route denial contracts', () => {
  const root = join(__dirname, '..', '..');

  function read(relativePath: string) {
    return readFileSync(join(root, relativePath), 'utf8');
  }

  // ─── 1. School Users Denied from Platform Routes ──────────────────────

  describe('School users must be denied from /platform/* routes', () => {
    it('PlatformGuard rejects non-platform roles with ForbiddenException', () => {
      const guard = read('src/auth/guards/platform.guard.ts');

      // Guard must check platform role membership
      expect(guard).toContain('platform_super_admin');
      expect(guard).toContain('platform_support');
      expect(guard).toContain('platform_billing_admin');
      expect(guard).toContain('ForbiddenException');
      expect(guard).toContain(
        'Access restricted to platform administrators only',
      );
    });

    it('PlatformGuard import exists in platform controller', () => {
      const controller = read('src/platform/platform.controller.ts');
      expect(controller).toContain('import { PlatformGuard }');
      expect(controller).toContain('@UseGuards(JwtAuthGuard, PlatformGuard)');
    });

    it('school-level role definitions do not contain platform permission keys', () => {
      const permissions = read('../../packages/core/src/permissions.ts');
      const schoolRoles = [
        'admin',
        'teacher',
        'principal',
        'accountant',
        'librarian',
        'driver',
        'student',
        'parent',
      ];

      for (const role of schoolRoles) {
        const roleRegex = new RegExp(`${role}:\\s*\\[([\\s\\S]*?)\\]`, 'm');
        const match = permissions.match(roleRegex);
        if (match) {
          const rolePermissions = match[1];
          expect(rolePermissions).not.toContain('platform:manage');
          expect(rolePermissions).not.toContain('platform:tenants:status');
          expect(rolePermissions).not.toContain('platform:billing:manage');
          expect(rolePermissions).not.toContain('platform:providers:manage');
          expect(rolePermissions).not.toContain('platform:queues:retry');
        }
      }
    });

    it('TENANT_PERMISSION_KEYS do not include platform permissions', () => {
      const permissions = read('../../packages/core/src/permissions.ts');

      expect(permissions).toContain('TENANT_PERMISSION_KEYS');
      expect(permissions).toContain('!PLATFORM_PERMISSION_KEYS.includes(key)');
    });
  });

  // ─── 2. Platform Controller Guard Completeness ────────────────────────

  describe('all platform controller methods are guarded', () => {
    it('controller-level @UseGuards covers all endpoints via class decorator', () => {
      const controller = read('src/platform/platform.controller.ts');

      // Class-level guard ensures every method is protected
      const classGuardMatch = controller.match(
        /@UseGuards\(JwtAuthGuard,\s*PlatformGuard\)\s*\nexport class PlatformController/,
      );
      expect(
        classGuardMatch ||
          controller.includes(
            '@UseGuards(JwtAuthGuard, PlatformGuard)\nexport class PlatformController',
          ),
      ).toBeTruthy();
    });

    it('every public method has a @Permissions decorator', () => {
      const controller = read('src/platform/platform.controller.ts');

      // Extract method declarations via HTTP decorators
      const httpMethods = controller.match(/@(Get|Post|Patch|Put|Delete)\(/g);
      const permissionDecorators = controller.match(/@Permissions\(/g);

      expect(httpMethods).not.toBeNull();
      expect(permissionDecorators).not.toBeNull();

      // Every HTTP method should have a corresponding permission
      expect(permissionDecorators!.length).toBe(httpMethods!.length);
    });
  });

  // ─── 3. Platform Guard Permission Enforcement ─────────────────────────

  describe('platform guard enforces granular permissions for non-super-admin roles', () => {
    it('platform_super_admin bypasses permission checks (full access)', () => {
      const guard = read('src/auth/guards/platform.guard.ts');
      expect(guard).toContain('isPlatformAdmin');
      expect(guard).toContain('return true');
    });

    it('platform_support and platform_billing_admin require matching permissions', () => {
      const guard = read('src/auth/guards/platform.guard.ts');
      expect(guard).toContain('requiredPermissions');
      expect(guard).toContain('hasAllPermissions');
      expect(guard).toContain('Insufficient platform permissions');
    });

    it('platform_support has read-only permissions, no mutation rights', () => {
      const permissions = read('../../packages/core/src/permissions.ts');

      // platform_support should have only read/view permissions
      const supportMatch = permissions.match(
        /platform_support:\s*\[([\s\S]*?)\]/,
      );
      expect(supportMatch).not.toBeNull();

      const supportPermissions = supportMatch![1];
      expect(supportPermissions).not.toContain('manage');
      expect(supportPermissions).not.toContain('retry');
      expect(supportPermissions).not.toContain('status');
    });

    it('platform_billing_admin has billing permissions but no queue/provider mutation', () => {
      const permissions = read('../../packages/core/src/permissions.ts');

      const billingMatch = permissions.match(
        /platform_billing_admin:\s*\[([\s\S]*?)\]/,
      );
      expect(billingMatch).not.toBeNull();

      const billingPermissions = billingMatch![1];
      expect(billingPermissions).toContain('platform:billing:manage');
      expect(billingPermissions).toContain('platform:subscriptions:manage');
      expect(billingPermissions).not.toContain('platform:providers:manage');
      expect(billingPermissions).not.toContain('platform:queues:retry');
    });
  });

  // ─── 4. Tenant-Affecting Operations Require Audited Reasons ───────────

  describe('tenant-affecting platform operations require audited reasons', () => {
    it('tenant status change requires reason with minimum length', () => {
      const dto = read('src/platform/dto/update-platform-tenant-status.dto.ts');
      const service = read('src/platform/platform.service.ts');

      expect(dto).toContain('reason');
      expect(dto).toContain('@MinLength(5)');
      expect(service).toContain('Tenant status changes require a reason');
    });

    it('tenant status changes produce distinct audit actions', () => {
      const service = read('src/platform/platform.service.ts');

      expect(service).toContain('tenant_activated');
      expect(service).toContain('tenant_suspended');
      expect(service).toContain('tenant_status_noop');
    });

    it('platform audit records use platform tenantId, not school tenantId', () => {
      const service = read('src/platform/platform.service.ts');
      expect(service).toContain("tenantId: 'platform'");
    });

    it('subscription status changes are audited', () => {
      const service = read('src/platform/platform.service.ts');
      expect(service).toContain('tenant_subscription_status_updated');
      expect(service).toContain('tenant_subscription_assigned');
    });

    it('feature override changes are audited', () => {
      const service = read('src/platform/platform.service.ts');
      expect(service).toContain('tenant_feature_override_updated');
    });

    it('SaaS invoice lifecycle actions are audited', () => {
      const service = read('src/platform/platform.service.ts');
      expect(service).toContain('saas_invoice_created');
      expect(service).toContain('saas_payment_recorded');
      expect(service).toContain('saas_invoice_cancelled');
    });

    it('queue retry operations are audited', () => {
      const queuesService = read('src/platform/platform-queues.service.ts');
      expect(queuesService).toContain('queue_failed_job_retry_requested');
    });

    it('onboarding overrides are audited', () => {
      const service = read('src/platform/platform.service.ts');
      expect(service).toContain('onboarding_override_updated');
    });

    it('provider config changes are audited', () => {
      const service = read('src/platform/platform.service.ts');
      expect(service).toContain('provider_config_updated');
    });
  });

  // ─── 5. Frontend Boundary Enforcement ─────────────────────────────────

  describe('frontend enforces platform/school route separation', () => {
    it('platform layout requires platform role check before rendering', () => {
      const layout = read('../web/app/platform/layout.tsx');

      expect(layout).toContain('PLATFORM_ROLES');
      expect(layout).toContain('platform_super_admin');
      expect(layout).toContain('platform_support');
      expect(layout).toContain('platform_billing_admin');
    });

    it('non-platform users are redirected to dashboard', () => {
      const layout = read('../web/app/platform/layout.tsx');

      expect(layout).toContain("router.push('/dashboard')");
    });

    it('frontend platform API calls use /platform/ prefix consistently', () => {
      const api = read('../web/lib/api.ts');

      // All platform API methods must use /platform/ prefix
      const platformMethods = [
        '/platform/dashboard',
        '/platform/tenants',
        '/platform/plans',
        '/platform/providers',
        '/platform/queues',
        '/platform/health',
        '/platform/report-exports',
        '/platform/audit-logs',
      ];

      for (const path of platformMethods) {
        expect(api).toContain(path);
      }
    });
  });
});
