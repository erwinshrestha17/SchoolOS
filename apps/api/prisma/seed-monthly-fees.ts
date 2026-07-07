import {
  EnrollmentStatus,
  FeeFrequency,
  InvoiceStatus,
  PaymentMethod,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://postgres:admin@localhost:5432/school_os?schema=public',
});

const prisma = new PrismaClient({ adapter });

const canonicalAdmissionPrefix = 'EA-2083-';
const canonicalStudentCount = 689;

const gradeMonthlyFeeTotals: Record<number, number> = {
  1: 3500,
  2: 3600,
  3: 3750,
  4: 4000,
  5: 4250,
  6: 4500,
  7: 4750,
  8: 5000,
  9: 5500,
  10: 6000,
  11: 6500,
  12: 7000,
};

const feeHeadDefinitions = [
  {
    code: 'TUITION',
    name: 'Tuition Fee',
  },
  {
    code: 'COMPUTER',
    name: 'Computer and Digital Learning Fee',
  },
  {
    code: 'ACTIVITY',
    name: 'Activity Fee',
  },
  {
    code: 'SCIENCE_LAB',
    name: 'Science and Lab Fee',
  },
] as const;

type FeeComponent = {
  code: (typeof feeHeadDefinitions)[number]['code'];
  name: (typeof feeHeadDefinitions)[number]['name'];
  amount: Prisma.Decimal;
};

function assertDevelopmentSeedAllowed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Refusing to run development monthly-fee seed with NODE_ENV=production.',
    );
  }
}

