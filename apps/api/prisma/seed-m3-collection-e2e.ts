import { InvoiceStatus, PaymentStatus, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const TENANT_SLUG = 'default-school';
const STUDENT_ID = 'c2f4a8e1-3b6d-4f2a-9e1c-7d5b6a2f9c01';
const INVOICE_ID = 'c2f4a8e1-3b6d-4f2a-9e1c-7d5b6a2f9c02';
const INVOICE_LINE_ID = 'c2f4a8e1-3b6d-4f2a-9e1c-7d5b6a2f9c03';
const FEE_HEAD_CODE = 'TUITION';
const INVOICE_TOTAL = 1000;

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://postgres:admin@localhost:5432/school_os?schema=public',
});
const prisma = new PrismaClient({ adapter });

function assertE2eFixtureAllowed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed M3 browser fixtures in production.');
  }
  if (process.env.SCHOOLOS_E2E_M3_COLLECTION_FIXTURES !== 'true') {
    throw new Error(
      'Set SCHOOLOS_E2E_M3_COLLECTION_FIXTURES=true to seed the dedicated M3 collection fixture.',
    );
  }
}

async function main() {
  assertE2eFixtureAllowed();

  const tenant = await prisma.tenant.findUnique({
    where: { slug: TENANT_SLUG },
    select: { id: true },
  });
  if (!tenant) {
    throw new Error(
      `Seed the ${TENANT_SLUG} development tenant before the M3 collection fixture.`,
    );
  }

  const [academicYear, schoolClass, feeHead] = await Promise.all([
    prisma.academicYear.findFirst({
      where: { tenantId: tenant.id, isCurrent: true },
      orderBy: { startsOn: 'desc' },
      select: { id: true },
    }),
    prisma.class.findFirst({
      where: { tenantId: tenant.id, level: 4 },
      orderBy: { name: 'asc' },
      select: { id: true },
    }),
    prisma.feeHead.findFirst({
      where: { tenantId: tenant.id, code: FEE_HEAD_CODE },
      select: { id: true },
    }),
  ]);

  if (!academicYear || !schoolClass || !feeHead) {
    throw new Error(
      'The M3 collection fixture requires the current academic year, Class 4, and a TUITION fee head.',
    );
  }

  // Remove any payments/refunds from a prior test run so the invoice always
  // restarts fully unpaid — collectPayment requires a fresh idempotency key
  // per attempt and this fixture must be safe to replay indefinitely.
  await prisma.$transaction(async (tx) => {
    const priorPayments = await tx.payment.findMany({
      where: { tenantId: tenant.id, invoiceId: INVOICE_ID },
      select: { id: true },
    });
    const priorPaymentIds = priorPayments.map((payment) => payment.id);
    if (priorPaymentIds.length > 0) {
      await tx.receipt.deleteMany({
        where: { tenantId: tenant.id, paymentId: { in: priorPaymentIds } },
      });
      await tx.paymentRefund.deleteMany({
        where: { tenantId: tenant.id, paymentId: { in: priorPaymentIds } },
      });
      await tx.payment.deleteMany({
        where: { tenantId: tenant.id, id: { in: priorPaymentIds } },
      });
    }

    await tx.student.upsert({
      where: { id: STUDENT_ID },
      update: {
        tenantId: tenant.id,
        studentSystemId: 'M3-E2E-COLLECT-01',
        firstNameEn: 'Sanjana',
        lastNameEn: 'Collection E2E',
        dateOfBirth: new Date('2016-06-01T00:00:00.000Z'),
        gender: 'FEMALE',
        admissionDate: new Date('2024-04-01T00:00:00.000Z'),
        classId: schoolClass.id,
        lifecycleStatus: 'ACTIVE',
      },
      create: {
        id: STUDENT_ID,
        tenantId: tenant.id,
        studentSystemId: 'M3-E2E-COLLECT-01',
        firstNameEn: 'Sanjana',
        lastNameEn: 'Collection E2E',
        dateOfBirth: new Date('2016-06-01T00:00:00.000Z'),
        gender: 'FEMALE',
        admissionDate: new Date('2024-04-01T00:00:00.000Z'),
        classId: schoolClass.id,
        lifecycleStatus: 'ACTIVE',
      },
    });

    await tx.invoice.upsert({
      where: { id: INVOICE_ID },
      update: {
        tenantId: tenant.id,
        studentId: STUDENT_ID,
        academicYearId: academicYear.id,
        enrollmentId: null,
        billingRunId: null,
        invoiceNumber: 'M3-E2E-COLLECT-INV-01',
        dueDate: new Date('2026-12-31T00:00:00.000Z'),
        status: InvoiceStatus.ISSUED,
        reportCardBlocked: false,
        hallTicketBlocked: false,
        subtotal: INVOICE_TOTAL,
        vatAmount: 0,
        totalAmount: INVOICE_TOTAL,
        paidAt: null,
      },
      create: {
        id: INVOICE_ID,
        tenantId: tenant.id,
        studentId: STUDENT_ID,
        academicYearId: academicYear.id,
        invoiceNumber: 'M3-E2E-COLLECT-INV-01',
        dueDate: new Date('2026-12-31T00:00:00.000Z'),
        status: InvoiceStatus.ISSUED,
        subtotal: INVOICE_TOTAL,
        vatAmount: 0,
        totalAmount: INVOICE_TOTAL,
      },
    });

    await tx.invoiceLine.upsert({
      where: { id: INVOICE_LINE_ID },
      update: {
        tenantId: tenant.id,
        invoiceId: INVOICE_ID,
        feeHeadId: feeHead.id,
        description: 'M3 E2E dedicated collection fixture tuition line',
        quantity: 1,
        unitAmount: INVOICE_TOTAL,
        vatAmount: 0,
        totalAmount: INVOICE_TOTAL,
      },
      create: {
        id: INVOICE_LINE_ID,
        tenantId: tenant.id,
        invoiceId: INVOICE_ID,
        feeHeadId: feeHead.id,
        description: 'M3 E2E dedicated collection fixture tuition line',
        quantity: 1,
        unitAmount: INVOICE_TOTAL,
        vatAmount: 0,
        totalAmount: INVOICE_TOTAL,
      },
    });
  });

  const restored = await prisma.invoice.findFirst({
    where: {
      id: INVOICE_ID,
      tenantId: tenant.id,
      status: InvoiceStatus.ISSUED,
      totalAmount: INVOICE_TOTAL,
    },
    include: { payments: { where: { status: PaymentStatus.SUCCESS } } },
  });
  if (!restored || restored.payments.length > 0) {
    throw new Error(
      'The M3 collection fixture invoice was not restored to its fully unpaid state.',
    );
  }

  console.log('Seeded dedicated M3 collection browser fixture:');
  console.log(
    `- Sanjana Collection E2E, invoice ${restored.invoiceNumber} (NPR ${String(INVOICE_TOTAL)}, unpaid)`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
