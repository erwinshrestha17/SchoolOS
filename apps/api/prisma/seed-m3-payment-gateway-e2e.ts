import {
  InvoiceStatus,
  PaymentStatus,
  PrismaClient,
  ProviderEnvironment,
  ProviderType,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const TENANT_SLUG = 'default-school';
const PROVIDER_NAME = 'NEPAL_GATEWAY';
const STUDENT_ID = 'c2f4a8e1-3b6d-4f2a-9e1c-7d5b6a2f9c01';
const ONLINE_INVOICE_ID = 'c2f4a8e1-3b6d-4f2a-9e1c-7d5b6a2f9c05';
const ONLINE_INVOICE_LINE_ID = 'c2f4a8e1-3b6d-4f2a-9e1c-7d5b6a2f9c06';
const ONLINE_INVOICE_TOTAL = 500;
const MOCK_GATEWAY_PORT = process.env.M3_MOCK_GATEWAY_PORT ?? '4010';
const WEBHOOK_SECRET =
  process.env.M3_MOCK_WEBHOOK_SECRET ?? 'm3-local-webhook-secret-for-verify';

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://postgres:admin@localhost:5432/school_os?schema=public',
});
const prisma = new PrismaClient({ adapter });

function assertE2eFixtureAllowed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed M3 payment gateway fixtures in production.');
  }
  if (process.env.SCHOOLOS_E2E_M3_PAYMENT_GATEWAY_FIXTURES !== 'true') {
    throw new Error(
      'Set SCHOOLOS_E2E_M3_PAYMENT_GATEWAY_FIXTURES=true to seed the M3 payment gateway fixture.',
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
      `Seed the ${TENANT_SLUG} development tenant before the M3 payment gateway fixture.`,
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
      where: { tenantId: tenant.id, code: 'TUITION' },
      select: { id: true },
    }),
  ]);

  if (!academicYear || !schoolClass || !feeHead) {
    throw new Error(
      'The M3 payment gateway fixture requires current academic year, Class 4, and TUITION fee head.',
    );
  }

  const now = new Date();
  const gatewayBase = `http://127.0.0.1:${MOCK_GATEWAY_PORT}`;

  await prisma.providerConfig.upsert({
    where: {
      type_name_environment: {
        type: ProviderType.PAYMENT_GATEWAY,
        name: PROVIDER_NAME,
        environment: ProviderEnvironment.TEST,
      },
    },
    update: {
      enabled: true,
      validationStatus: 'VALID',
      lastValidatedAt: now,
      configEncrypted: {
        adapter: 'generic_json_v1',
        merchantId: 'm3-local-merchant',
        intentUrl: `${gatewayBase}/intents`,
        settlementStatusUrl: `${gatewayBase}/settlements/status`,
        webhookUrl: 'http://127.0.0.1:4000/api/v1/payments/online/webhook/nepal_gateway',
        webhookSecret: WEBHOOK_SECRET,
        sandboxHealthUrl: `${gatewayBase}/health`,
      },
      secretKeys: [],
    },
    create: {
      type: ProviderType.PAYMENT_GATEWAY,
      name: PROVIDER_NAME,
      environment: ProviderEnvironment.TEST,
      enabled: true,
      validationStatus: 'VALID',
      lastValidatedAt: now,
      configEncrypted: {
        adapter: 'generic_json_v1',
        merchantId: 'm3-local-merchant',
        intentUrl: `${gatewayBase}/intents`,
        settlementStatusUrl: `${gatewayBase}/settlements/status`,
        webhookUrl: 'http://127.0.0.1:4000/api/v1/payments/online/webhook/nepal_gateway',
        webhookSecret: WEBHOOK_SECRET,
        sandboxHealthUrl: `${gatewayBase}/health`,
      },
      secretKeys: [],
    },
  });

  await prisma.$transaction(async (tx) => {
    const priorIntents = await tx.onlinePaymentIntent.findMany({
      where: { tenantId: tenant.id, invoiceId: ONLINE_INVOICE_ID },
      select: { id: true, paymentId: true },
    });
    const priorPaymentIds = priorIntents
      .map((intent) => intent.paymentId)
      .filter((paymentId): paymentId is string => Boolean(paymentId));

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

    await tx.onlinePaymentIntent.deleteMany({
      where: { tenantId: tenant.id, invoiceId: ONLINE_INVOICE_ID },
    });

    const priorPayments = await tx.payment.findMany({
      where: { tenantId: tenant.id, invoiceId: ONLINE_INVOICE_ID },
      select: { id: true },
    });
    const priorPaymentIdsDirect = priorPayments.map((payment) => payment.id);
    if (priorPaymentIdsDirect.length > 0) {
      await tx.receipt.deleteMany({
        where: {
          tenantId: tenant.id,
          paymentId: { in: priorPaymentIdsDirect },
        },
      });
      await tx.paymentRefund.deleteMany({
        where: {
          tenantId: tenant.id,
          paymentId: { in: priorPaymentIdsDirect },
        },
      });
      await tx.payment.deleteMany({
        where: { tenantId: tenant.id, id: { in: priorPaymentIdsDirect } },
      });
    }

    await tx.student.upsert({
      where: { id: STUDENT_ID },
      update: {
        tenantId: tenant.id,
        studentSystemId: 'M3-E2E-COLLECT-01',
        firstNameEn: 'Sanjana',
        lastNameEn: 'Collection E2E',
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
      where: { id: ONLINE_INVOICE_ID },
      update: {
        tenantId: tenant.id,
        studentId: STUDENT_ID,
        academicYearId: academicYear.id,
        invoiceNumber: 'M3-E2E-ONLINE-INV-01',
        dueDate: new Date('2026-12-31T00:00:00.000Z'),
        status: InvoiceStatus.ISSUED,
        subtotal: ONLINE_INVOICE_TOTAL,
        vatAmount: 0,
        totalAmount: ONLINE_INVOICE_TOTAL,
        paidAt: null,
      },
      create: {
        id: ONLINE_INVOICE_ID,
        tenantId: tenant.id,
        studentId: STUDENT_ID,
        academicYearId: academicYear.id,
        invoiceNumber: 'M3-E2E-ONLINE-INV-01',
        dueDate: new Date('2026-12-31T00:00:00.000Z'),
        status: InvoiceStatus.ISSUED,
        subtotal: ONLINE_INVOICE_TOTAL,
        vatAmount: 0,
        totalAmount: ONLINE_INVOICE_TOTAL,
      },
    });

    await tx.invoiceLine.upsert({
      where: { id: ONLINE_INVOICE_LINE_ID },
      update: {
        tenantId: tenant.id,
        invoiceId: ONLINE_INVOICE_ID,
        feeHeadId: feeHead.id,
        description: 'M3 online payment gateway fixture tuition line',
        quantity: 1,
        unitAmount: ONLINE_INVOICE_TOTAL,
        vatAmount: 0,
        totalAmount: ONLINE_INVOICE_TOTAL,
      },
      create: {
        id: ONLINE_INVOICE_LINE_ID,
        tenantId: tenant.id,
        invoiceId: ONLINE_INVOICE_ID,
        feeHeadId: feeHead.id,
        description: 'M3 online payment gateway fixture tuition line',
        quantity: 1,
        unitAmount: ONLINE_INVOICE_TOTAL,
        vatAmount: 0,
        totalAmount: ONLINE_INVOICE_TOTAL,
      },
    });
  });

  const restored = await prisma.invoice.findFirst({
    where: {
      id: ONLINE_INVOICE_ID,
      tenantId: tenant.id,
      status: InvoiceStatus.ISSUED,
    },
    include: { payments: { where: { status: PaymentStatus.SUCCESS } } },
  });
  if (!restored || restored.payments.length > 0) {
    throw new Error(
      'The M3 online payment fixture invoice was not restored to unpaid state.',
    );
  }

  console.log('Seeded M3 payment gateway fixture:');
  console.log(`- Provider ${PROVIDER_NAME} (TEST, VALID, generic_json_v1)`);
  console.log(
    `- Online invoice ${restored.invoiceNumber} (NPR ${String(ONLINE_INVOICE_TOTAL)}, unpaid)`,
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