function monthStart(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function monthToken(value: Date) {
  return `${value.getUTCFullYear()}${String(value.getUTCMonth() + 1).padStart(2, '0')}`;
}

function gradeFromClassName(className: string) {
  const match = /^(?:Class|Grade)\s+(\d+)$/.exec(className.trim());
  return match ? Number(match[1]) : null;
}

function monthlyFeeComponents(total: number): FeeComponent[] {
  const computer = Math.round(total * 0.1);
  const activity = Math.round(total * 0.08);
  const scienceLab = Math.round(total * 0.07);
  const tuition = total - computer - activity - scienceLab;

  return [
    {
      code: 'TUITION',
      name: 'Tuition Fee',
      amount: new Prisma.Decimal(tuition),
    },
    {
      code: 'COMPUTER',
      name: 'Computer and Digital Learning Fee',
      amount: new Prisma.Decimal(computer),
    },
    {
      code: 'ACTIVITY',
      name: 'Activity Fee',
      amount: new Prisma.Decimal(activity),
    },
    {
      code: 'SCIENCE_LAB',
      name: 'Science and Lab Fee',
      amount: new Prisma.Decimal(scienceLab),
    },
  ];
}

function monthlyInvoiceStatus(rollNumber: number): InvoiceStatus {
  const bucket = rollNumber % 10;
  if (bucket === 0 || bucket === 1) return InvoiceStatus.PAID;
  if (bucket === 2 || bucket === 3) return InvoiceStatus.PARTIAL;
  return InvoiceStatus.ISSUED;
}

function paymentAmountFor(
  total: Prisma.Decimal,
  invoiceStatus: InvoiceStatus,
) {
  return invoiceStatus === InvoiceStatus.PAID ? total : total.div(2);
}

async function seedFeeHeads(tenantId: string) {
  const feeHeads = new Map<string, { id: string }>();

  for (const feeHead of feeHeadDefinitions) {
    const record = await prisma.feeHead.upsert({
      where: {
        tenantId_code: {
          tenantId,
          code: feeHead.code,
        },
      },
      update: {
        name: feeHead.name,
        frequency: FeeFrequency.MONTHLY,
        isActive: true,
      },
      create: {
        tenantId,
        code: feeHead.code,
        name: feeHead.name,
        frequency: FeeFrequency.MONTHLY,
        defaultAmount: new Prisma.Decimal(0),
        vatApplicable: false,
        isActive: true,
      },
      select: { id: true },
    });

    feeHeads.set(feeHead.code, record);
  }

  return feeHeads;
}

async function seedGradeFeePlan({
  tenantId,
  academicYearId,
  classId,
  className,
  grade,
  feeHeadIds,
}: {
  tenantId: string;
  academicYearId: string;
  classId: string;
  className: string;
  grade: number;
  feeHeadIds: Map<string, { id: string }>;
}) {
  const total = gradeMonthlyFeeTotals[grade];
  if (!total) {
    throw new Error(`Missing monthly fee total for ${className}.`);
  }

  const feePlanCode = `GRADE-${grade}-MONTHLY-${academicYearId}`;
  const feePlan = await prisma.feePlan.upsert({
    where: {
      tenantId_code: {
        tenantId,
        code: feePlanCode,
      },
    },
    update: {
      academicYearId,
      classId,
      name: `${className} monthly fee plan`,
      isActive: true,
    },
    create: {
      tenantId,
      academicYearId,
      classId,
      code: feePlanCode,
      name: `${className} monthly fee plan`,
      isActive: true,
    },
  });

  const components = monthlyFeeComponents(total);
  for (const component of components) {
    const feeHead = feeHeadIds.get(component.code);
    if (!feeHead) {
      throw new Error(`Missing fee head ${component.code}.`);
    }

    await prisma.feePlanItem.upsert({
      where: {
        feePlanId_feeHeadId: {
          feePlanId: feePlan.id,
          feeHeadId: feeHead.id,
        },
      },
      update: { amount: component.amount },
      create: {
        tenantId,
        feePlanId: feePlan.id,
        feeHeadId: feeHead.id,
        amount: component.amount,
      },
    });
  }

  return { feePlan, components };
}

async function seedStudentMonthlyInvoices({
  tenantId,
  academicYearId,
  classId,
  components,
  feeHeadIds,
  now,
}: {
  tenantId: string;
  academicYearId: string;
  classId: string;
  components: FeeComponent[];
  feeHeadIds: Map<string, { id: string }>;
  now: Date;
}) {
  const currentMonthStart = monthStart(now);
  const token = monthToken(now);
  const dueDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 15),
  );
  const total = components.reduce(
    (sum, component) => sum.plus(component.amount),
    new Prisma.Decimal(0),
  );
  const enrollments = await prisma.enrollment.findMany({
    where: {
      tenantId,
      academicYearId,
      classId,
      status: EnrollmentStatus.ACTIVE,
      student: {
        studentSystemId: { startsWith: canonicalAdmissionPrefix },
      },
    },
    select: {
      id: true,
      rollNumber: true,
      student: {
        select: {
          id: true,
          studentSystemId: true,
        },
      },
    },
    orderBy: [{ rollNumber: 'asc' }, { student: { studentSystemId: 'asc' } }],
  });

  for (const enrollment of enrollments) {
    const invoiceNumber = `MFI-${token}-${enrollment.student.studentSystemId}`;
    const status = monthlyInvoiceStatus(enrollment.rollNumber ?? 0);
    const invoice = await prisma.invoice.upsert({
      where: {
        tenantId_invoiceNumber: {
          tenantId,
          invoiceNumber,
        },
      },
      update: {
        studentId: enrollment.student.id,
        academicYearId,
        enrollmentId: enrollment.id,
        dueDate,
        status,
        subtotal: total,
        vatAmount: new Prisma.Decimal(0),
        totalAmount: total,
        issuedAt: currentMonthStart,
        paidAt: status === InvoiceStatus.PAID ? now : null,
      },
      create: {
        tenantId,
        studentId: enrollment.student.id,
        academicYearId,
        enrollmentId: enrollment.id,
        invoiceNumber,
        dueDate,
        status,
        subtotal: total,
        vatAmount: new Prisma.Decimal(0),
        totalAmount: total,
        issuedAt: currentMonthStart,
        paidAt: status === InvoiceStatus.PAID ? now : null,
      },
    });

    await prisma.invoiceLine.deleteMany({
      where: { tenantId, invoiceId: invoice.id },
    });
    await prisma.invoiceLine.createMany({
      data: components.map((component) => {
        const feeHead = feeHeadIds.get(component.code);
        if (!feeHead) {
          throw new Error(`Missing fee head ${component.code}.`);
        }
        return {
          tenantId,
          invoiceId: invoice.id,
          feeHeadId: feeHead.id,
          description: `${component.name} — ${token}`,
          quantity: 1,
          unitAmount: component.amount,
          vatAmount: new Prisma.Decimal(0),
          totalAmount: component.amount,
        };
      }),
    });

    if (status === InvoiceStatus.ISSUED) continue;

    const paymentIdempotencyKey = `seed:monthly-fee:${invoiceNumber}:payment`;
    const paidAmount = paymentAmountFor(total, status);
    const payment = await prisma.payment.upsert({
      where: {
        tenantId_idempotencyKey: {
          tenantId,
          idempotencyKey: paymentIdempotencyKey,
        },
      },
      update: {
        studentId: enrollment.student.id,
        invoiceId: invoice.id,
        method: PaymentMethod.CASH,
        amount: paidAmount,
        paidAt: now,
        narration: 'Canonical monthly development seed payment',
      },
      create: {
        tenantId,
        studentId: enrollment.student.id,
        invoiceId: invoice.id,
        method: PaymentMethod.CASH,
        amount: paidAmount,
        paidAt: now,
        referenceNumber: `PAY-${invoiceNumber}`,
        idempotencyKey: paymentIdempotencyKey,
        narration: 'Canonical monthly development seed payment',
      },
    });

    await prisma.receipt.upsert({
      where: {
        tenantId_receiptNumber: {
          tenantId,
          receiptNumber: `RCPT-${invoiceNumber}`,
        },
      },
      update: {
        paymentId: payment.id,
        pdfUrl: null,
      },
      create: {
        tenantId,
        paymentId: payment.id,
        receiptNumber: `RCPT-${invoiceNumber}`,
        pdfUrl: null,
      },
    });
  }

  return { enrollmentCount: enrollments.length };
}

