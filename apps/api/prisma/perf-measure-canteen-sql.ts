/**
 * Count Prisma queries for the parent canteen dashboard path in isolation.
 *
 * Usage:
 *   pnpm --filter @schoolos/api perf:measure-canteen-sql
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

type Fixture = 'empty' | 'one' | 'multi';

const FIXTURE_EMAIL: Record<Fixture, string> = {
  empty: `parent-perf-empty@${SLUG}.test`,
  one: `parent-perf-one@${SLUG}.test`,
  multi: `parent-perf-multi@${SLUG}.test`,
};

function uniqueIds(ids: Array<string | null | undefined>) {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))].sort();
}

async function measureCanteenQueries(fixture: Fixture) {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: SLUG } });
  const user = await prisma.user.findFirstOrThrow({
    where: { tenantId: tenant.id, email: FIXTURE_EMAIL[fixture] },
  });
  const guardian = await prisma.guardian.findFirstOrThrow({
    where: { tenantId: tenant.id, userId: user.id },
    include: {
      studentLinks: {
        where: { status: 'ACTIVE' },
        include: { student: true },
        take: 1,
      },
    },
  });
  const student = guardian.studentLinks[0]?.student;
  if (!student) {
    throw new Error(`Fixture ${fixture} has no linked student`);
  }

  const tenantId = tenant.id;
  const studentId = student.id;

  // Mirror getStudentCanteen phases without auth overhead.
  const [wallet, enrollments, menuItems] = await Promise.all([
    prisma.canteenWallet.findFirst({ where: { tenantId, studentId } }),
    prisma.canteenStudentEnrollment.findMany({
      where: { tenantId, studentId, status: 'ACTIVE' },
      select: { id: true, mealPlanId: true },
      take: 5,
    }),
    prisma.canteenMenuItem.findMany({
      where: { tenantId, status: 'ACTIVE' },
      take: 25,
    }),
  ]);

  let canteenQueries = 3;
  const hasWalletOrEnrollment = wallet !== null || enrollments.length > 0;

  let recentServings: { mealPlanId: string | null }[] = [];
  if (hasWalletOrEnrollment) {
    const [transactions, servings] = await Promise.all([
      prisma.canteenWalletTransaction.findMany({
        where: { tenantId, studentId },
        take: 10,
      }),
      prisma.canteenMealServing.findMany({
        where: { tenantId, studentId },
        select: { mealPlanId: true },
        take: 30,
      }),
    ]);
    recentServings = servings;
    canteenQueries += 2;
    void transactions;
  }

  const mealPlanIds = uniqueIds([
    ...enrollments.map((enrollment) => enrollment.mealPlanId),
    ...recentServings.map((serving) => serving.mealPlanId),
  ]);
  if (mealPlanIds.length > 0) {
    await prisma.canteenMealPlan.findMany({
      where: { tenantId, id: { in: mealPlanIds } },
    });
    canteenQueries += 1;
  }

  return {
    fixture,
    studentId,
    hasWallet: wallet !== null,
    activeEnrollments: enrollments.length,
    menuItemCount: menuItems.length,
    canteenSql: canteenQueries,
  };
}

async function main() {
  const results: Array<Awaited<ReturnType<typeof measureCanteenQueries>>> = [];
  for (const fixture of ['empty', 'one', 'multi'] as Fixture[]) {
    results.push(await measureCanteenQueries(fixture));
  }

  console.log(JSON.stringify(results, null, 2));
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
