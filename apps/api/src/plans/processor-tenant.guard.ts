import { type Logger } from '@nestjs/common';
import { type PlansService } from './plans.service';

export async function skipSuspendedTenantJob(
  plansService: PlansService,
  tenantId: string | null | undefined,
  logger: Logger,
  jobLabel: string,
): Promise<boolean> {
  if (!tenantId) {
    logger.error(
      `Skipping ${jobLabel}: tenantId is missing from job payload (fail-closed)`,
    );
    return true;
  }

  const allowed = await plansService.shouldProcessTenantJob(tenantId);
  if (!allowed) {
    logger.warn(
      `Skipping ${jobLabel} for inactive or missing tenant ${tenantId}`,
    );
    return true;
  }

  return false;
}
