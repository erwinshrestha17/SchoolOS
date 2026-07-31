/**
 * Count Prisma queries for the parent activity dashboard path in isolation.
 *
 * Usage:
 *   pnpm --filter @schoolos/api perf:measure-activity-sql
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

async function measureActivityQueries(fixture: Fixture) {
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

  // Mirror getStudentActivityFeed phase 1–2 without auth overhead.
  const posts = await prisma.activityPost.findMany({
    where: {
      tenantId: tenant.id,
      status: 'APPROVED',
      softDeletedAt: null,
      parentVisible: true,
      OR: [
        { audienceType: 'ALL' },
        { audienceType: 'STUDENT', studentTags: { some: { studentId: student.id } } },
        { audienceType: 'CLASS', classId: student.classId },
        {
          audienceType: 'SECTION',
          classId: student.classId,
          sectionId: student.sectionId,
        },
      ],
    },
    select: {
      id: true,
      title: true,
      caption: true,
      category: true,
      publishedAt: true,
      createdAt: true,
    },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    take: 1,
  });

  let activityQueries = 1;
  if (posts.length > 0) {
    const postIds = posts.map((post) => post.id);
    await Promise.all([
      prisma.activityAttachment.findMany({
        where: { tenantId: tenant.id, activityPostId: { in: postIds } },
        select: { id: true },
      }),
      prisma.activityReaction.findMany({
        where: { tenantId: tenant.id, activityPostId: { in: postIds } },
        select: { id: true },
      }),
    ]);
    activityQueries = 3;
  }

  return {
    fixture,
    studentId: student.id,
    latestTitle: posts[0]?.title ?? null,
    activitySql: activityQueries,
  };
}

async function main() {
  const results: Array<Awaited<ReturnType<typeof measureActivityQueries>>> = [];
  for (const fixture of ['empty', 'one', 'multi'] as Fixture[]) {
    results.push(await measureActivityQueries(fixture));
  }

  console.log(JSON.stringify(results, null, 2));
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
