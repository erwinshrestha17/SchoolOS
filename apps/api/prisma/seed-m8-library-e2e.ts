import { LibraryCopyStatus, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const TENANT_SLUG = 'default-school';
const STUDENT_ID = 'd4e8a2c1-5f3b-4a6d-9c2e-1b7d5a3f9e01';
const BOOK_ID = 'd4e8a2c1-5f3b-4a6d-9c2e-1b7d5a3f9e02';
const COPY_ID = 'd4e8a2c1-5f3b-4a6d-9c2e-1b7d5a3f9e03';

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://postgres:admin@localhost:5432/school_os?schema=public',
});
const prisma = new PrismaClient({ adapter });

function assertE2eFixtureAllowed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed M8 browser fixtures in production.');
  }
  if (process.env.SCHOOLOS_E2E_M8_LIBRARY_FIXTURES !== 'true') {
    throw new Error(
      'Set SCHOOLOS_E2E_M8_LIBRARY_FIXTURES=true to seed the dedicated M8 library fixture.',
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
      `Seed the ${TENANT_SLUG} development tenant before the M8 library fixture.`,
    );
  }

  const schoolClass = await prisma.class.findFirst({
    where: { tenantId: tenant.id, level: 3 },
    orderBy: { name: 'asc' },
    select: { id: true },
  });
  if (!schoolClass) {
    throw new Error('The M8 library fixture requires Class 3 to exist.');
  }

  // Reset to a fully clean, replayable state: no fines, no issue history, the
  // copy back to AVAILABLE. Issue/return/fine flows are exercised repeatedly
  // by the browser E2E test, so this fixture must be safe to reseed anytime.
  await prisma.$transaction(async (tx) => {
    await tx.libraryFine.deleteMany({
      where: { tenantId: tenant.id, issue: { copyId: COPY_ID } },
    });
    await tx.libraryCopyHistory.deleteMany({
      where: { tenantId: tenant.id, copyId: COPY_ID },
    });
    await tx.libraryReservation.deleteMany({
      where: { tenantId: tenant.id, copyId: COPY_ID },
    });
    await tx.libraryIssue.deleteMany({
      where: { tenantId: tenant.id, copyId: COPY_ID },
    });

    await tx.student.upsert({
      where: { id: STUDENT_ID },
      update: {
        tenantId: tenant.id,
        studentSystemId: 'M8-E2E-LIBRARY-01',
        firstNameEn: 'Ashika',
        lastNameEn: 'Library E2E',
        dateOfBirth: new Date('2017-03-10T00:00:00.000Z'),
        gender: 'FEMALE',
        admissionDate: new Date('2024-04-01T00:00:00.000Z'),
        classId: schoolClass.id,
        lifecycleStatus: 'ACTIVE',
      },
      create: {
        id: STUDENT_ID,
        tenantId: tenant.id,
        studentSystemId: 'M8-E2E-LIBRARY-01',
        firstNameEn: 'Ashika',
        lastNameEn: 'Library E2E',
        dateOfBirth: new Date('2017-03-10T00:00:00.000Z'),
        gender: 'FEMALE',
        admissionDate: new Date('2024-04-01T00:00:00.000Z'),
        classId: schoolClass.id,
        lifecycleStatus: 'ACTIVE',
      },
    });

    await tx.libraryBook.upsert({
      where: { id: BOOK_ID },
      update: {
        tenantId: tenant.id,
        title: 'The Wind-Up Bird (E2E Fixture)',
        author: 'M8 E2E Author',
        isbn: '978-9999900001',
        subjectCategory: 'Fiction',
        archivedAt: null,
        archiveReason: null,
      },
      create: {
        id: BOOK_ID,
        tenantId: tenant.id,
        title: 'The Wind-Up Bird (E2E Fixture)',
        author: 'M8 E2E Author',
        isbn: '978-9999900001',
        subjectCategory: 'Fiction',
      },
    });

    await tx.libraryCopy.upsert({
      where: { id: COPY_ID },
      update: {
        tenantId: tenant.id,
        bookId: BOOK_ID,
        barcode: 'LIB-E2E-0001',
        qrCode: 'LIB-E2E-0001',
        shelfLocation: 'E2E-Shelf',
        status: LibraryCopyStatus.AVAILABLE,
        archivedAt: null,
        archiveReason: null,
      },
      create: {
        id: COPY_ID,
        tenantId: tenant.id,
        bookId: BOOK_ID,
        barcode: 'LIB-E2E-0001',
        qrCode: 'LIB-E2E-0001',
        shelfLocation: 'E2E-Shelf',
        status: LibraryCopyStatus.AVAILABLE,
      },
    });
  });

  const restored = await prisma.libraryCopy.findFirst({
    where: {
      id: COPY_ID,
      tenantId: tenant.id,
      status: LibraryCopyStatus.AVAILABLE,
    },
    include: { issues: true, book: true },
  });
  if (!restored || restored.issues.length > 0) {
    throw new Error(
      'The M8 library fixture copy was not restored to a clean AVAILABLE state.',
    );
  }

  console.log('Seeded dedicated M8 library browser fixture:');
  console.log(
    `- Ashika Library E2E (student), "${restored.book.title}" copy ${restored.barcode} (AVAILABLE, no prior issues/fines)`,
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
