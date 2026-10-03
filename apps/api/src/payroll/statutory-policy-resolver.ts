import { ConflictException } from '@nestjs/common';
import {
  NepalHrPolicyKind,
  NepalHrPolicyReviewStatus,
  NepalEducationPolicyScope,
} from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import {
  parseStatutoryPolicyPayload,
  StatutoryPolicyInvalidError,
  type ResolvedStatutoryPolicy,
} from './statutory-policy';

/**
 * NATIONAL policy versions carry no tenantId, so the tenant-scope extension
 * (which injects `tenantId = <school>` into every where clause) would hide them
 * from every school request. They are global, reviewed reference data that
 * every school reads identically, so reads go through the explicit, greppable
 * bypass. Only national statutory versions may be read this way: callers never
 * pass a school-supplied filter.
 */
export function readNationalStatutoryPolicies<T>(
  prisma: Pick<PrismaService, 'runWithoutTenantScope'>,
  read: () => Promise<T>,
): Promise<T> {
  return prisma.runWithoutTenantScope(
    'read national statutory policy versions (global reviewed reference data)',
    read,
  );
}

type PolicyClient = Pick<
  PrismaService,
  'nepalHrPolicyVersion' | 'runWithoutTenantScope'
>;

function utcDayStart(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/**
 * The statutory policy in force on a payroll period's end date ("policy as of
 * period end": one version governs the whole period; mid-period changes take
 * effect from the next period).
 *
 * Only APPROVED, NATIONAL versions of kind STATUTORY_SCHEME_TAX qualify; the
 * database refuses any other approved shape. Returns null when none covers the
 * date. Two approved lineages covering the same date are ambiguous and refused
 * rather than guessed between.
 */
export async function resolveStatutoryPolicy(
  client: PolicyClient,
  periodEnd: Date,
): Promise<ResolvedStatutoryPolicy | null> {
  const day = utcDayStart(periodEnd);
  const nextDay = new Date(day.getTime() + 86_400_000);
  const candidates = await readNationalStatutoryPolicies(client, () =>
    client.nepalHrPolicyVersion.findMany({
      where: {
        kind: NepalHrPolicyKind.STATUTORY_SCHEME_TAX,
        reviewStatus: NepalHrPolicyReviewStatus.APPROVED,
        scope: NepalEducationPolicyScope.NATIONAL,
        effectiveFrom: { lt: nextDay },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: nextDay } }],
      },
      orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }],
      select: {
        id: true,
        policyKey: true,
        version: true,
        effectiveFrom: true,
        effectiveTo: true,
        sourceTitle: true,
        sourceChecksumSha256: true,
        payload: true,
      },
    }),
  );
  if (!candidates.length) return null;
  const keys = new Set(candidates.map((candidate) => candidate.policyKey));
  if (keys.size > 1) {
    throw new ConflictException({
      code: 'STATUTORY_POLICY_AMBIGUOUS',
      message:
        'More than one approved statutory policy covers this payroll period. Retire or supersede one before preparing payroll.',
    });
  }
  const chosen = candidates[0];
  try {
    return {
      versionId: chosen.id,
      policyKey: chosen.policyKey,
      version: chosen.version,
      effectiveFrom: chosen.effectiveFrom,
      effectiveTo: chosen.effectiveTo,
      sourceTitle: chosen.sourceTitle,
      sourceChecksumSha256: chosen.sourceChecksumSha256,
      definition: parseStatutoryPolicyPayload(chosen.payload),
    };
  } catch (error) {
    if (error instanceof StatutoryPolicyInvalidError) {
      throw new ConflictException({
        code: 'STATUTORY_POLICY_INVALID',
        message:
          'The approved statutory policy cannot be used for calculation. A corrected version must be approved.',
        reasons: error.reasons,
      });
    }
    throw error;
  }
}
