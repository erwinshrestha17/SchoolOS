import type { PrismaClient } from '@prisma/client';

/**
 * Development/demo-only provisioning of P0-N3 teacher professional
 * eligibility, shared by seeds that create teaching authority.
 *
 * SchoolOS has no in-product eligibility provisioning workflow yet (Phase
 * 5J-5M), and the database rejects ACTIVE teacher assignments/delegations
 * without a live eligibility assessment. Demo tenants therefore need explicit,
 * clearly-labelled synthetic evidence. Everything here:
 *   - refuses to run with NODE_ENV=production;
 *   - is tenant-scoped (SCHOOL policy, never NATIONAL);
 *   - is labelled DEMO and cites no real authority or licence;
 *   - passes through the same database guards as real data (draft -> review ->
 *     independent approval; PENDING -> VERIFIED evidence);
 *   - is idempotent: approved history is reused, never rewritten.
 *
 * This is NOT a backfill for real schools. Legacy/production assignments
 * must obtain eligibility through verified evidence, not this helper.
 */
const DEMO_SCHOOL_TYPE = 'DEMO_INSTITUTIONAL';
const DEMO_SOURCE_URI = 'urn:schoolos:demo-fixture:not-real-evidence';
const DEMO_EFFECTIVE_FROM = new Date('2020-01-01T00:00:00.000Z');

function assertNotProduction() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Refusing to provision demo teacher eligibility with NODE_ENV=production.',
    );
  }
}

async function resolveLocalLevelId(prisma: PrismaClient): Promise<number> {
  const existing = await prisma.nepalLocalLevel.findFirst({
    select: { id: true },
    orderBy: { id: 'asc' },
  });
  if (existing) return existing.id;

  // Geography reference data not seeded: one clearly-synthetic chain whose
  // ids sit far outside real local-level codes.
  const id = 990_001;
  await prisma.nepalProvince.upsert({
    where: { id },
    update: {},
    create: { id, nameEn: 'Demo Province (synthetic)', nameNe: 'नमुना प्रदेश' },
  });
  await prisma.nepalDistrict.upsert({
    where: { id },
    update: {},
    create: {
      id,
      provinceId: id,
      nameEn: 'Demo District (synthetic)',
      nameNe: 'नमुना जिल्ला',
    },
  });
  await prisma.nepalLocalLevelType.upsert({
    where: { id },
    update: {},
    create: {
      id,
      code: 'DEMO_SYNTHETIC',
      slug: 'demo-synthetic',
      nameEn: 'Demo (synthetic)',
      nameNe: 'नमुना',
    },
  });
  await prisma.nepalLocalLevel.upsert({
    where: { id },
    update: {},
    create: {
      id,
      districtId: id,
      typeId: id,
      nameEn: 'Demo Municipality (synthetic)',
      nameNe: 'नमुना नगरपालिका',
    },
  });
  return id;
}

async function resolveReviewers(
  prisma: PrismaClient,
  tenantId: string,
): Promise<{ reviewerId: string; approverId: string }> {
  const users = await prisma.user.findMany({
    where: { tenantId, status: 'ACTIVE' },
    select: { id: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: 2,
  });
  if (users.length === 2) {
    return { reviewerId: users[0].id, approverId: users[1].id };
  }
  const created = await Promise.all(
    ['reviewer', 'approver'].map((role) =>
      prisma.user.create({
        data: {
          tenantId,
          email: `demo-eligibility-${role}-${tenantId}@example.test`,
          // Not a bcrypt hash: this synthetic reviewer can never sign in.
          passwordHash: 'demo-eligibility-reviewer-no-login',
          status: 'ACTIVE',
        },
        select: { id: true },
      }),
    ),
  );
  return { reviewerId: created[0].id, approverId: created[1].id };
}

async function ensureDemoPolicy(
  prisma: PrismaClient,
  tenantId: string,
  localLevelId: number,
  reviewers: { reviewerId: string; approverId: string },
): Promise<string> {
  const policyKey = `demo.teacher-eligibility.${tenantId}`;
  const approved = await prisma.nepalHrPolicyVersion.findFirst({
    where: { policyKey, reviewStatus: 'APPROVED' },
    orderBy: { version: 'desc' },
    select: { id: true },
  });
  if (approved) return approved.id;

  const draft =
    (await prisma.nepalHrPolicyVersion.findFirst({
      where: { policyKey, version: 1 },
      select: { id: true, reviewStatus: true },
    })) ??
    (await prisma.nepalHrPolicyVersion.create({
      data: {
        policyKey,
        version: 1,
        kind: 'TEACHER_PROFESSIONAL_ELIGIBILITY',
        scope: 'SCHOOL',
        tenantId,
        localLevelId,
        schoolTypeCode: DEMO_SCHOOL_TYPE,
        requiresQualification: true,
        requiresLicence: true,
        payload: { demo: true },
        effectiveFrom: DEMO_EFFECTIVE_FROM,
        sourceTitle: 'DEMO ONLY - synthetic teacher eligibility policy',
        sourceUri: DEMO_SOURCE_URI,
      },
      select: { id: true, reviewStatus: true },
    }));

  if (draft.reviewStatus === 'DRAFT') {
    await prisma.nepalHrPolicyVersion.update({
      where: { id: draft.id },
      data: { reviewStatus: 'IN_REVIEW' },
    });
  }
  if (draft.reviewStatus === 'DRAFT' || draft.reviewStatus === 'IN_REVIEW') {
    await prisma.nepalHrPolicyVersion.update({
      where: { id: draft.id },
      data: {
        reviewStatus: 'REVIEWED',
        reviewedById: reviewers.reviewerId,
        reviewedAt: new Date(),
      },
    });
  }
  await prisma.nepalHrPolicyVersion.update({
    where: { id: draft.id },
    data: {
      reviewStatus: 'APPROVED',
      approvedById: reviewers.approverId,
      approvedAt: new Date(),
    },
  });
  return draft.id;
}

async function isLive(
  prisma: PrismaClient,
  tenantId: string,
  staffId: string,
  assessmentId: string,
): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ allowed: boolean }>>`
    SELECT schoolos_teacher_eligibility_live(
      ${tenantId}, ${staffId}, ${assessmentId}, now(), NULL, NULL
    ) AS allowed`;
  return rows[0]?.allowed ?? false;
}

