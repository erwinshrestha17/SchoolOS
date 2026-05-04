import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import { seedDemoSchoolData } from './demo-school.seed';

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://postgres:admin@localhost:5432/school_os?schema=public',
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: 'default-school' },
  });

  if (!tenant) {
    throw new Error('Default tenant not found. Run the foundation seed first.');
  }

  const academicYear = await prisma.academicYear.findFirst({
    where: { tenantId: tenant.id, isCurrent: true },
    orderBy: { startsOn: 'desc' },
  });

  if (!academicYear) {
    throw new Error('Current academic year not found. Run the foundation seed first.');
  }

  await seedDemoSchoolData(prisma, tenant.id, academicYear.id);
}

main()
  .catch((error) => {
    console.error('Demo seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
