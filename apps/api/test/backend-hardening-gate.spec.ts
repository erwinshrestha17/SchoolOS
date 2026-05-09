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

      return source.includes('journalEntry.create') && !source.includes('AccountingPostingService');
    });

    expect(suspiciousFiles.map(normalizePath)).toEqual([]);
  });

  it('keeps private file/media endpoints from returning permanent public URLs outside storage boundaries', () => {
    const files = tenantModuleFiles().filter(
      (file) => !isAllowedPath(file, PUBLIC_URL_ALLOWED_PATHS),
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

    const providerCallPattern = /\.(sendEmail|sendSms|sendPushNotification)\s*\(/;
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
});
