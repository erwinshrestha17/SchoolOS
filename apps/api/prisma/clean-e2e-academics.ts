import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

/**
 * Removes the M4 academics and M8 library fixtures the browser E2E specs
 * leave behind.
 *
 * `apps/api/prisma/seed-m4-report-card-e2e.ts` writes two exam terms named
 * "M4 E2E Published Term" and "M4 E2E Unpublished Term" -- plus their
 * components, mark entries, report cards and subject results -- into whatever
 * `SCHOOLOS_E2E_TENANT_SLUG` names, which in CI and on developer machines is
 * `default-school`: the same tenant the dev seed, the demo logins, the mobile
 * app and every teacher account share.
 *
 * Unlike a stray notice, an exam term is not a passive record: it appears in
 * the Exam Term selector on Marks Entry, CAS and Results for every teacher in
 * the tenant. A teacher sitting down to enter real marks was being offered
 * "M4 E2E Published Term" as a legitimate option (P0.12).
 *
 * The M8 fixture has the same problem in the library: "The Wind-Up Bird (E2E
 * Fixture)" by "M8 E2E Author" was showing up in the catalogue search every
 * teacher uses.
 *
 * Cleaning here rather than filtering in the UI is deliberate: a name
 * blocklist in the client would hide the rows while leaving them selectable
 * through the API, and would suppress a genuine record that happened to
 * match.
 *
 * Scope is intentionally narrow -- only the fixed fixture ids the seed
 * script itself declares, only in the named tenant, deleted child-first.
 * Nothing is matched by name, so a real term can never be caught by this.
 *
 * Run with `pnpm db:clean:e2e-academics`. Safe to run repeatedly, and a no-op
 * when the tenant or the records are absent.
 */

/** Must stay in step with seed-m8-library-e2e.ts. */
const FIXTURE_LIBRARY_STUDENT_ID = 'd4e8a2c1-5f3b-4a6d-9c2e-1b7d5a3f9e01';
const FIXTURE_LIBRARY_BOOK_ID = 'd4e8a2c1-5f3b-4a6d-9c2e-1b7d5a3f9e02';
const FIXTURE_LIBRARY_COPY_ID = 'd4e8a2c1-5f3b-4a6d-9c2e-1b7d5a3f9e03';

/** Must stay in step with seed-m4-report-card-e2e.ts. */
const FIXTURE_EXAM_TERM_IDS = [
  'd4a1f2b3-1c2d-4e5f-8a9b-0c1d2e3f4a01',
  'd4a1f2b3-1c2d-4e5f-8a9b-0c1d2e3f4b01',
];
const FIXTURE_COMPONENT_IDS = [
  'd4a1f2b3-1c2d-4e5f-8a9b-0c1d2e3f4a02',
  'd4a1f2b3-1c2d-4e5f-8a9b-0c1d2e3f4b02',
];
const FIXTURE_MARK_ENTRY_IDS = [
  'd4a1f2b3-1c2d-4e5f-8a9b-0c1d2e3f4a03',
  'd4a1f2b3-1c2d-4e5f-8a9b-0c1d2e3f4b03',
];
const FIXTURE_REPORT_CARD_IDS = [
  'd4a1f2b3-1c2d-4e5f-8a9b-0c1d2e3f4a04',
  'd4a1f2b3-1c2d-4e5f-8a9b-0c1d2e3f4b04',
];
const FIXTURE_SUBJECT_RESULT_IDS = [
  'd4a1f2b3-1c2d-4e5f-8a9b-0c1d2e3f4a05',
  'd4a1f2b3-1c2d-4e5f-8a9b-0c1d2e3f4b05',
];

