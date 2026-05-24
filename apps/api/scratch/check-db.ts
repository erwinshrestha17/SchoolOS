import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL ?? 'postgresql://schoolos:password123@localhost:5433/schoolos_db?schema=public';

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Fetching Tenants...');
  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
    }
  });
  console.log('Tenants:', JSON.stringify(tenants, null, 2));

  for (const t of tenants) {
    console.log(`\nUsers for tenant ${t.slug} (${t.id}):`);
    const users = await prisma.user.findMany({
      where: { tenantId: t.id },
      select: {
        id: true,
        email: true,
        status: true,
        userRoles: {
          select: {
            role: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });
    console.log(JSON.stringify(users, null, 2));
  }
}

main()
  .catch(console.error)
  .finally(() => pool.end());
