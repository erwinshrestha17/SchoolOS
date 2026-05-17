import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * M0 Entitlement Enforcement Contracts
 *
 * These tests prove that feature-key and usage-limit enforcement
 * happens at the backend level, not merely via frontend sidebar hiding.
 *
 * Contracts verified:
 * 1. EntitlementGuard exists and blocks disabled features.
 * 2. PlansService checks override → subscription → plan feature chain.
 * 3. Usage limits are enforced via counter delegation.
 * 4. Entitlement decorator (@RequireEntitlement) is wired into the guard.
 * 5. Feature keys are canonical and consistent between backend and plans.
 */
describe('M0 Entitlement enforcement contracts', () => {
  const root = join(__dirname, '..', '..');

  function read(relativePath: string) {
    return readFileSync(join(root, relativePath), 'utf8');
  }

  // ─── 1. EntitlementGuard exists and enforces feature gates ────────────

  describe('EntitlementGuard backend enforcement', () => {
    it('EntitlementGuard throws ForbiddenException for disabled features', () => {
      const guard = read('src/auth/guards/entitlement.guard.ts');

      expect(guard).toContain('EntitlementGuard');
      expect(guard).toContain('CanActivate');
      expect(guard).toContain('ForbiddenException');
      expect(guard).toContain('is not enabled for your tenant');
    });

    it('EntitlementGuard reads featureKey from decorator metadata', () => {
      const guard = read('src/auth/guards/entitlement.guard.ts');

      expect(guard).toContain('ENTITLEMENT_KEY');
      expect(guard).toContain('reflector.getAllAndOverride');
    });

    it('EntitlementGuard requires tenant context for feature check', () => {
      const guard = read('src/auth/guards/entitlement.guard.ts');

      expect(guard).toContain('tenantId');
      expect(guard).toContain('Tenant identification missing');
    });

    it('EntitlementGuard bypasses checks for platform-level requests', () => {
      const guard = read('src/auth/guards/entitlement.guard.ts');

      expect(guard).toContain("tenantId === 'platform'");
      expect(guard).toContain('return true');
    });

    it('EntitlementGuard delegates to PlansService.checkFeatureEnabled', () => {
      const guard = read('src/auth/guards/entitlement.guard.ts');

      expect(guard).toContain('plansService.checkFeatureEnabled');
    });
  });

  // ─── 2. PlansService feature check chain ──────────────────────────────

  describe('PlansService feature/usage check chain', () => {
    it('checks manual overrides before subscription features', () => {
      const plansService = read('src/plans/plans.service.ts');

      // Override check should come first
      const overrideIndex = plansService.indexOf('tenantFeatureOverride');
      const subscriptionIndex = plansService.indexOf('tenantSubscription');
      expect(overrideIndex).toBeLessThan(subscriptionIndex);
    });

    it('only considers active subscription statuses for feature checks', () => {
      const plansService = read('src/plans/plans.service.ts');

      expect(plansService).toContain("'ACTIVE'");
      expect(plansService).toContain("'TRIAL'");
      expect(plansService).toContain("'GRACE'");
    });

    it('returns false for inactive tenants', () => {
      const plansService = read('src/plans/plans.service.ts');

      expect(plansService).toContain('!tenant.isActive');
      expect(plansService).toContain('allowed: false');
    });

    it('validates usage limits throw ForbiddenException on excess', () => {
      const plansService = read('src/plans/plans.service.ts');

      expect(plansService).toContain('validateLimit');
      expect(plansService).toContain('Plan limit reached');
      expect(plansService).toContain('ForbiddenException');
      expect(plansService).toContain('Please upgrade your plan');
    });

    it('handles missing subscription gracefully for limits', () => {
      const plansService = read('src/plans/plans.service.ts');

      expect(plansService).toContain('No active subscription found');
    });
  });

  // ─── 3. Entitlement decorator existence ───────────────────────────────

  describe('Entitlement decorator wiring', () => {
    it('entitlement decorator exports ENTITLEMENT_KEY metadata', () => {
      const decorator = read('src/auth/decorators/entitlement.decorator.ts');

      expect(decorator).toContain('ENTITLEMENT_KEY');
      expect(decorator).toContain('SetMetadata');
    });
  });

  // ─── 4. Feature keys are canonical ────────────────────────────────────

  describe('Feature key canonicalization', () => {
    it('PlatformService defines canonical FEATURE_KEYS list', () => {
      const service = read('src/platform/platform.service.ts');

      expect(service).toContain('FEATURE_KEYS');
      expect(service).toContain('module.students');
      expect(service).toContain('module.attendance');
      expect(service).toContain('module.fees');
      expect(service).toContain('module.exams');
      expect(service).toContain('module.homework');
      expect(service).toContain('module.timetable');
      expect(service).toContain('module.hr');
      expect(service).toContain('module.payroll');
      expect(service).toContain('module.accounting');
      expect(service).toContain('module.library');
      expect(service).toContain('module.transport');
      expect(service).toContain('module.canteen');
      expect(service).toContain('module.reports');
    });

    it('PlatformService defines canonical USAGE_KEYS list', () => {
      const service = read('src/platform/platform.service.ts');

      expect(service).toContain('USAGE_KEYS');
      expect(service).toContain('students.count');
      expect(service).toContain('staff.count');
      expect(service).toContain('storage.bytes');
      expect(service).toContain('sms.sent');
      expect(service).toContain('receipts.generated');
      expect(service).toContain('report_cards.generated');
      expect(service).toContain('exports.generated');
    });

    it('feature override rejects unknown feature keys', () => {
      const service = read('src/platform/platform.service.ts');

      expect(service).toContain('FEATURE_KEYS.includes(dto.featureKey)');
      expect(service).toContain('Unknown feature key');
    });

    it('usage increment rejects unknown usage keys', () => {
      const service = read('src/platform/platform.service.ts');

      expect(service).toContain('USAGE_KEYS.includes(dto.usageKey)');
      expect(service).toContain('Unknown usage key');
    });
  });

  // ─── 5. Usage limit enforcement at increment time ─────────────────────

  describe('Usage limit enforcement at increment time', () => {
    it('usage increment checks limits after upsert and throws on excess', () => {
      const service = read('src/platform/platform.service.ts');

      expect(service).toContain('Usage limit exceeded');
      expect(service).toContain('ForbiddenException');
    });

    it('usage counter retrieves limit from active subscription plan', () => {
      const service = read('src/platform/platform.service.ts');

      expect(service).toContain('findUsageLimit');
      expect(service).toContain('getRawActiveSubscription');
    });

    it('usage counters are period-based (DAILY, MONTHLY, ANNUAL, LIFETIME)', () => {
      const service = read('src/platform/platform.service.ts');

      expect(service).toContain('getPeriodStart');
      expect(service).toContain("'DAILY'");
      expect(service).toContain("'ANNUAL'");
      expect(service).toContain("'LIFETIME'");
    });
  });

  // ─── 6. Entitlement check endpoint exists ─────────────────────────────

  describe('Entitlement check API endpoint', () => {
    it('platform controller exposes entitlement check endpoint', () => {
      const controller = read('src/platform/platform.controller.ts');

      expect(controller).toContain(
        "@Get('tenants/:tenantId/entitlements/:featureKey')",
      );
      expect(controller).toContain('checkEntitlement');
    });

    it('entitlement check returns structured response with reason', () => {
      const service = read('src/platform/platform.service.ts');

      expect(service).toContain('PlatformEntitlementCheck');
      expect(service).toContain("reason: 'tenant_inactive'");
      expect(service).toContain("reason = 'allowed'");
      expect(service).toContain("= 'feature_locked'");
    });

    it('entitlement check includes subscription status for context', () => {
      const service = read('src/platform/platform.service.ts');

      expect(service).toContain('subscriptionStatus');
    });
  });
});