async function main(): Promise<void> {
  const tenantSlug = process.env.SCHOOLOS_E2E_TENANT_SLUG ?? 'default-school';
  const adapter = new PrismaPg({
    connectionString:
      process.env.DATABASE_URL ??
      'postgresql://schoolos:password123@localhost:5433/schoolos_db?schema=public',
  });
  const prisma = new PrismaClient({ adapter });

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true },
    });
    if (!tenant) {
      console.info(
        `[clean-e2e-academics] no tenant "${tenantSlug}"; nothing to do`,
      );
      return;
    }

    const terms = await prisma.examTerm.findMany({
      where: { tenantId: tenant.id, id: { in: FIXTURE_EXAM_TERM_IDS } },
      select: { id: true, name: true },
    });
    if (terms.length === 0) {
      console.info('[clean-e2e-academics] no exam term fixtures to remove');
      await removeLibraryFixtures(prisma, tenant.id, tenantSlug);
      return;
    }

    // Child-first: subject results and mark entries reference the report card
    // and the component, which reference the exam term.
    await prisma.$transaction([
      prisma.reportCardSubjectResult.deleteMany({
        where: {
          tenantId: tenant.id,
          id: { in: FIXTURE_SUBJECT_RESULT_IDS },
        },
      }),
      prisma.reportCard.deleteMany({
        where: { tenantId: tenant.id, id: { in: FIXTURE_REPORT_CARD_IDS } },
      }),
      prisma.markEntry.deleteMany({
        where: { tenantId: tenant.id, id: { in: FIXTURE_MARK_ENTRY_IDS } },
      }),
      prisma.assessmentComponent.deleteMany({
        where: { tenantId: tenant.id, id: { in: FIXTURE_COMPONENT_IDS } },
      }),
      prisma.examTerm.deleteMany({
        where: { tenantId: tenant.id, id: { in: FIXTURE_EXAM_TERM_IDS } },
      }),
    ]);

    console.info(
      `[clean-e2e-academics] removed ${terms.length} exam term fixture(s) from ${tenantSlug}:`,
    );
    for (const term of terms) {
      console.info(`  - ${term.name}`);
    }

    await removeLibraryFixtures(prisma, tenant.id, tenantSlug);
  } finally {
    await prisma.$disconnect();
  }
}


/**
 * M8 library browser fixture: one book, one copy, and the demo student they
 * are issued to. Deleted child-first (fines and history reference the copy,
 * the copy references the book).
 */
async function removeLibraryFixtures(
  prisma: PrismaClient,
  tenantId: string,
  tenantSlug: string,
): Promise<void> {
  const book = await prisma.libraryBook.findFirst({
    where: { tenantId, id: FIXTURE_LIBRARY_BOOK_ID },
    select: { id: true, title: true },
  });
  if (!book) {
    console.info(`[clean-e2e-academics] no library fixture in ${tenantSlug}`);
    return;
  }

  await prisma.$transaction([
    prisma.libraryFine.deleteMany({
      where: { tenantId, issue: { copyId: FIXTURE_LIBRARY_COPY_ID } },
    }),
    prisma.libraryCopyHistory.deleteMany({
      where: { tenantId, copyId: FIXTURE_LIBRARY_COPY_ID },
    }),
    prisma.libraryReservation.deleteMany({
      where: { tenantId, bookId: FIXTURE_LIBRARY_BOOK_ID },
    }),
    prisma.libraryIssue.deleteMany({
      where: { tenantId, copyId: FIXTURE_LIBRARY_COPY_ID },
    }),
    prisma.libraryCopy.deleteMany({
      where: { tenantId, id: FIXTURE_LIBRARY_COPY_ID },
    }),
    prisma.libraryBook.deleteMany({
      where: { tenantId, id: FIXTURE_LIBRARY_BOOK_ID },
    }),
  ]);

  console.info(`[clean-e2e-academics] removed library fixture: ${book.title}`);
  // The fixture student is left in place on purpose: it may be a real seeded
  // demo student the M8 seed merely reused, and deleting a Student cascades
  // into attendance, fees and enrolment history.
  void FIXTURE_LIBRARY_STUDENT_ID;
}

main().catch((error) => {
  console.error('[clean-e2e-academics] failed:', error);
  process.exitCode = 1;
});
