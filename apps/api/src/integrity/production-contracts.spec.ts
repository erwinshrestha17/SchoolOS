import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';
import ts from 'typescript';
import {
  PERMISSION_CATALOG,
  SYSTEM_ROLE_DEFINITIONS,
  SYSTEM_ROLE_PERMISSIONS,
  buildPermissionKey,
} from '../rbac/rbac.defaults';
import { applyTenantScopeToArgs } from '../prisma/prisma.service';

const sourceRoot = resolve(__dirname, '..');
const workspaceRoot = resolve(sourceRoot, '..', '..', '..');
const corePermissions = loadCorePermissions();
const immutablePrismaModels = ['journalEntry', 'journalLine', 'receipt'];
const immutableMutationPattern = new RegExp(
  `\\.(${immutablePrismaModels.join('|')})\\.(update|updateMany|delete|deleteMany|upsert)\\b`,
);

function permissionKeys(
  catalog: readonly { resource: string; action: string }[],
) {
  return catalog
    .map(({ resource, action }) => buildPermissionKey(resource, action))
    .sort();
}

function sortedRolePermissions(rolePermissions: Record<string, string[]>) {
  return Object.fromEntries(
    Object.entries(rolePermissions)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([role, permissions]) => [role, [...permissions].sort()]),
  );
}

function readSourceFiles(
  dir = sourceRoot,
): Array<{ path: string; content: string }> {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      return readSourceFiles(fullPath);
    }

    if (!fullPath.endsWith('.ts') || fullPath.endsWith('.spec.ts')) {
      return [];
    }

    return [{ path: fullPath, content: readFileSync(fullPath, 'utf8') }];
  });
}

function loadCorePermissions() {
  const source = readFileSync(
    join(workspaceRoot, 'packages/core/src/permissions.ts'),
    'utf8',
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2023,
    },
  }).outputText;
  const module = { exports: {} as Record<string, unknown> };

  new Function('exports', 'module', compiled)(module.exports, module);

  return module.exports as {
    permissionCatalog: readonly { resource: string; action: string }[];
    systemRoleDefinitions: readonly { name: string }[];
    systemRolePermissions: Record<string, string[]>;
  };
}

