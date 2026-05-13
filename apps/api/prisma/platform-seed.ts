import { PrismaClient, AuthMethod, UserStatus, TenantSubscriptionStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://postgres:admin@localhost:5432/school_os?schema=public',
});

const prisma = new PrismaClient({ adapter });

const platformEmail = process.env.PLATFORM_SEED_EMAIL || 'admin@schoolos.io';
const platformPassword = process.env.PLATFORM_SEED_PASSWORD || 'SchoolOS@2026';
const platformRole = 'platform_super_admin';
const demoTenantSlug = 'pilot-school-demo';

async function main() {
  console.log('--- M0 Platform Core Seed: Starting ---');

  // 1. Ensure Platform Super Admin Role exists globally (system role)
  // Note: system roles are typically managed via migration or startup logic, 
  // but we ensure it here for the seed.
  
  // 2. Create/Update Platform Operator
  const passwordHash = await bcrypt.hash(platformPassword, 12);
  
  // We need a "platform" tenant context for the operator if they are global
  // In our schema, users belong to tenants.
  let platformTenant = await prisma.tenant.findUnique({ where: { slug: 'platform' } });
  if (!platformTenant) {
    platformTenant = await prisma.tenant.create({
      data: {
        name: 'SchoolOS Platform',
        slug: 'platform',
        plan: 'platform',
        isActive: true,
      }
    });
  }

  const operator = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: platformTenant.id,
        email: platformEmail,
      },
    },
    update: {
      passwordHash,
      status: UserStatus.ACTIVE,
    },
    create: {
      tenantId: platformTenant.id,
      email: platformEmail,
      passwordHash,
      authMethod: AuthMethod.PASSWORD,
      status: UserStatus.ACTIVE,
    },
  });

  // Ensure role assignment
  const adminRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: platformTenant.id, name: platformRole } },
    update: {},
    create: {
      tenantId: platformTenant.id,
      name: platformRole,
      description: 'Global platform administrator',
      isSystem: true,
    }
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId_scopeId: {
        userId: operator.id,
        roleId: adminRole.id,
        scopeId: 'global',
      }
    },
    update: {},
    create: {
      tenantId: platformTenant.id,
      userId: operator.id,
      roleId: adminRole.id,
      scopeId: 'global',
    }
  });

  console.log('✅ Platform operator seeded.');

  // 3. Seed Platform Plans
  const standardPlan = await (prisma as any).platformPlan.upsert({
    where: { key: 'standard' },
    update: {
      name: 'Standard Plan',
      priceNpr: 5000,
      billingCycle: 'MONTHLY',
    },
    create: {
      key: 'standard',
      name: 'Standard Plan',
      description: 'Comprehensive school management for growing institutions',
      priceNpr: 5000,
      billingCycle: 'MONTHLY',
      status: 'ACTIVE',
      features: {
        create: [
          { featureKey: 'module.students', enabled: true },
          { featureKey: 'module.attendance', enabled: true },
          { featureKey: 'module.fees', enabled: true },
          { featureKey: 'module.exams', enabled: true },
          { featureKey: 'feature.report_card_pdf', enabled: true },
        ]
      },
      usageLimits: {
        create: [
          { usageKey: 'students.count', limit: 500, period: 'LIFETIME' },
          { usageKey: 'sms.sent', limit: 1000, period: 'MONTHLY' },
        ]
      }
    }
  });

  console.log('✅ Platform plans seeded.');

  // 4. Seed Nepal Demo Tenant (Pilot)
  const demoTenant = await prisma.tenant.upsert({
    where: { slug: demoTenantSlug },
    update: { isActive: true },
    create: {
      name: 'Nepal Pilot Academy',
      slug: demoTenantSlug,
      plan: 'standard',
      isActive: true,
      panNumber: '600123456',
    }
  });

  // Assign Subscription
  const existingSub = await (prisma as any).tenantSubscription.findFirst({
    where: { tenantId: demoTenant.id }
  });

  if (!existingSub) {
    await (prisma as any).tenantSubscription.create({
      data: {
        tenantId: demoTenant.id,
        planId: standardPlan.id,
        status: TenantSubscriptionStatus.ACTIVE,
        startsAt: new Date(),
        renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      }
    });
  }

  // Setup Billing Profile
  await (prisma as any).tenantBillingProfile.upsert({
    where: { tenantId: demoTenant.id },
    update: {},
    create: {
      tenantId: demoTenant.id,
      billingContactName: 'Bishal Thapa',
      billingEmail: 'billing@nepalpilot.edu.np',
      billingAddress: 'Kathmandu, Nepal',
      panVatNumber: '600123456',
      preferredBillingCycle: 'MONTHLY',
    }
  });

  console.log(`✅ Demo tenant "${demoTenant.name}" seeded.`);

  // 5. Seed Onboarding Overrides for Demo
  await (prisma as any).tenantOnboardingChecklistOverride.upsert({
    where: { tenantId_itemKey: { tenantId: demoTenant.id, itemKey: 'file_storage' } },
    update: {},
    create: {
      tenantId: demoTenant.id,
      itemKey: 'file_storage',
      completed: true,
      reason: 'Auto-configured by platform seed',
      updatedBy: operator.id,
    }
  });

  console.log('--- M0 Platform Core Seed: Completed ---');
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