async function main() {
  assertDevelopmentSeedAllowed();
  console.log('🌱 Seeding monthly fee plans and invoices for Grade 1-12...');

  const tenant = await prisma.tenant.findUnique({
    where: { slug: 'default-school' },
    select: { id: true },
  });
  if (!tenant) {
    throw new Error('Default development tenant must exist before monthly fee seed.');
  }

  const academicYear = await prisma.academicYear.findFirst({
    where: { tenantId: tenant.id, isCurrent: true },
    orderBy: { startsOn: 'desc' },
    select: { id: true },
  });
  if (!academicYear) {
    throw new Error('Current academic year must exist before monthly fee seed.');
  }

  const feeHeadIds = await seedFeeHeads(tenant.id);
  const classes = await prisma.class.findMany({
    where: {
      tenantId: tenant.id,
      name: {
        in: Object.keys(gradeMonthlyFeeTotals).map((grade) => `Class ${grade}`),
      },
    },
    select: { id: true, name: true, level: true },
    orderBy: { level: 'asc' },
  });

  if (classes.length !== Object.keys(gradeMonthlyFeeTotals).length) {
    throw new Error('Monthly fee seed expected Class 1 through Class 12.');
  }

  const now = new Date();
  let seededStudents = 0;
  for (const cls of classes) {
    const grade = gradeFromClassName(cls.name);
    if (!grade) {
      throw new Error(`Unable to determine grade from ${cls.name}.`);
    }

    const { feePlan, components } = await seedGradeFeePlan({
      tenantId: tenant.id,
      academicYearId: academicYear.id,
      classId: cls.id,
      className: cls.name,
      grade,
      feeHeadIds,
    });

    const assignments = await prisma.enrollment.findMany({
      where: {
        tenantId: tenant.id,
        academicYearId: academicYear.id,
        classId: cls.id,
        status: EnrollmentStatus.ACTIVE,
        student: {
          studentSystemId: { startsWith: canonicalAdmissionPrefix },
        },
      },
      select: { studentId: true },
    });

    for (const enrollment of assignments) {
      await prisma.studentFeeAssignment.upsert({
        where: {
          studentId_feePlanId_academicYearId: {
            studentId: enrollment.studentId,
            feePlanId: feePlan.id,
            academicYearId: academicYear.id,
          },
        },
        update: { isActive: true },
        create: {
          tenantId: tenant.id,
          studentId: enrollment.studentId,
          feePlanId: feePlan.id,
          academicYearId: academicYear.id,
          isActive: true,
        },
      });
    }

    const result = await seedStudentMonthlyInvoices({
      tenantId: tenant.id,
      academicYearId: academicYear.id,
      classId: cls.id,
      components,
      feeHeadIds,
      now,
    });
    seededStudents += result.enrollmentCount;
  }

  if (seededStudents !== canonicalStudentCount) {
    throw new Error(
      `Monthly fee seed expected ${canonicalStudentCount} canonical students, received ${seededStudents}.`,
    );
  }

  console.log(
    `✅ Seeded monthly fee plans, assignments, and invoices for ${seededStudents} Grade 1-12 students.`,
  );
}

main()
  .catch((error) => {
    console.error('❌ Monthly fee seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
