import {
  AuthMethod,
  PrismaClient,
  UserStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

const TENANT_SLUG = 'default-school';
const SECURITY_ADMIN_EMAIL = 'security-e2e-admin@schoolos.test';
const PASSWORD_TEST_EMAIL = 'password-e2e-user@schoolos.test';
const DEFAULT_PASSWORD =
  process.env.SCHOOLOS_E2E_M0_SECURITY_PASSWORD ?? 'SecurityE2eAdmin1!';

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://postgres:admin@localhost:5432/school_os?schema=public',
});
const prisma = new PrismaClient({ adapter });

function assertE2eFixtureAllowed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed M0 account-security fixtures in production.');
  }
  if (process.env.SCHOOLOS_E2E_M0_ACCOUNT_SECURITY_FIXTURES !== 'true') {
    throw new Error(
      'Set SCHOOLOS_E2E_M0_ACCOUNT_SECURITY_FIXTURES=true to seed the dedicated M0 account-security fixture.',
    );
  }
}

async function ensureAdminRole(tenantId: string) {
  const adminRole = await prisma.role.findFirst({
    where: { tenantId, name: 'admin' },
    select: { id: true },
  });
  if (!adminRole) {
    throw new Error(
      `Admin role missing for ${TENANT_SLUG}. Run the main seed first.`,
    );
  }
  return adminRole.id;
}

async function upsertManagedUser(input: {
  tenantId: string;
  email: string;
  password: string;
  mustChangePassword: boolean;
  roleId: string;
}) {
  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: input.tenantId,
        email: input.email,
      },
    },
    update: {
      passwordHash,
      mustChangePassword: input.mustChangePassword,
      status: UserStatus.ACTIVE,
    },
    create: {
      tenantId: input.tenantId,
      email: input.email,
      passwordHash,
      mustChangePassword: input.mustChangePassword,
      authMethod: AuthMethod.PASSWORD,
      status: UserStatus.ACTIVE,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId_scopeId: {
        userId: user.id,
        roleId: input.roleId,
        scopeId: 'global',
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: input.roleId,
      tenantId: input.tenantId,
      scopeId: 'global',
    },
  });

  return user;
}

async function main() {
  assertE2eFixtureAllowed();

  const tenant = await prisma.tenant.findUnique({
    where: { slug: TENANT_SLUG },
    select: { id: true },
  });
  if (!tenant) {
    throw new Error(
      `Seed the ${TENANT_SLUG} development tenant before the M0 account-security fixture.`,
    );
  }

  const adminRoleId = await ensureAdminRole(tenant.id);

  await upsertManagedUser({
    tenantId: tenant.id,
    email: SECURITY_ADMIN_EMAIL,
    password: DEFAULT_PASSWORD,
    mustChangePassword: false,
    roleId: adminRoleId,
  });

  await upsertManagedUser({
    tenantId: tenant.id,
    email: PASSWORD_TEST_EMAIL,
    password: DEFAULT_PASSWORD,
    mustChangePassword: false,
    roleId: adminRoleId,
  });

  console.log('M0 account-security E2E fixture ready:');
  console.log(`  tenant: ${TENANT_SLUG}`);
  console.log(`  security admin: ${SECURITY_ADMIN_EMAIL}`);
  console.log(`  password test user: ${PASSWORD_TEST_EMAIL}`);
  console.log(`  password: ${DEFAULT_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
