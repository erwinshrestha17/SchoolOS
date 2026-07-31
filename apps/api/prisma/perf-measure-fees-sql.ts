/**
 * Count Prisma queries for the parent fee summary path in isolation.
 *
 * Usage:
 *   pnpm --filter @schoolos/api perf:measure-fees-sql
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

async function measureFeesQueries(fixture: Fixture) {
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

  const invoices = await prisma.invoice.findMany({
    where: {
      tenantId,
      studentId,
      status: { in: ['ISSUED', 'PARTIAL', 'PAID'] },
    },
    select: { id: true },
    orderBy: [{ dueDate: 'asc' }, { issuedAt: 'desc' }],
    take: 20,
  });

  let feesSql = 1;
  if (invoices.length === 0) {
    return {
      fixture,
      studentId,
      invoiceCount: 0,
      feesSql,
    };
  }

  const invoiceIds = invoices.map((invoice) => invoice.id);
  const [lines, payments] = await Promise.all([
    prisma.invoiceLine.findMany({
      where: { tenantId, invoiceId: { in: invoiceIds } },
      select: { feeHeadId: true },
    }),
    prisma.payment.findMany({
      where: {
        tenantId,
        invoiceId: { in: invoiceIds },
        status: 'SUCCESS',
        reversedAt: null,
      },
      select: { id: true },
    }),
  ]);
  feesSql += 2;

  const feeHeadIds = uniqueIds(lines.map((line) => line.feeHeadId));
  const paymentIds = payments.map((payment) => payment.id);
  await Promise.all([
    feeHeadIds.length
      ? prisma.feeHead.findMany({
          where: { tenantId, id: { in: feeHeadIds } },
          select: { id: true },
        })
      : Promise.resolve([]),
    paymentIds.length
      ? prisma.receipt.findMany({
          where: { tenantId, paymentId: { in: paymentIds } },
          select: { id: true },
        })
      : Promise.resolve([]),
  ]);
  if (feeHeadIds.length > 0) feesSql += 1;
  if (paymentIds.length > 0) feesSql += 1;

  return {
    fixture,
    studentId,
    invoiceCount: invoices.length,
    feesSql,
  };
}

async function main() {
  const results: Array<Awaited<ReturnType<typeof measureFeesQueries>>> = [];
  for (const fixture of ['empty', 'one', 'multi'] as Fixture[]) {
    results.push(await measureFeesQueries(fixture));
  }

  console.log(JSON.stringify(results, null, 2));
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
