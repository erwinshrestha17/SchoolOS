/**
 * Enables module.learning on the staging smoke tenant for Wave 5 smoke:learning evidence.
 * Production school #1 should remain disabled until Wave 5 exit gate per GA program tracker.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://schoolos:password123@localhost:5434/schoolos_staging?schema=public',
});

const prisma = new PrismaClient({ adapter });

const stagingTenantSlug = process.env.SMOKE_TENANT_SLUG ?? 'default-school';

async function main() {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: stagingTenantSlug },
    select: { id: true },
  });

  if (!tenant) {
    console.log(`Staging tenant "${stagingTenantSlug}" not found; skipping learning enablement.`);
    return;
  }

  await prisma.tenantFeatureOverride.upsert({
    where: {
      tenantId_featureKey: {
        tenantId: tenant.id,
        featureKey: 'module.learning',
      },
    },
    update: {
      enabled: true,
      reason: 'Staging smoke tenant — M13 enabled for Wave 5 verification only',
    },
    create: {
      tenantId: tenant.id,
      featureKey: 'module.learning',
      enabled: true,
      reason: 'Staging smoke tenant — M13 enabled for Wave 5 verification only',
    },
  });

  console.log(`Enabled module.learning for staging tenant "${stagingTenantSlug}".`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