async function ensureStaffEligibility(
  prisma: PrismaClient,
  input: {
    tenantId: string;
    staffId: string;
    policyId: string;
    localLevelId: number;
    reviewers: { reviewerId: string; approverId: string };
  },
): Promise<string> {
  const { tenantId, staffId, policyId, localLevelId, reviewers } = input;

  const reusable = await prisma.teacherEligibilityAssessment.findFirst({
    where: {
      tenantId,
      staffId,
      policyVersionId: policyId,
      outcome: 'ELIGIBLE',
    },
    orderBy: { evaluatedAt: 'desc' },
    select: { id: true },
  });
  if (reusable && (await isLive(prisma, tenantId, staffId, reusable.id))) {
    return reusable.id;
  }

  let employment = await prisma.staffEmployment.findFirst({
    where: { tenantId, staffId, status: 'VERIFIED', effectiveTo: null },
    select: { id: true },
  });
  if (!employment) {
    employment = await prisma.staffEmployment.create({
      data: {
        tenantId,
        staffId,
        employmentType: 'PERMANENT',
        postCategoryCode: 'TEACHER',
        schoolTypeCode: DEMO_SCHOOL_TYPE,
        localLevelId,
        effectiveFrom: DEMO_EFFECTIVE_FROM,
      },
      select: { id: true },
    });
    await prisma.staffEmployment.update({
      where: { id: employment.id },
      data: {
        status: 'VERIFIED',
        verifiedById: reviewers.reviewerId,
        verifiedAt: new Date(),
      },
    });
  }

  const profile =
    (await prisma.teacherProfile.findUnique({
      where: { staffId },
      select: { id: true },
    })) ??
    (await prisma.teacherProfile.create({
      data: { tenantId, staffId, effectiveFrom: DEMO_EFFECTIVE_FROM },
      select: { id: true },
    }));

  let qualification = await prisma.teacherQualificationEvidence.findFirst({
    where: { tenantId, profileId: profile.id, status: 'VERIFIED' },
    select: { id: true },
  });
  if (!qualification) {
    qualification = await prisma.teacherQualificationEvidence.create({
      data: {
        tenantId,
        profileId: profile.id,
        qualification: 'DEMO ONLY - synthetic qualification',
        validFrom: DEMO_EFFECTIVE_FROM,
        sourceUri: DEMO_SOURCE_URI,
      },
      select: { id: true },
    });
    await prisma.teacherQualificationEvidence.update({
      where: { id: qualification.id },
      data: {
        status: 'VERIFIED',
        verifiedById: reviewers.reviewerId,
        verifiedAt: new Date(),
      },
    });
  }

  let licence = await prisma.teachingLicenceEvidence.findFirst({
    where: { tenantId, profileId: profile.id, status: 'VERIFIED' },
    select: { id: true },
  });
  if (!licence) {
    licence = await prisma.teachingLicenceEvidence.create({
      data: {
        tenantId,
        profileId: profile.id,
        authorityCode: 'DEMO',
        externalReference: `DEMO-NOT-A-LICENCE-${staffId}`,
        validFrom: DEMO_EFFECTIVE_FROM,
        sourceUri: DEMO_SOURCE_URI,
      },
      select: { id: true },
    });
    await prisma.teachingLicenceEvidence.update({
      where: { id: licence.id },
      data: {
        status: 'VERIFIED',
        verifiedById: reviewers.reviewerId,
        verifiedAt: new Date(),
      },
    });
  }

  const assessment = await prisma.teacherEligibilityAssessment.create({
    data: {
      tenantId,
      staffId,
      profileId: profile.id,
      employmentId: employment.id,
      policyVersionId: policyId,
      qualificationId: qualification.id,
      licenceId: licence.id,
      outcome: 'ELIGIBLE',
      reasonCode: 'POLICY_REQUIREMENTS_SATISFIED',
      evaluatedById: reviewers.approverId,
    },
    select: { id: true },
  });
  return assessment.id;
}

/**
 * Returns staffId -> live eligibility assessment id for every requested staff.
 */
export async function ensureDemoTeacherEligibility(
  prisma: PrismaClient,
  tenantId: string,
  staffIds: Iterable<string>,
): Promise<Map<string, string>> {
  assertNotProduction();
  const unique = [...new Set(staffIds)];
  const result = new Map<string, string>();
  if (unique.length === 0) return result;

  const localLevelId = await resolveLocalLevelId(prisma);
  const reviewers = await resolveReviewers(prisma, tenantId);
  const policyId = await ensureDemoPolicy(
    prisma,
    tenantId,
    localLevelId,
    reviewers,
  );
  for (const staffId of unique) {
    result.set(
      staffId,
      await ensureStaffEligibility(prisma, {
        tenantId,
        staffId,
        policyId,
        localLevelId,
        reviewers,
      }),
    );
  }
  return result;
}
