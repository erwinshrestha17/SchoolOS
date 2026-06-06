import { Logger } from '@nestjs/common';
import { PlansService } from './plans.service';

export async function skipSuspendedTenantJob(
  plansService: PlansService,
  tenantId: string | null | undefined,
  logger: Logger,
  jobLabel: string,
): Promise<boolean> {
  if (!tenantId) {
    return false;
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