describe('production data integrity contracts', () => {
  it('keeps API and shared permission catalogs in lockstep', () => {
    expect(permissionKeys(PERMISSION_CATALOG)).toEqual(
      permissionKeys(corePermissions.permissionCatalog),
    );
    expect(SYSTEM_ROLE_DEFINITIONS.map((role) => role.name).sort()).toEqual(
      corePermissions.systemRoleDefinitions.map((role) => role.name).sort(),
    );
    expect(sortedRolePermissions(SYSTEM_ROLE_PERMISSIONS)).toEqual(
      sortedRolePermissions(corePermissions.systemRolePermissions),
    );
  });

  it('only references permissions that exist in the backend catalog', () => {
    const catalog = new Set(permissionKeys(PERMISSION_CATALOG));
    const sourceFiles = readSourceFiles();
    const usedPermissions = sourceFiles.flatMap(({ content }) =>
      Array.from(content.matchAll(/@Permissions\(([\s\S]*?)\)/g)).flatMap(
        (match) =>
          Array.from(match[1].matchAll(/'([^']+)'/g)).map(
            (permission) => permission[1],
          ),
      ),
    );

    expect(usedPermissions.length).toBeGreaterThan(0);
    expect(
      usedPermissions.filter((permission) => !catalog.has(permission)),
    ).toEqual([]);
  });

  it('requires explicit permission metadata on write routes', () => {
    const controllerFiles = readSourceFiles().filter(
      ({ path, content }) =>
        path.endsWith('.controller.ts') &&
        content.includes('@UseGuards(JwtAuthGuard, RolesPermissionsGuard)'),
    );
    const missingPermissionRoutes = controllerFiles.flatMap(
      ({ path, content }) =>
        Array.from(content.matchAll(/@(Post|Patch|Put|Delete)\([^)]*\)/g))
          .map((match) => {
            const segment = content.slice(match.index, match.index + 500);

            return {
              path: relative(sourceRoot, path),
              route: match[0],
              hasPermissions: segment.includes('@Permissions('),
            };
          })
          .filter((route) => !route.hasPermissions),
    );

    expect(missingPermissionRoutes).toEqual([]);
  });

  it('keeps core write services wired to audit logging', () => {
    const auditedServices = [
      'academic-years/academic-years.service.ts',
      'academics/academics.service.ts',
      'accounting/accounting.service.ts',
      'activity-feed/activity-feed.service.ts',
      'admissions/admissions.service.ts',
      'attendance/attendance.service.ts',
      'classes/classes.service.ts',
      'communications/communications.service.ts',
      'finance/finance.service.ts',
      'library/library.service.ts',
      'messaging/messaging.service.ts',
      'payroll/payroll.service.ts',
      'roles/roles.service.ts',
      'sections/sections.service.ts',
      'staff/staff.service.ts',
      'student-records/student-records.service.ts',
      'students/students.service.ts',
      'tenants/tenants.service.ts',
      'timetable/timetable.service.ts',
      'transport/transport.service.ts',
      'users/users.service.ts',
    ];

    const missingAuditCalls = auditedServices.filter((servicePath) => {
      const content = readFileSync(join(sourceRoot, servicePath), 'utf8');
      return !content.includes('auditService.record');
    });

    expect(missingAuditCalls).toEqual([]);
  });

  it('prevents direct mutation of immutable accounting artifacts', () => {
    const offenders = readSourceFiles()
      .filter(({ content }) => immutableMutationPattern.test(content))
      .map(({ path }) => relative(sourceRoot, path));

    expect(offenders).toEqual([]);
  });

  it('rejects unsafe production any casts in source code', () => {
    const unsafeAnyPattern =
      /\bas any\b|Record<string,\s*any>|Job<any|:\s*any\b/;
    const offenders = readSourceFiles()
      .filter(({ content }) => unsafeAnyPattern.test(content))
      .map(({ path }) => relative(sourceRoot, path));

    expect(offenders).toEqual([]);
  });

  it('applies tenant scope to Prisma reads and writes', () => {
    expect(
      applyTenantScopeToArgs(
        'Student',
        'findMany',
        { where: { status: 'ACTIVE' } },
        'tenant-a',
      ),
    ).toEqual({ where: { status: 'ACTIVE', tenantId: 'tenant-a' } });

    expect(
      applyTenantScopeToArgs(
        'Student',
        'createMany',
        { data: [{ firstNameEn: 'A' }, { firstNameEn: 'B' }] },
        'tenant-a',
      ),
    ).toEqual({
      data: [
        { firstNameEn: 'A', tenantId: 'tenant-a' },
        { firstNameEn: 'B', tenantId: 'tenant-a' },
      ],
    });

    expect(
      applyTenantScopeToArgs(
        'Tenant',
        'findMany',
        { where: { slug: 'default-school' } },
        'tenant-a',
      ),
    ).toEqual({ where: { slug: 'default-school' } });
  });

  it('seeds request tenant context at the authentication boundary', () => {
    const guardSource = readFileSync(
      join(sourceRoot, 'auth/guards/jwt-auth.guard.ts'),
      'utf8',
    );
    expect(guardSource).toContain('TENANT_ID_KEY');
    expect(guardSource).toContain('this.cls.set(TENANT_ID_KEY');
  });

  it('registers the fee collection report with proper permissions and audit logging', () => {
    const reportsService = readFileSync(
      join(sourceRoot, 'reports/reports.service.ts'),
      'utf8',
    );

    expect(reportsService).toContain("key: 'fee-collection-report'");
    expect(reportsService).toContain(
      "requiredPermissions: ['reports:export', 'ledger:read']",
    );
    expect(reportsService).toContain('this.auditService.record({');
    expect(reportsService).toContain('resourceId: reportKey');
  });
});
