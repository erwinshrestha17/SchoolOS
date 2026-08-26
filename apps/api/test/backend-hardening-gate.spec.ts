import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { basename, join, relative } from 'path';

const API_SRC_ROOT = join(__dirname, '..', 'src');

const TENANT_MODULES = [
  'admissions',
  'students',
  'student-records',
  'attendance',
  'finance',
  'activity-feed',
  'communications',
  'notifications',
  'messaging',
  'academics',
  'homework',
  'timetable',
  'staff',
  'payroll',
  'accounting',
  'library',
  'transport',
  'canteen',
  'settings',
  'usage',
  'plans',
];

const ACCOUNTING_BOUNDARY_ALLOWED_PATHS = [
  '/accounting/',
  '/finance/finance-ledger.service.ts',
  '/finance/finance.service.spec.ts',
  '/test/',
];

const PUBLIC_URL_ALLOWED_PATHS = [
  '/storage/',
  '/file-registry/',
  '/activity-feed/activity-media.service.ts',
  '/student-documents/',
  '/test/',
];

function listFiles(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }

  const files: string[] = [];

  for (const entry of readdirSync(root)) {
    if (
      entry === 'node_modules' ||
      entry === 'dist' ||
      entry === 'coverage' ||
      entry === '.turbo'
    ) {
      continue;
    }

    const fullPath = join(root, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...listFiles(fullPath));
    } else if (fullPath.endsWith('.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

function normalizePath(filePath: string) {
  return `/${relative(API_SRC_ROOT, filePath).replace(/\\/g, '/')}`;
}

function read(filePath: string) {
  return readFileSync(filePath, 'utf8');
}

function isAllowedPath(filePath: string, allowed: string[]) {
  const normalized = normalizePath(filePath);
  return allowed.some((allowedPath) => normalized.includes(allowedPath));
}

function tenantModuleFiles() {
  return TENANT_MODULES.flatMap((moduleName) =>
    listFiles(join(API_SRC_ROOT, moduleName)),
  );
}

describe('backend hardening gate', () => {
  it('keeps tenant module controllers behind JWT, RBAC guard, and permissions', () => {
    const controllerFiles = tenantModuleFiles().filter((file) =>
      file.endsWith('.controller.ts'),
    );

    const violations = controllerFiles.filter((file) => {
      const source = read(file);
      const hasPublicMarker = source.includes('@Public()');
      const hasController = source.includes('@Controller');

      if (!hasController || hasPublicMarker) {
        return false;
      }

      return !(
        source.includes('JwtAuthGuard') &&
        source.includes('RolesPermissionsGuard') &&
        source.includes('@UseGuards') &&
        source.includes('@Permissions')
      );
    });

    expect(violations.map(normalizePath)).toEqual([]);
  });

  it('prevents non-accounting modules from writing journal entries directly', () => {
    const files = tenantModuleFiles().filter(
      (file) => !isAllowedPath(file, ACCOUNTING_BOUNDARY_ALLOWED_PATHS),
    );

    const directLedgerWritePattern =
      /prisma\.(journalEntry|journalLine)\.(create|createMany|update|updateMany|delete|deleteMany|upsert)\s*\(/;

    const violations = files.filter((file) =>
      directLedgerWritePattern.test(read(file)),
    );

    expect(violations.map(normalizePath)).toEqual([]);
  });

  it('requires finance/payroll/canteen/library billing modules to use AccountingPostingService for ledger posting', () => {
    const billingModules = ['finance', 'payroll', 'canteen', 'library'];
    const serviceFiles = billingModules.flatMap((moduleName) =>
      listFiles(join(API_SRC_ROOT, moduleName)).filter((file) =>
        file.endsWith('.service.ts'),
      ),
    );

    const suspiciousFiles = serviceFiles.filter((file) => {
      const source = read(file);
      const appearsToPostMoney =
        /post|ledger|journal|payment|receipt|invoice|payroll|wallet|fine/i.test(
          basename(file),
        ) ||
        /post|ledger|journal|payment|receipt|invoice|payroll|wallet|fine/i.test(
          source,
        );

      if (!appearsToPostMoney) {
        return false;
      }

      if (normalizePath(file).includes('/accounting/')) {
        return false;
      }

      return (
        source.includes('journalEntry.create') &&
        !source.includes('AccountingPostingService')
      );
    });

    expect(suspiciousFiles.map(normalizePath)).toEqual([]);
  });

  it('keeps private file/media endpoints from returning permanent public URLs outside storage boundaries', () => {
    const files = tenantModuleFiles().filter(
      (file) =>
        !isAllowedPath(file, PUBLIC_URL_ALLOWED_PATHS) &&
        !file.endsWith('.spec.ts') &&
        !file.endsWith('.test.ts'),
    );

    const permanentPublicUrlPattern =
      /(publicUrl|downloadUrl|previewUrl)\s*[:=]\s*[`'\"]https?:\/\//;

    const violations = files.filter((file) =>
      permanentPublicUrlPattern.test(read(file)),
    );

    expect(violations.map(normalizePath)).toEqual([]);
  });

  it('keeps controllers free from direct notification provider calls', () => {
    const controllerFiles = tenantModuleFiles().filter((file) =>
      file.endsWith('.controller.ts'),
    );

    const providerCallPattern =
      /\.(sendEmail|sendSms|sendPushNotification)\s*\(/;
    const violations = controllerFiles.filter((file) =>
      providerCallPattern.test(read(file)),
    );

    expect(violations.map(normalizePath)).toEqual([]);
  });

  it('requires sensitive tenant modules to keep audit service references for business-critical writes', () => {
    const sensitiveModules = [
      'students',
      'student-records',
      'attendance',
      'finance',
      'activity-feed',
      'communications',
      'homework',
      'timetable',
      'staff',
      'payroll',
      'accounting',
      'transport',
      'canteen',
    ];

    const serviceFiles = sensitiveModules.flatMap((moduleName) =>
      listFiles(join(API_SRC_ROOT, moduleName)).filter(
        (file) =>
          file.endsWith('.service.ts') &&
          !file.endsWith('.spec.ts') &&
          !basename(file).includes('read-only'),
      ),
    );

    const writePattern =
      /prisma\.[a-zA-Z0-9_]+\.(create|createMany|update|updateMany|delete|deleteMany|upsert)\s*\(/;

    const violations = serviceFiles.filter((file) => {
      const source = read(file);
      return writePattern.test(source) && !source.includes('AuditService');
    });

    expect(violations.map(normalizePath)).toEqual([]);
  });

  it('requires BullMQ processors to run under runTenantScopedJob', () => {
    const processorFiles = listFiles(API_SRC_ROOT).filter(
      (file) => file.endsWith('.processor.ts') && !file.endsWith('.spec.ts'),
    );

    const violations = processorFiles.filter(
      (file) => !read(file).includes('runTenantScopedJob'),
    );

    expect(violations.map(normalizePath)).toEqual([]);
  });

  it('keeps cron user lookups inside a tenant scope helper', () => {
    const cronFiles = listFiles(API_SRC_ROOT).filter((file) =>
      file.endsWith('.cron.ts'),
    );

    const violations = cronFiles.filter((file) => {
      const source = read(file);
      if (
        !source.includes('user.findFirst') &&
        !source.includes('user.findMany')
      ) {
        return false;
      }

      return (
        !source.includes('runWithTenantScope') &&
        !source.includes('runWithoutTenantScope')
      );
    });

    expect(violations.map(normalizePath)).toEqual([]);
  });

  it('inventories TENANT_SCOPE_EXCLUDED_MODELS as platform/global reference data only', () => {
    const source = read(join(API_SRC_ROOT, 'prisma', 'prisma.service.ts'));
    const match = source.match(
      /export const TENANT_SCOPE_EXCLUDED_MODELS = \[([\s\S]*?)\];/,
    );

    expect(match).not.toBeNull();

    const models = (match?.[1] ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith("'"))
      .map((line) => line.replace(/',?$/, '').replace(/^'/, ''));

    expect(models).toEqual([
      'Tenant',
      'Permission',
      'RefreshToken',
      'OtpCode',
      'RolePermission',
      'ProviderConfig',
      'PlatformPlan',
      'PlatformPlanFeature',
      'NepalProvince',
      'NepalDistrict',
      'NepalLocalLevelType',
      'NepalLocalLevel',
      'ReferenceDatasetVersion',
    ]);
  });

  it('keeps runWithoutTenantScope on an inventoried allowlist with a stated reason', () => {
    const allowlist = new Set([
      '/tenants/tenants.service.ts',
      '/finance/finance.cron.ts',
      '/audit/audit.service.ts',
      '/platform/platform-billing-lifecycle.service.ts',
      '/auth/authz-cache.service.ts',
      '/auth/auth.service.ts',
      '/students/student-document-retention.cron.ts',
      '/platform/platform.service.ts',
      '/auth/guards/jwt-auth.guard.ts',
      '/homework/homework.cron.ts',
      '/communications/notice-lifecycle.cron.ts',
    ]);
    const expectedReasons = [
      'audit: append with caller-supplied tenantId, including pre-authentication events',
      'authenticate: resolve a purpose-limited support override before target tenant context exists',
      'authenticate: resolve token subject before tenant context exists',
      'authentication: read home identity while presenting an effective support tenant',
      'authentication: user lookup before tenant context is established',
      'authorize: resolve role/permission set while establishing tenant context',
      'daily fee due-schedule sweep across all tenants',
      'daily homework reminder sweep across all active tenants',
      'notice lifecycle: discover tenants with due notices',
      'platform billing lifecycle across all tenants',
      'platform dashboard: aggregate authorized SaaS invoice balances',
      'platform dashboard: aggregate authorized subscription lifecycle counts',
      'platform dashboard: correlate authorized tenant usage with subscription limits',
      'platform: issue purpose-limited support override for target tenant',
      'platform: provision a new school tenant and its first administrator',
      'platform: read purpose-limited support override history',
      'platform: revoke purpose-limited support override with audit',
      'student document retention and expiry review across all tenants',
    ];

    const productionFiles = listFiles(API_SRC_ROOT).filter(
      (file) => !file.endsWith('.spec.ts') && !file.endsWith('.test.ts'),
    );
    const uninventoried: string[] = [];
    const missingReason: string[] = [];
    const foundReasons: string[] = [];

    for (const file of productionFiles) {
      const source = read(file);
      if (!/this\.prisma\.runWithoutTenantScope\s*\(/.test(source)) {
        continue;
      }

      const normalized = normalizePath(file);
      if (!allowlist.has(normalized)) {
        uninventoried.push(normalized);
      }

      const reasons = [
        ...source.matchAll(
          /this\.prisma\.runWithoutTenantScope\(\s*'([^']+)'/g,
        ),
      ].map((match) => match[1]);
      const callCount = [
        ...source.matchAll(/this\.prisma\.runWithoutTenantScope\s*\(/g),
      ].length;

      if (reasons.length !== callCount) {
        missingReason.push(normalized);
      }

      foundReasons.push(...reasons);
    }

    expect(uninventoried).toEqual([]);
    expect(missingReason).toEqual([]);
    expect([...new Set(foundReasons)].sort()).toEqual(expectedReasons);
  });

  it('enforces teacher assignment at attendance, homework, marks, and file-registry writes', () => {
    expect(
      read(join(API_SRC_ROOT, 'attendance', 'attendance.service.ts')),
    ).toContain('canActorAccess');
    expect(
      read(join(API_SRC_ROOT, 'homework', 'homework.service.ts')),
    ).toContain('requireActorAccess');
    expect(read(join(API_SRC_ROOT, 'academics', 'marks.service.ts'))).toContain(
      'requireActorAccess',
    );
    expect(
      read(join(API_SRC_ROOT, 'file-registry', 'file-registry.service.ts')),
    ).toContain('requireActorAccess');
  });
});
