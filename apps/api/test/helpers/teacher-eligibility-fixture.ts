import type { PrismaService } from '../../src/prisma/prisma.service';
import { TeacherProfessionalEligibilityService } from '../../src/teacher-scope/teacher-professional-eligibility.service';

/**
 * P0-N3 integration fixture: establishes real professional eligibility for a
 * synthetic teacher through the same database guards production uses.
 *
 * Nothing here bypasses a trigger. The policy is reviewed and approved by two
 * distinct same-tenant users, employment/evidence start PENDING and are then
 * verified, and the assessment is produced by the production preflight
 * service. Callers must run this inside `runWithoutTenantScope`.
 *
 * Policy, employment, profile, evidence and assessments are append-only
 * business history and cannot be deleted. Suites that use this fixture must
 * retain those rows (and the tenant/staff/users they reference) on teardown;
 * `retireEligibilityTenant` makes the synthetic tenant inert instead.
 */
export interface TeacherEligibilityFixture {
  assessmentId: string;
  policyVersionId: string;
  employmentId: string;
  profileId: string;
}

export const SYNTHETIC_SCHOOL_TYPE = 'SYNTHETIC_TEST_SCHOOL';
const POLICY_EFFECTIVE_FROM = new Date('2024-01-01T00:00:00.000Z');

export async function resolveLocalLevelId(
  prisma: PrismaService,
  suffix: string,
): Promise<number> {
  const existing = await prisma.nepalLocalLevel.findFirst({
    select: { id: true },
    orderBy: { id: 'asc' },
  });
  if (existing) return existing.id;

  // Empty reference data (migrate-only CI database): create one synthetic,
  // clearly-labelled jurisdiction chain. Ids live far above real LGCDD codes.
  const id = 900_000 + (Date.now() % 90_000);
  await prisma.nepalProvince.create({
    data: {
      id,
      nameEn: `Synthetic Province ${suffix}`,
      nameNe: 'नमुना प्रदेश',
    },
  });
  await prisma.nepalDistrict.create({
    data: {
      id,
      provinceId: id,
      nameEn: `Synthetic District ${suffix}`,
      nameNe: 'नमुना जिल्ला',
    },
  });
  await prisma.nepalLocalLevelType.create({
    data: {
      id,
      code: `SYN-${suffix}`,
      slug: `synthetic-${suffix}`,
      nameEn: 'Synthetic',
      nameNe: 'नमुना',
    },
  });
  await prisma.nepalLocalLevel.create({
    data: {
      id,
      districtId: id,
      typeId: id,
      nameEn: `Synthetic Municipality ${suffix}`,
      nameNe: 'नमुना नगरपालिका',
    },
  });
  return id;
}

export async function establishTeacherEligibility(
  prisma: PrismaService,
  input: {
    tenantId: string;
    staffId: string;
    classId: string;
    subjectId: string | null;
    suffix: string;
  },
): Promise<TeacherEligibilityFixture> {
  const { tenantId, staffId, suffix } = input;
  const localLevelId = await resolveLocalLevelId(prisma, suffix);

  const [reviewer, approver] = await Promise.all(
    ['reviewer', 'approver'].map((role) =>
      prisma.user.create({
        data: {
          tenantId,
          email: `eligibility-${role}-${suffix}@example.test`,
          passwordHash: 'x',
          status: 'ACTIVE',
        },
        select: { id: true },
      }),
    ),
  );

  // School-scoped so the synthetic policy cannot influence other tenants. It
  // requires both qualification and licence (and a high remuneration floor) so
  // it can never be rejected as relaxing a mandatory baseline present in a
  // shared database.
  const policy = await prisma.nepalHrPolicyVersion.create({
    data: {
      policyKey: `synthetic.teacher-eligibility.${suffix}`,
      version: 1,
      kind: 'TEACHER_PROFESSIONAL_ELIGIBILITY',
      scope: 'SCHOOL',
      tenantId,
      localLevelId,
      schoolTypeCode: SYNTHETIC_SCHOOL_TYPE,
      requiresQualification: true,
      requiresLicence: true,
      minimumMonthlyNpr: '10000000.00',
      payload: {},
      effectiveFrom: POLICY_EFFECTIVE_FROM,
      sourceTitle: 'Synthetic integration-test policy',
      sourceUri: 'https://example.test/synthetic-teacher-policy',
    },
    select: { id: true },
  });
  await prisma.nepalHrPolicyVersion.update({
    where: { id: policy.id },
    data: { reviewStatus: 'IN_REVIEW' },
  });
  await prisma.nepalHrPolicyVersion.update({
    where: { id: policy.id },
    data: {
      reviewStatus: 'REVIEWED',
      reviewedById: reviewer.id,
      reviewedAt: new Date(),
    },
  });
  await prisma.nepalHrPolicyVersion.update({
    where: { id: policy.id },
    data: {
      reviewStatus: 'APPROVED',
      approvedById: approver.id,
      approvedAt: new Date(),
    },
  });

  const employment = await prisma.staffEmployment.create({
    data: {
      tenantId,
      staffId,
      employmentType: 'PERMANENT',
      postCategoryCode: 'TEACHER',
      schoolTypeCode: SYNTHETIC_SCHOOL_TYPE,
      localLevelId,
      effectiveFrom: POLICY_EFFECTIVE_FROM,
    },
    select: { id: true },
  });
  await prisma.staffEmployment.update({
    where: { id: employment.id },
    data: {
      status: 'VERIFIED',
      verifiedById: reviewer.id,
      verifiedAt: new Date(),
    },
  });

  const profile = await prisma.teacherProfile.create({
    data: { tenantId, staffId, effectiveFrom: POLICY_EFFECTIVE_FROM },
    select: { id: true },
  });

  // Unscoped subject/level evidence so class and subject changes made by the
  // calling suite remain within the same verified professional evidence.
  const qualification = await prisma.teacherQualificationEvidence.create({
    data: {
      tenantId,
      profileId: profile.id,
      qualification: 'Synthetic B.Ed.',
      validFrom: POLICY_EFFECTIVE_FROM,
      sourceUri: 'https://example.test/synthetic-qualification',
    },
    select: { id: true },
  });
  await prisma.teacherQualificationEvidence.update({
    where: { id: qualification.id },
    data: {
      status: 'VERIFIED',
      verifiedById: reviewer.id,
      verifiedAt: new Date(),
    },
  });
  const licence = await prisma.teachingLicenceEvidence.create({
    data: {
      tenantId,
      profileId: profile.id,
      authorityCode: 'SYNTHETIC',
      externalReference: `TEST-ONLY-${suffix}`,
      validFrom: POLICY_EFFECTIVE_FROM,
      sourceUri: 'https://example.test/synthetic-licence',
    },
    select: { id: true },
  });
  await prisma.teachingLicenceEvidence.update({
    where: { id: licence.id },
    data: {
      status: 'VERIFIED',
      verifiedById: reviewer.id,
      verifiedAt: new Date(),
    },
  });

  const assessmentId = await new TeacherProfessionalEligibilityService(
    prisma,
  ).preflightAssignment({
    tenantId,
    staffId,
    classId: input.classId,
    subjectId: input.subjectId,
    actorId: approver.id,
  });

  return {
    assessmentId,
    policyVersionId: policy.id,
    employmentId: employment.id,
    profileId: profile.id,
  };
}

