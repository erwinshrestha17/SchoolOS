import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Class level database boundary', () => {
  const migration = readFileSync(
    join(
      process.cwd(),
      'prisma',
      'migrations',
      '20260722120000_enforce_supported_class_levels',
      'migration.sql',
    ),
    'utf8',
  );

  it('enforces Grade 1 through Grade 12 for new class writes', () => {
    expect(migration).toContain('"Class_level_supported_grade_check"');
    expect(migration).toMatch(/CHECK \("level" BETWEEN 1 AND 12\) NOT VALID/);
  });

  it('does not rewrite or delete unknown legacy class rows', () => {
    expect(migration).not.toMatch(/\bUPDATE\s+"Class"\b/i);
    expect(migration).not.toMatch(/\bDELETE\s+FROM\s+"Class"\b/i);
  });
});
