import { PrismaClient, AuthMethod, UserStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://postgres:admin@localhost:5432/school_os?schema=public',
});

const prisma = new PrismaClient({ adapter });

const platformEmail = process.env.PLATFORM_SEED_EMAIL;
const platformPassword = process.env.PLATFORM_SEED_PASSWORD;
const platformRole = 'platform_super_admin';
const defaultTenantSlug = 'default-school';

async function main() {
  if (!platformEmail || !platformPassword) {
    throw new Error('PLATFORM_SEED_EMAIL and PLATFORM_SEED_PASSWORD are required.');
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: defaultTenantSlug },
  });

  if (!tenant) {
    throw new Error(`Tenant ${defaultTenantSlug} must exist before platform seed runs.`);
  }

  const role = await prisma.role.findUnique({
    where: {
      tenantId_name: {
        tenantId: tenant.id,
        name: platformRole,
      },
    },
  });

  if (!role) {
    throw new Error(`Role ${platformRole} must exist before platform seed runs.`);
  }

  const passwordHash = await bcrypt.hash(platformPassword, 12);

  const user = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: platformEmail,
      },
    },
    update: {
      passwordHash,
      authMethod: AuthMethod.PASSWORD,
      status: UserStatus.ACTIVE,
    },
    create: {
      tenantId: tenant.id,
      email: platformEmail,
      passwordHash,
      authMethod: AuthMethod.PASSWORD,
      status: UserStatus.ACTIVE,
    },
  });

  const existingRole = await prisma.userRole.findFirst({
    where: {
      tenantId: tenant.id,
      userId: user.id,
      roleId: role.id,
      scopeId: null,
    },
  });

  if (!existingRole) {
    await prisma.userRole.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        roleId: role.id,
      },
    });
  }

  console.log('Platform operator seed completed.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
