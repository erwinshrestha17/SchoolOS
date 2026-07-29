/**
 * Dedicated fixture for the parent fee-breakdown screen.
 *
 * The main seed gives every invoice a single generic tuition line, so a
 * multi-service bill - the thing a parent actually wants to understand - could
 * not be seen on a device at all. This attaches three months of realistic,
 * multi-line bills to one already-seeded guardian's first child, leaving that
 * guardian's other children untouched so the "no bills yet" state stays
 * verifiable in the same session.
 *
 * Idempotent: fixed ids, upserts throughout, and prior payments are cleared so
 * it can be replayed.
 */
import { InvoiceStatus, PaymentMethod, PrismaClient, GuardianCapability } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const TENANT_SLUG = 'default-school';
const GUARDIAN_EMAIL = 'guardian.c01b006@schoolos.test';

const ID = (suffix: string) => `f8b3c1d0-0000-4000-8000-0000000${suffix}`;

type LineSpec = { feeHeadCode: string; description: string; amount: number };

type BillSpec = {
  key: string;
  invoiceNumber: string;
  /** AD date; the app groups by the Bikram Sambat month this falls in. */
  dueDate: string;
  issuedAt: string;
  lines: LineSpec[];
  paid: number;
  status: InvoiceStatus;
};

// Three consecutive BS months. 2026-07-14 -> Asar 2083, 2026-08-13 -> Shrawan
// 2083, 2026-09-12 -> Bhadra 2083.
const BILLS: BillSpec[] = [
  {
    key: '001',
    invoiceNumber: 'FEE-BREAKDOWN-ASAR',
    dueDate: '2026-07-14T00:00:00.000Z',
    issuedAt: '2026-06-20T00:00:00.000Z',
    lines: [
      { feeHeadCode: 'TUITION', description: 'Monthly tuition', amount: 3000 },
      { feeHeadCode: 'TRANSPORT', description: 'School bus', amount: 1200 },
    ],
    paid: 4200,
    status: InvoiceStatus.PAID,
  },
  {
    key: '002',
    invoiceNumber: 'FEE-BREAKDOWN-SHRAWAN',
    dueDate: '2026-08-13T00:00:00.000Z',
    issuedAt: '2026-07-20T00:00:00.000Z',
    lines: [
      { feeHeadCode: 'TUITION', description: 'Monthly tuition', amount: 3000 },
      { feeHeadCode: 'TRANSPORT', description: 'School bus', amount: 1200 },
      { feeHeadCode: 'EXAM', description: 'First term exam', amount: 500 },
    ],
    paid: 2000,
    status: InvoiceStatus.PARTIAL,
  },
  {
    key: '003',
    invoiceNumber: 'FEE-BREAKDOWN-BHADRA',
    dueDate: '2026-09-12T00:00:00.000Z',
    issuedAt: '2026-08-20T00:00:00.000Z',
    lines: [
      { feeHeadCode: 'TUITION', description: 'Monthly tuition', amount: 3000 },
      { feeHeadCode: 'TRANSPORT', description: 'School bus', amount: 1200 },
      { feeHeadCode: 'LATEFEE', description: 'Late payment charge', amount: 200 },
    ],
    paid: 0,
    status: InvoiceStatus.ISSUED,
  },
];

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://postgres:admin@localhost:5432/school_os?schema=public',
});
const prisma = new PrismaClient({ adapter });

function assertFixtureAllowed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed parent fee fixtures in production.');
  }
  if (process.env.SCHOOLOS_PARENT_FEE_FIXTURES !== 'true') {
    throw new Error(
      'Set SCHOOLOS_PARENT_FEE_FIXTURES=true to seed the parent fee-breakdown fixture.',
    );
  }
}

