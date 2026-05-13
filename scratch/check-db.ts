import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

async function main() {
  console.log('Connecting to DB...');
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL
  });
  const prisma = new PrismaClient({ adapter });
  try {
    const tenants = await prisma.tenant.findMany();
    console.log('Tenants:', tenants);
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
