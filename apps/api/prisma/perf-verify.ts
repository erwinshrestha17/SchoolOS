/**
 * Print row counts for the isolated performance tenant.
 *
 * Usage: pnpm --filter @schoolos/api perf:verify
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const SLUG = process.env.PERF_TENANT_SLUG ?? 'perf-school';

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://schoolos:password123@localhost:5433/schoolos_db?schema=public',
});
const prisma = new PrismaClient({ adapter });

async function countFor(tenantId: string, label: string, counter: () => Promise<number>) {
  const value = await counter();
  console.log(`${label.padEnd(28)} ${value.toLocaleString()}`);
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: SLUG } });
  if (!tenant) {
    console.error(`Performance tenant "${SLUG}" not found. Run pnpm db:seed:performance first.`);
    process.exit(1);
  }

  console.log(`Performance tenant: ${SLUG} (${tenant.id})`);
  console.log('');

  await countFor(tenant.id, 'students', () =>
    prisma.student.count({ where: { tenantId: tenant.id } }),
  );
  await countFor(tenant.id, 'guardians', () =>
    prisma.guardian.count({ where: { tenantId: tenant.id } }),
  );
  await countFor(tenant.id, 'activity posts', () =>
    prisma.activityPost.count({ where: { tenantId: tenant.id } }),
  );
  await countFor(tenant.id, 'activity attachments', () =>
    prisma.activityAttachment.count({ where: { tenantId: tenant.id } }),
  );
  await countFor(tenant.id, 'activity student tags', () =>
    prisma.activityPostStudent.count({ where: { tenantId: tenant.id } }),
  );
  await countFor(tenant.id, 'activity reactions', () =>
    prisma.activityReaction.count({ where: { tenantId: tenant.id } }),
  );
  await countFor(tenant.id, 'developmental milestones', () =>
    prisma.developmentalMilestone.count({ where: { tenantId: tenant.id } }),
  );
  await countFor(tenant.id, 'guardian consents', () =>
    prisma.guardianConsent.count({ where: { tenantId: tenant.id } }),
  );
  await countFor(tenant.id, 'attendance sessions', () =>
    prisma.attendanceSession.count({ where: { tenantId: tenant.id } }),
  );
  await countFor(tenant.id, 'notification deliveries', () =>
    prisma.notificationDelivery.count({ where: { tenantId: tenant.id } }),
  );

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