/** Teardown companion: history is retained, the tenant is made inert. */
export async function retireEligibilityTenant(
  prisma: PrismaService,
  tenantId: string,
): Promise<void> {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { isActive: false },
  });
}

/**
 * Phase 7.10: one reviewed-and-approved school-scoped eligibility policy
 * version through the real review workflow (two distinct reviewers). Use this
 * when several teachers of one tenant must share a single policy; calling
 * `establishTeacherEligibility` per teacher would create equally specific
 * policies that conflict.
 */
export async function approveSchoolEligibilityPolicy(
  prisma: PrismaService,
  input: {
    tenantId: string;
    localLevelId: number;
    suffix: string;
    policyKey?: string;
    version?: number;
    supersedesId?: string;
    effectiveFrom?: Date;
    requiresQualification?: boolean;
    requiresLicence?: boolean;
  },
): Promise<string> {
  const [reviewer, approver] = await Promise.all(
    ['reviewer', 'approver'].map((role) =>
      prisma.user.create({
        data: {
          tenantId: input.tenantId,
          email: `policy-${role}-${input.suffix}-${String(input.version ?? 1)}@example.test`,
          passwordHash: 'x',
          status: 'ACTIVE',
        },
        select: { id: true },
      }),
    ),
  );
  const policy = await prisma.nepalHrPolicyVersion.create({
    data: {
      policyKey:
        input.policyKey ?? `synthetic.teacher-eligibility.${input.suffix}`,
      version: input.version ?? 1,
      kind: 'TEACHER_PROFESSIONAL_ELIGIBILITY',
      scope: 'SCHOOL',
      tenantId: input.tenantId,
      localLevelId: input.localLevelId,
      schoolTypeCode: SYNTHETIC_SCHOOL_TYPE,
      requiresQualification: input.requiresQualification ?? true,
      requiresLicence: input.requiresLicence ?? true,
      minimumMonthlyNpr: '10000000.00',
      payload: {},
      effectiveFrom: input.effectiveFrom ?? POLICY_EFFECTIVE_FROM,
      supersedesId: input.supersedesId,
      sourceTitle: 'Synthetic integration-test policy',
      sourceUri: 'https://example.test/synthetic-teacher-policy',
    },
    select: { id: true },
  });
  await prisma.nepalHrPolicyVersion.update({
    where: { id: policy.id },
    data: { reviewStatus: 'IN_REVIEW' },
  });
  await prisma.nepalHrPolicyVersion.update({
    where: { id: policy.id },
    data: {
      reviewStatus: 'REVIEWED',
      reviewedById: reviewer.id,
      reviewedAt: new Date(),
    },
  });
  await prisma.nepalHrPolicyVersion.update({
    where: { id: policy.id },
    data: {
      reviewStatus: 'APPROVED',
      approvedById: approver.id,
      approvedAt: new Date(),
    },
  });
  return policy.id;
}
