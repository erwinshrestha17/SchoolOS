import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('canonical development seed', () => {
  const source = readFileSync(join(__dirname, 'seed.ts'), 'utf8');

  it('keeps the Everest Academy Class 1-10 distribution deterministic', () => {
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
    ];

    expect(source).toContain('name: `Class ${index + 1}`');
    expect(source).toContain('const expectedCanonicalStudentCount = 601');
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
    expect(source).toContain('prisma.enrollment.upsert');
    expect(source).toContain('prisma.subjectTeacherAssignment.findMany');
    expect(source).toContain('prisma.timetableSlot.findFirst');
    expect(source).toContain('prisma.attendanceRecord.upsert');
    expect(source).toContain('prisma.homeworkAssignment.create');
    expect(source).toContain('prisma.invoice.upsert');
    expect(source).toContain('prisma.staffAttendance.upsert');
    expect(source).toContain('prisma.payslip.upsert');
    expect(source).toContain('prisma.transportStudentAssignment.findFirst');
  });

  it('has production and credential-output guardrails', () => {
    expect(source).toContain("process.env.NODE_ENV === 'production'");
    expect(source).toContain('Refusing to run development seed');
    expect(source).toContain('guardian.c01a001@schoolos.test');
    expect(source).toContain('guardian.c10b032@schoolos.test');
    expect(source).toContain('printRepresentativeCredentials');
  });
});