async function main() {
  assertFixtureAllowed();

  const tenant = await prisma.tenant.findUnique({
    where: { slug: TENANT_SLUG },
    select: { id: true },
  });
  if (!tenant) {
    throw new Error(`Seed the ${TENANT_SLUG} tenant before this fixture.`);
  }

  const guardian = await prisma.guardian.findFirst({
    where: { tenantId: tenant.id, user: { email: GUARDIAN_EMAIL } },
    select: {
      id: true,
      fullName: true,
      studentLinks: {
        select: { studentId: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!guardian || guardian.studentLinks.length === 0) {
    throw new Error(
      `${GUARDIAN_EMAIL} must exist and have at least one linked student.`,
    );
  }
  const studentId = guardian.studentLinks[0].studentId;

  await prisma.studentGuardian.updateMany({
    where: {
      tenantId: tenant.id,
      guardianId: guardian.id,
      studentId,
      status: 'ACTIVE',
    },
    data: {
      capabilities: [
        GuardianCapability.ACADEMICS_VIEW,
        GuardianCapability.ATTENDANCE_VIEW,
        GuardianCapability.FEES_VIEW,
        GuardianCapability.FEES_PAY,
        GuardianCapability.SCHOOL_COMMUNICATE,
        GuardianCapability.COMPLAINT_OR_CORRECTION_SUBMIT,
        GuardianCapability.EMERGENCY_ALERT_RECEIVE,
      ],
    },
  });

  const student = await prisma.student.findUniqueOrThrow({
    where: { id: studentId },
    select: { firstNameEn: true, lastNameEn: true },
  });

  const academicYear = await prisma.academicYear.findFirst({
    where: { tenantId: tenant.id, isCurrent: true },
    orderBy: { startsOn: 'desc' },
    select: { id: true },
  });
  if (!academicYear) {
    throw new Error('No current academic year for this tenant.');
  }

  const feeHeadCodes = [
    ...new Set(BILLS.flatMap((bill) => bill.lines.map((l) => l.feeHeadCode))),
  ];
  const feeHeads = await prisma.feeHead.findMany({
    where: { tenantId: tenant.id, code: { in: feeHeadCodes } },
    select: { id: true, code: true, name: true },
  });
  const feeHeadByCode = new Map(feeHeads.map((head) => [head.code, head]));
  const missing = feeHeadCodes.filter((code) => !feeHeadByCode.has(code));
  if (missing.length > 0) {
    throw new Error(`Missing fee heads in this tenant: ${missing.join(', ')}`);
  }

  for (const bill of BILLS) {
    const invoiceId = ID(bill.key);
    const total = bill.lines.reduce((sum, line) => sum + line.amount, 0);

    await prisma.$transaction(async (tx) => {
      // Replayable: drop anything a previous run left behind.
      const priorPayments = await tx.payment.findMany({
        where: { tenantId: tenant.id, invoiceId },
        select: { id: true },
      });
      const priorIds = priorPayments.map((payment) => payment.id);
      if (priorIds.length > 0) {
        await tx.receipt.deleteMany({
          where: { tenantId: tenant.id, paymentId: { in: priorIds } },
        });
        await tx.paymentRefund.deleteMany({
          where: { tenantId: tenant.id, paymentId: { in: priorIds } },
        });
        await tx.payment.deleteMany({
          where: { tenantId: tenant.id, id: { in: priorIds } },
        });
      }
      await tx.invoiceLine.deleteMany({
        where: { tenantId: tenant.id, invoiceId },
      });

      const invoiceData = {
        tenantId: tenant.id,
        studentId,
        academicYearId: academicYear.id,
        invoiceNumber: bill.invoiceNumber,
        dueDate: new Date(bill.dueDate),
        issuedAt: new Date(bill.issuedAt),
        status: bill.status,
        subtotal: total,
        vatAmount: 0,
        totalAmount: total,
        paidAt: bill.status === InvoiceStatus.PAID ? new Date(bill.dueDate) : null,
      };
      await tx.invoice.upsert({
        where: { id: invoiceId },
        update: invoiceData,
        create: { id: invoiceId, ...invoiceData },
      });

      for (const [index, line] of bill.lines.entries()) {
        const head = feeHeadByCode.get(line.feeHeadCode)!;
        await tx.invoiceLine.create({
          data: {
            id: ID(`${bill.key}${index}`).slice(0, 36),
            tenantId: tenant.id,
            invoiceId,
            feeHeadId: head.id,
            description: line.description,
            quantity: 1,
            unitAmount: line.amount,
            vatAmount: 0,
            totalAmount: line.amount,
          },
        });
      }

      if (bill.paid > 0) {
        const payment = await tx.payment.create({
          data: {
            tenantId: tenant.id,
            studentId,
            invoiceId,
            method: PaymentMethod.CASH,
            referenceNumber: `PAY-${bill.invoiceNumber}`,
            amount: bill.paid,
            paidAt: new Date(bill.dueDate),
            narration: 'Parent fee-breakdown fixture payment',
          },
        });
        if (bill.status === InvoiceStatus.PAID) {
          await tx.receipt.create({
            data: {
              tenantId: tenant.id,
              paymentId: payment.id,
              receiptNumber: `RCPT-${bill.invoiceNumber}`,
            },
          });
        }
      }
    });
  }

  const child = `${student.firstNameEn} ${student.lastNameEn}`;
  console.log(
    `Seeded ${BILLS.length} itemised bills for ${child} (guardian ${GUARDIAN_EMAIL}).`,
  );
  for (const bill of BILLS) {
    const total = bill.lines.reduce((sum, line) => sum + line.amount, 0);
    console.log(
      `  ${bill.invoiceNumber}: ${bill.lines.length} lines, total ${total}, paid ${bill.paid} (${bill.status})`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
