import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * DEF-06 static regression gate: every school-operations controller must either
 * carry EntitlementGuard with a module declaration, or be explicitly exempt.
 */
describe('Entitlement coverage contract (DEF-06)', () => {
  const srcRoot = join(__dirname, '..', '..');

  const PERMANENTLY_EXEMPT = new Set([
    'AppController',
    'AuthController',
    'DemoRequestsController',
    'PaymentsWebhookController',
    'GradesController',
    'PlatformController',
    'OperationalPlatformSummaryController',
    'DemoRequestsPlatformController',
    'TenantsController',
    'MeController',
    'GeographyController',
    'SettingsController',
    'SchoolSettingsWorkspaceController',
    'UsersController',
    'RolesController',
    'OperationalDashboardSummaryController',
    'FileRegistryController',
  ]);

  const DEFERRED_GAPS = new Set([
    'ServiceRequestsController',
    'ApprovalWorkflowController',
    'AutomationEngineController',
    'DataExportCenterController',
    'DescriptiveAnalyticsController',
    'DocumentTemplateController',
  ]);

  function listControllerFiles(dir: string): string[] {
    const entries = readdirSync(dir);
    const files: string[] = [];
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        files.push(...listControllerFiles(fullPath));
      } else if (entry.endsWith('.controller.ts')) {
        files.push(fullPath);
      }
    }
    return files;
  }

  function extractControllerClasses(source: string): string[] {
    const matches = source.matchAll(/export class (\w+Controller)/g);
    return [...matches].map((match) => match[1]);
  }

  function hasEntitlementGuard(source: string): boolean {
    return source.includes('EntitlementGuard');
  }

  function hasEntitlementDeclaration(source: string): boolean {
    return (
      source.includes('@Entitlement(') ||
      source.includes('@RequiredModule(') ||
      source.includes('@RequiredFeature(') ||
      source.includes('@NoModuleEntitlement(')
    );
  }

  const controllerFiles = listControllerFiles(srcRoot);

  it('discovers every controller file under src/', () => {
    expect(controllerFiles.length).toBeGreaterThanOrEqual(100);
  });

  describe('controllers with EntitlementGuard must declare a module or opt out', () => {
    const violations: string[] = [];

    for (const filePath of controllerFiles) {
      const relativePath = filePath.replace(`${srcRoot}/`, '');
      const source = readFileSync(filePath, 'utf8');
      const classes = extractControllerClasses(source);

      for (const className of classes) {
        if (!hasEntitlementGuard(source)) {
          continue;
        }
        if (!hasEntitlementDeclaration(source)) {
          violations.push(`${relativePath} (${className})`);
        }
      }
    }

    it('has no EntitlementGuard without a declaration decorator', () => {
      expect(violations).toEqual([]);
    });
  });

  describe('non-exempt controllers must carry EntitlementGuard', () => {
    const violations: string[] = [];

    for (const filePath of controllerFiles) {
      const relativePath = filePath.replace(`${srcRoot}/`, '');
      const source = readFileSync(filePath, 'utf8');
      const classes = extractControllerClasses(source);

      for (const className of classes) {
        if (PERMANENTLY_EXEMPT.has(className) || DEFERRED_GAPS.has(className)) {
          continue;
        }
        if (!hasEntitlementGuard(source)) {
          violations.push(`${relativePath} (${className})`);
        }
      }
    }

    it('requires EntitlementGuard on all non-exempt school-operations controllers', () => {
      expect(violations).toEqual([]);
    });
  });

  it('documents the deferred entitlement gaps that remain out of scope for DEF-06', () => {
    expect([...DEFERRED_GAPS].sort()).toEqual([
      'ApprovalWorkflowController',
      'AutomationEngineController',
      'DataExportCenterController',
      'DescriptiveAnalyticsController',
      'DocumentTemplateController',
      'ServiceRequestsController',
    ]);
  });
});
