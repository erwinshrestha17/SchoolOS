import { type Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { TENANT_ID_KEY } from '../prisma/prisma.service';
import { type PlansService } from './plans.service';
import { skipSuspendedTenantJob } from './processor-tenant.guard';

/**
 * Runs a BullMQ job handler with tenant suspension checks and Prisma CLS
 * tenant scope injection so background workers match HTTP request isolation.
 */
export async function runTenantScopedJob<T>(
  cls: ClsService,
  plansService: PlansService,
  tenantId: string | null | undefined,
  logger: Logger,
  jobLabel: string,
  fn: () => Promise<T>,
): Promise<T | undefined> {
  if (await skipSuspendedTenantJob(plansService, tenantId, logger, jobLabel)) {
    return undefined;
  }

  return cls.run(async () => {
    cls.set(TENANT_ID_KEY, tenantId);
    return fn();
  });
}
