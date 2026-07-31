import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GuardianCapability } from '@prisma/client';
import {
  P0_01_CAPABILITY_CONTRACT,
  P0_01_REQUIRED_CAPABILITY_NAMES,
} from '../../teacher-scope/p0-01-capability-contract';
import {
  CAPABILITY_RULES,
  TeacherCapability,
} from '../../teacher-scope/teacher-capability';
import {
  buildActiveGuardianRelationshipWhere,
  GUARDIAN_CAPABILITY_DENIED_CODE,
} from './parent-scope';
import { TEACHER_SCOPE_DENIED_CODE } from '../../teacher-scope/teacher-scope.service';

const apiRoot = join(__dirname, '../..');

function readSource(relativePath: string) {
  return readFileSync(join(apiRoot, relativePath), 'utf8');
}

describe('P0-01 authorization matrix contract', () => {
  it('covers every required capability name with an enforcement mapping', () => {
    for (const name of P0_01_REQUIRED_CAPABILITY_NAMES) {
      expect(P0_01_CAPABILITY_CONTRACT[name]).toBeDefined();
    }
  });

  it('preserves equivalent teacher capability names without a duplicate vocabulary', () => {
    expect(P0_01_CAPABILITY_CONTRACT.SUBJECT_HOMEWORK_WRITE).toEqual({
      kind: 'teacher_capability',
      capability: TeacherCapability.SUBJECT_HOMEWORK_CREATE,
    });
    expect(P0_01_CAPABILITY_CONTRACT.SUBJECT_MARKS_WRITE).toEqual({
      kind: 'teacher_capability',
      capability: TeacherCapability.MARKS_ENTER,
    });
    expect(P0_01_CAPABILITY_CONTRACT.CLASS_ACADEMIC_OVERVIEW).toEqual({
      kind: 'teacher_capability',
      capability: TeacherCapability.HOMEROOM_ACADEMIC_SUMMARY_READ,
    });
    expect(P0_01_CAPABILITY_CONTRACT.CLASS_TEACHER_REMARK_WRITE).toEqual({
      kind: 'teacher_capability',
      capability: TeacherCapability.CLASS_TEACHER_REMARK,
    });
  });

  it('defines CAPABILITY_RULES for every TeacherCapability including RESULT_REVIEW', () => {
    for (const capability of Object.values(TeacherCapability)) {
      expect(CAPABILITY_RULES[capability]).toBeDefined();
    }
    expect(CAPABILITY_RULES[TeacherCapability.RESULT_REVIEW].access).toBe(
      'READ',
    );
    expect(
      CAPABILITY_RULES[TeacherCapability.PERIOD_ATTENDANCE_MARK].subjectMatch,
    ).toBe('EXACT');
    expect(
      CAPABILITY_RULES[TeacherCapability.HOMEROOM_ATTENDANCE_MARK]
        .allowedAssignmentTypes,
    ).toEqual(['CLASS_TEACHER']);
  });

  it('enforces RESULT_REVIEW through ResultsService teacher scope', () => {
    const source = readSource('academics/results.service.ts');
    expect(source).toContain('TeacherCapability.RESULT_REVIEW');
    expect(source).toContain('requireActorAccess');
    expect(source).not.toContain('listTeacherClassSectionCombos');
  });

  it('keeps daily attendance writes on HOMEROOM_ATTENDANCE_MARK', () => {
    const source = readSource('attendance/attendance.service.ts');
    expect(source).toContain('TeacherCapability.HOMEROOM_ATTENDANCE_MARK');
    expect(source).toContain('TeacherScopeService');
  });

  it('keeps homework writes on SUBJECT_HOMEWORK_CREATE', () => {
    const source = readSource('homework/homework.service.ts');
    expect(source).toContain('TeacherCapability.SUBJECT_HOMEWORK_CREATE');
  });

  it('keeps marks writes on MARKS_ENTER', () => {
    const source = readSource('academics/marks.service.ts');
    expect(source).toContain('TeacherCapability.MARKS_ENTER');
  });

  it('gates RESULT_PUBLISH and MARKS_UNLOCK on RBAC permissions', () => {
    const controller = readSource('academics/academics.controller.ts');
    expect(controller).toContain("results/publishing/publish");
    expect(controller).toContain(
      "@Permissions('academics:manage_report_cards')",
    );
    expect(controller).toContain(
      "@Permissions('exam-terms:manage', 'academics:manage')",
    );
    expect(controller).toContain('unlockExamTerm');
  });

  it('gates guardian relationship admin on guardians permissions', () => {
    const studentsController = readSource('students/students.controller.ts');
    expect(studentsController).toContain('guardians:update');
  });

  it('scopes protected file access through FileRegistryService', () => {
    const source = readSource('file-registry/file-registry.service.ts');
    expect(source).toContain('assertFileAccessForAuth');
    expect(source).toContain('asset.tenantId');
  });

  it('fails closed for missing/suspended tenant jobs', () => {
    const guard = readSource('plans/processor-tenant.guard.ts');
    expect(guard).toContain('tenantId is missing from job payload (fail-closed)');
    expect(guard).toContain('shouldProcessTenantJob');
  });

  it('binds school-plane tenant context from JWT/CLS, not client body', () => {
    const jwtGuard = readSource('auth/guards/jwt-auth.guard.ts');
    expect(jwtGuard).toContain('TENANT_ID_KEY');
    expect(jwtGuard).toContain('cls.set(TENANT_ID_KEY');
    expect(jwtGuard).toContain('x-schoolos-tenant-id');
  });

  it('uses a fail-closed entitlement guard', () => {
    const entitlementGuard = readSource('auth/guards/entitlement.guard.ts');
    expect(entitlementGuard).toContain('ForbiddenException');
    expect(entitlementGuard).toContain('SUSPENDED_TENANT_MESSAGE');
    expect(entitlementGuard).toContain('Tenant identification missing');
  });

  it('keeps stable denial codes for teacher and guardian scope', () => {
    expect(TEACHER_SCOPE_DENIED_CODE).toBe('TEACHER_SCOPE_DENIED');
    expect(GUARDIAN_CAPABILITY_DENIED_CODE).toBe('GUARDIAN_CAPABILITY_DENIED');
  });

  it('requires active verified approved effective guardian relationships', () => {
    const where = buildActiveGuardianRelationshipWhere(
      new Date('2026-07-31T00:00:00.000Z'),
      GuardianCapability.FEES_VIEW,
    );
    expect(where.status).toBe('ACTIVE');
    expect(where.verificationStatus).toBe('VERIFIED');
    expect(where.approvalStatus).toBe('APPROVED');
    expect(where.AND).toEqual(
      expect.arrayContaining([
        { capabilities: { has: GuardianCapability.FEES_VIEW } },
      ]),
    );
  });

  it('records authorization denial audit vocabulary', () => {
    const audit = readSource('common/security/authorization-audit.ts');
    expect(audit).toContain('authorization.denied');
    expect(audit).toContain('cross_tenant_attempt');
    expect(audit).toContain('guardian_capability_denied');
    expect(audit).toContain('protected_file.accessed');
    expect(audit).toContain('sensitive_export.generated');
  });
});
