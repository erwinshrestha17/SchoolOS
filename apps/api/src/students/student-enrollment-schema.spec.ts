import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Student active enrollment database boundary', () => {
  const migration = readFileSync(
    join(
      process.cwd(),
      'prisma',
      'migrations',
      '20260829150000_student_single_active_enrollment',
      'migration.sql',
    ),
    'utf8',
  );

  it('fails closed on duplicate active rows before adding the unique index', () => {
    expect(migration).toContain('HAVING COUNT(*) > 1');
    expect(migration).toContain('RAISE EXCEPTION');
    expect(migration).toContain(
      'Cannot enforce one active enrollment per student',
    );
  });

  it('enforces one active enrollment per tenant student without rewriting history', () => {
    expect(migration).toContain('"Enrollment_one_active_per_student_key"');
    expect(migration).toMatch(
      /ON "Enrollment"\("tenantId", "studentId"\)[\s\S]*WHERE "status" = 'ACTIVE'/,
    );
    expect(migration).not.toMatch(/\bUPDATE\s+"Enrollment"\b/i);
    expect(migration).not.toMatch(/\bDELETE\s+FROM\s+"Enrollment"\b/i);
  });
});
