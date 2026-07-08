import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://postgres:admin@localhost:5432/school_os?schema=public',
});
const prisma = new PrismaClient({ adapter });

const ADMISSION_POLICY_SETTING_KEY = 'admissions.policy.v1';
const SCHOOL_DEFAULT_SLUG = 'school-default';

const TERMINAL_STATUSES = new Set([
  'ADMITTED',
  'ENROLLED',
  'NOT_ADMITTED',
  'REJECTED',
  'CLOSED',
]);

type AdmissionMode = 'DIRECT_ALLOWED' | 'REVIEW_REQUIRED';

interface PolicyRule {
  admissionMode: AdmissionMode;
  requireDocumentReview: boolean;
  requireInterview: boolean;
  requirePrincipalApproval: boolean;
  requireTransferCertificate: boolean;
  requirePriorMarksheet: boolean;
  requireStreamOrMarksReview: boolean;
  allowAdmissionWithDocumentsPending: boolean;
  enforceCapacityWhenAvailable: boolean;
  requireSection: boolean;
  requiredDocuments: string[];
  requiredFields: string[];
  academicYearId?: string;
  gradeBand?: string;
  classId?: string;
  source?: string;
  transferStudent?: boolean;
}

const DEFAULT_POLICY_RULE: PolicyRule = {
  admissionMode: 'DIRECT_ALLOWED',
  requireDocumentReview: false,
  requireInterview: false,
  requirePrincipalApproval: false,
  requireTransferCertificate: false,
  requirePriorMarksheet: false,
  requireStreamOrMarksReview: false,
  allowAdmissionWithDocumentsPending: true,
  enforceCapacityWhenAvailable: false,
  requireSection: false,
  requiredDocuments: [],
  requiredFields: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeDocumentKind(value: string) {
  return value.trim().replace(/[\s-]+/g, '_').toUpperCase();
}

// Mirrors AdmissionCasesService.normalizePolicyRule, kept standalone since this
// script runs once, outside the app, before the new endpoints exist.
function normalizeRule(
  value: Record<string, unknown>,
  fallbackMode: 'DIRECT_ALLOWED' | 'REVIEW_REQUIRED',
  includeDefaults: boolean,
): PolicyRule {
  const mode =
    value.admissionMode === 'REVIEW_REQUIRED' ||
    value.admissionMode === 'DIRECT_ALLOWED'
      ? (value.admissionMode as 'DIRECT_ALLOWED' | 'REVIEW_REQUIRED')
      : fallbackMode;
  const base: Partial<PolicyRule> = includeDefaults ? DEFAULT_POLICY_RULE : {};
  const rule: PolicyRule = {
    ...base,
    ...(value as Partial<PolicyRule>),
    admissionMode: mode,
  } as PolicyRule;
  if (Array.isArray(value.requiredDocuments)) {
    rule.requiredDocuments = value.requiredDocuments
      .filter((item): item is string => typeof item === 'string')
      .map(normalizeDocumentKind)
      .filter(Boolean);
  }
  if (Array.isArray(value.requiredFields)) {
    rule.requiredFields = value.requiredFields
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return rule;
}

function documentRequirementsFor(rule: PolicyRule) {
  const kinds = new Set((rule.requiredDocuments ?? []).map(normalizeDocumentKind));
  if (rule.requireTransferCertificate) kinds.add('TRANSFER_CERTIFICATE');
  if (rule.requirePriorMarksheet) kinds.add('PRIOR_MARKSHEET');
  return [...kinds].map((documentKind, index) => ({
    documentKind,
    label: documentKind
      .split('_')
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' '),
    isRequired: true,
    requiresOriginalVerification: false,
    timing: 'BEFORE_ENROLLMENT' as const,
    canBeWaived: false,
    waivableByRoleKeys: [] as string[],
    sortOrder: index,
  }));
}

function policyNameForOverride(rule: PolicyRule, index: number) {
  const parts: string[] = [];
  if (rule.gradeBand) parts.push(rule.gradeBand.replace(/_/g, ' '));
  if (rule.source) parts.push(rule.source.replace(/_/g, ' '));
  if (typeof rule.transferStudent === 'boolean') {
    parts.push(rule.transferStudent ? 'Transfer' : 'Non-transfer');
  }
  if (parts.length === 0) return `Migrated rule ${index + 1}`;
  return `${parts.join(' — ')} (migrated)`;
}

async function createPolicyWithVersion(
  tenantId: string,
  name: string,
  slug: string | null,
  isDefault: boolean,
  scope: {
    academicYearId?: string;
    classId?: string;
    gradeBand?: string;
    source?: string;
    applicantType: 'NEW' | 'TRANSFER' | 'BOTH';
  },
  rule: PolicyRule,
) {
  const policy = await prisma.admissionPolicy.create({
    data: {
      tenantId,
      name,
      slug,
      status: 'ACTIVE',
      isDefault,
      academicYearId: scope.academicYearId ?? null,
      classId: scope.classId ?? null,
      gradeBand: scope.gradeBand ?? null,
      source: scope.source ?? null,
      applicantType: scope.applicantType,
    },
  });
  const version = await prisma.admissionPolicyVersion.create({
    data: {
      tenantId,
      policyId: policy.id,
      version: 1,
      status: 'ACTIVE',
      admissionMode: rule.admissionMode,
      transferStudent: rule.transferStudent ?? null,
      requiredFields: rule.requiredFields ?? [],
      requireSection: rule.requireSection ?? false,
      requireDocumentReview: rule.requireDocumentReview ?? false,
      requireInterview: rule.requireInterview ?? false,
      requirePrincipalApproval: rule.requirePrincipalApproval ?? false,
      requireTransferCertificate: rule.requireTransferCertificate ?? false,
      requirePriorMarksheet: rule.requirePriorMarksheet ?? false,
      requireStreamOrMarksReview: rule.requireStreamOrMarksReview ?? false,
      allowAdmissionWithDocumentsPending:
        rule.allowAdmissionWithDocumentsPending ?? true,
      enforceCapacityWhenAvailable: rule.enforceCapacityWhenAvailable ?? false,
      activatedAt: new Date(),
    },
  });
  const requirements = documentRequirementsFor(rule);
  if (requirements.length > 0) {
    await prisma.admissionPolicyDocumentRequirement.createMany({
      data: requirements.map((requirement) => ({
        tenantId,
        policyVersionId: version.id,
        ...requirement,
      })),
    });
  }
  await prisma.admissionPolicy.update({
    where: { id: policy.id },
    data: { currentVersionId: version.id },
  });
  return { policy, version };
}

// The legacy TenantSetting blob is only removed here, after the relational
// rows for the tenant verifiably exist — a standalone cleanup migration would
// run before this script on a fresh environment and destroy the source data.
async function removeLegacySetting(tenantId: string) {
  const removed = await prisma.tenantSetting.deleteMany({
    where: { tenantId, key: ADMISSION_POLICY_SETTING_KEY },
  });
  if (removed.count > 0) {
    console.log(
      `  tenant ${tenantId}: removed legacy ${ADMISSION_POLICY_SETTING_KEY} setting`,
    );
  }
}

async function backfillTenant(tenantId: string) {
  const existingDefault = await prisma.admissionPolicy.findFirst({
    where: { tenantId, slug: SCHOOL_DEFAULT_SLUG },
  });
  if (existingDefault) {
    console.log(`  tenant ${tenantId}: already migrated, skipping`);
    await removeLegacySetting(tenantId);
    return;
  }

  const setting = await prisma.tenantSetting.findFirst({
    where: { tenantId, key: ADMISSION_POLICY_SETTING_KEY },
    select: { value: true },
  });
  const settingValue: unknown = setting?.value;
  const root = isRecord(settingValue) ? settingValue : {};
  const rawDefault = isRecord(root.defaultPolicy) ? root.defaultPolicy : {};
  const rawOverrides: Record<string, unknown>[] = Array.isArray(root.overrides)
    ? root.overrides.filter(isRecord)
    : [];

  const normalizedDefault = normalizeRule(
    rawDefault,
    DEFAULT_POLICY_RULE.admissionMode,
    true,
  );

  const { version: defaultVersion } = await createPolicyWithVersion(
    tenantId,
    'School Default',
    SCHOOL_DEFAULT_SLUG,
    true,
    { applicantType: 'BOTH' },
    normalizedDefault,
  );
  console.log(
    `  tenant ${tenantId}: created School Default policy (${rawOverrides.length} override rule(s) to migrate)`,
  );

  for (const [index, rawRule] of rawOverrides.entries()) {
    const flattened = normalizeRule(
      { ...normalizedDefault, ...rawRule },
      normalizedDefault.admissionMode,
      false,
    );
    const applicantType: 'NEW' | 'TRANSFER' | 'BOTH' =
      typeof flattened.transferStudent === 'boolean'
        ? flattened.transferStudent
          ? 'TRANSFER'
          : 'NEW'
        : 'BOTH';
    await createPolicyWithVersion(
      tenantId,
      policyNameForOverride(flattened, index),
      null,
      false,
      {
        academicYearId: flattened.academicYearId,
        classId: flattened.classId,
        gradeBand: flattened.gradeBand,
        source: flattened.source,
        applicantType,
      },
      flattened,
    );
  }

  const openCasesUpdated = await prisma.admissionApplication.updateMany({
    where: {
      tenantId,
      status: { notIn: [...TERMINAL_STATUSES] },
      policyVersionId: null,
    },
    data: {
      policyVersionId: defaultVersion.id,
      policyResolutionReason: 'Backfilled to School Default during policy-model migration',
    },
  });
  console.log(
    `  tenant ${tenantId}: backfilled ${openCasesUpdated.count} open admission application(s)`,
  );
  await removeLegacySetting(tenantId);
}

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, slug: true } });
  console.log(`Backfilling admission policy for ${tenants.length} tenant(s)...`);
  for (const tenant of tenants) {
    console.log(`Tenant ${tenant.slug} (${tenant.id})`);
    await backfillTenant(tenant.id);
  }
  console.log('Done.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
