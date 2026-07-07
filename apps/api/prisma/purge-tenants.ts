import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://postgres:admin@localhost:5432/school_os?schema=public',
});
const prisma = new PrismaClient({ adapter });

// Deletes every row belonging to the given tenant slugs, across every table
// that has a tenantId column, then deletes the tenant rows themselves.
// FK "Restrict" ordering is unknown ahead of time, so this retries in passes:
// each pass deletes whatever tables no longer have a blocking referrer,
// until nothing is left or a pass makes no progress.
async function main() {
  const slugs = process.argv.slice(2);
  if (slugs.length === 0) {
    console.error('Usage: tsx prisma/purge-tenants.ts <slug> [<slug> ...]');
    process.exit(1);
  }

  const tenants = await prisma.tenant.findMany({
    where: { slug: { in: slugs } },
  });
  if (tenants.length === 0) {
    console.log('No matching tenants found for:', slugs.join(', '));
    return;
  }
  const tenantIds = tenants.map((t) => t.id);
  console.log(
    `Purging tenants: ${tenants.map((t) => `${t.slug} (${t.id})`).join(', ')}`,
  );

  const tenantScopedTables = await prisma.$queryRawUnsafe<
    Array<{ table_name: string }>
  >(
    `select table_name from information_schema.columns
     where table_schema = 'public' and column_name = 'tenantId'`,
  );

  let remaining = tenantScopedTables.map((row) => row.table_name);
  for (let pass = 1; pass <= 50 && remaining.length > 0; pass += 1) {
    let deletedThisPass = 0;
    const blocked: string[] = [];
    for (const table of remaining) {
      try {
        const deleted = await prisma.$executeRawUnsafe(
          `DELETE FROM "${table}" WHERE "tenantId" = ANY($1::text[])`,
          tenantIds,
        );
        deletedThisPass += deleted;
      } catch {
        blocked.push(table);
      }
    }
    console.log(
      `Pass ${pass}: deleted ${deletedThisPass} rows, ${blocked.length} tables still blocked`,
    );
    if (blocked.length === remaining.length && deletedThisPass === 0) {
      console.error('No progress made; still blocked tables:', blocked);
      process.exit(1);
    }
    remaining = blocked;
  }

  await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
  console.log(
    'Tenants deleted:',
    tenants.map((t) => t.slug).join(', '),
  );
}

main()
  .catch((error) => {
    console.error('Purge failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
