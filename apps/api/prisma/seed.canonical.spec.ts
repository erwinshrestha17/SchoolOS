import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('canonical development seed', () => {
  const source = readFileSync(join(__dirname, 'seed.ts'), 'utf8');
  const platformSource = readFileSync(
    join(__dirname, 'platform-seed.ts'),
    'utf8',
  );
  const platformE2eSource = readFileSync(
    join(__dirname, 'seed-m0-platform-e2e.ts'),
    'utf8',
  );

  it('keeps the Everest Academy Class 1-12 distribution deterministic', () => {
    const expectedCounts = [
      ["'Class 1'", 'A: 28, B: 30'],
      ["'Class 2'", 'A: 29, B: 32'],
      ["'Class 3'", 'A: 27, B: 30'],
      ["'Class 4'", 'A: 31, B: 28'],
      ["'Class 5'", 'A: 30, B: 33'],
      ["'Class 6'", 'A: 29, B: 31'],
      ["'Class 7'", 'A: 27, B: 34'],
      ["'Class 8'", 'A: 32, B: 28'],
      ["'Class 9'", 'A: 31, B: 30'],
      ["'Class 10'", 'A: 29, B: 32'],
      ["'Class 11'", 'A: 24, B: 22'],
      ["'Class 12'", 'A: 22, B: 20'],
    ];

    expect(source).toContain('name: `Class ${index + 1}`');
    expect(source).toContain('const expectedCanonicalStudentCount = 689');
    for (const [className, counts] of expectedCounts) {
      expect(source).toContain(`${className}: { ${counts} }`);
    }
    expect(source).not.toContain('Math.random');
  });

  it('uses idempotent central seed writes for canonical identity and operations data', () => {
    expect(source).toContain('prisma.student.upsert');
    expect(source).toContain('prisma.guardian.findFirst');
    expect(source).toContain('prisma.guardian.create');
    expect(source).toContain('prisma.studentGuardian.upsert');
    expect(source).toContain('prisma.enrollment.findFirst');
    expect(source).toContain('prisma.enrollment.create');
    expect(source).toContain('prisma.subjectTeacherAssignment.findMany');
    expect(source).toContain('prisma.timetableSlot.findFirst');
    expect(source).toContain('prisma.attendanceRecord.upsert');
    expect(source).toContain('prisma.homeworkAssignment.create');
    expect(source).toContain('prisma.invoice.upsert');
    expect(source).toContain('prisma.staffAttendance.upsert');
    expect(source).toContain('prisma.payslip.upsert');
    expect(source).toContain('prisma.transportStudentAssignment.findFirst');
    expect(source).toContain('prisma.tenantFeatureOverride.upsert');
    expect(source).toContain('prisma.auditLog.findFirst');
  });

  it('has production and credential-output guardrails', () => {
    expect(source).toContain("process.env.NODE_ENV === 'production'");
    expect(source).toContain('Refusing to run development seed');
    expect(source).toContain('schoolos-local-demo-only');
    expect(source).toContain("roleName: 'support_staff'");
    expect(source).toContain("'module.payroll'");
    expect(source).toContain('driver.south@schoolos.com');
    expect(source).toContain('guardian.c01a001@schoolos.test');
    expect(source).toContain('guardian.c10b032@schoolos.test');
    expect(source).toContain('printRepresentativeCredentials');
    for (const legacyPassword of [
      'principal123',
      'admin123',
      'accountant123',
      'guardian123',
      'teacher123',
      'driver123',
      'staff123',
      'platform123',
    ]) {
      expect(source).not.toContain(legacyPassword);
    }
  });

  it('preserves changed demo credentials during routine reseeds', () => {
    expect(source).toContain('SCHOOLOS_DEMO_RESET_CREDENTIALS_ON_SEED');
    expect(source).toContain('resetDemoCredentialsOnSeed');
    expect(source).toContain('...(resetDemoCredentialsOnSeed');
    expect(platformSource).toContain('PLATFORM_SEED_RESET_CREDENTIALS_ON_SEED');
    expect(platformSource).toContain('resetPlatformCredentialsOnSeed');
    expect(platformSource).toContain('? resetPlatformCredentialsOnSeed');
    expect(platformSource).toContain('await prisma.user.update');
  });

  it('requires explicit non-default credentials for the Platform bootstrap', () => {
    expect(platformSource).toContain(
      "requirePlatformSeedValue('PLATFORM_SEED_EMAIL')",
    );
    expect(platformSource).toContain(
      "requirePlatformSeedValue('PLATFORM_SEED_PASSWORD')",
    );
    expect(platformSource).toContain(
      'No default Platform credentials are provided.',
    );
    expect(platformSource).not.toContain('admin@schoolos.io');
    expect(platformSource).not.toContain('SchoolOS@2026');
  });

  it('does not reactivate a suspended operator or revoked Platform grant on reseed', () => {
    expect(platformSource).toContain('const existingOperator');
    expect(platformSource).not.toContain('prisma.user.upsert');
    expect(platformSource).toContain('const existingAdminGrant');
    expect(platformSource).toContain('if (!existingAdminGrant)');
    expect(platformSource).not.toContain('revokedAt: null');
    expect(platformSource).not.toContain('revokedById: null');
    expect(platformSource).not.toContain('revokeReason: null');
    expect(platformSource).not.toContain('expiresAt: null');
  });

  it('keeps school and Platform bootstrap roles in separate security domains', () => {
    expect(source).toContain('SCHOOL_ROLE_DEFINITIONS');
    expect(source).toContain('SCHOOL_ROLE_PERMISSIONS');
    expect(source).not.toContain('seedPlatformUser');

    for (const dedicatedSource of [platformSource, platformE2eSource]) {
      expect(dedicatedSource).toContain('PLATFORM_ROLE_DEFINITIONS');
      expect(dedicatedSource).toContain('PLATFORM_ROLE_PERMISSIONS');
      expect(dedicatedSource).toContain('SecurityDomain.PLATFORM');
      expect(dedicatedSource).toContain("scopeId: 'global'");
      expect(dedicatedSource).toContain('const action = parts.pop()');
    }
  });
});
