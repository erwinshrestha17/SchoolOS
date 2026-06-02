import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function run() {
  try {
    const user = await prisma.user.findFirst({
      where: {
        email: 'principal@schoolos.com',
      },
    });
    console.log('User principal@schoolos.com:', JSON.stringify(user, null, 2));
  } catch (err) {
    console.error('Error querying user:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
