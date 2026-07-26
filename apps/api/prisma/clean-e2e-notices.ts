import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

/**
 * Removes the notices the authenticated web E2E specs leave behind.
 *
 * `apps/web/e2e/m12-m15-notice-workflows.spec.ts` publishes notices titled
 * `E2E <kind> <epoch>` to `audienceType: ALL`, and there is deliberately no
 * delete endpoint for notices - they are auditable records. The suite runs
 * against whatever `SCHOOLOS_E2E_TENANT_SLUG` names, which in
 * `.github/workflows/ci.yml` is `default-school`: the same tenant the dev
 * seed, the demo logins and the mobile app all share. In CI the database is
 * ephemeral and this costs nothing; on a developer machine the notices
 * accumulated until a guardian's mobile dashboard showed
 * "E2E scheduled notice 1784869836649" as the latest school update.
 *
 * Cleaning the record here rather than filtering it in the client is
 * deliberate: a title blocklist in the app would suppress genuine school
 * notices that happen to mention E2E, and would leave the rows in place.
 *
 * Scope is intentionally narrow:
 *  - `Notice` rows only, only in the named tenant, only titles starting
 *    `E2E ` - the prefix every spec uses.
 *  - `NotificationDelivery` and `NoticeAcknowledgement` first; they are the
 *    only two tables holding a foreign key onto Notice.
 *
 * Other E2E artefacts (journal entries, leave requests, canteen vouchers) are
 * left alone. None is parent-visible, and each sits behind accounting or
 * approval constraints that need their own considered cleanup.
 *
 * Run with `pnpm db:clean:e2e-notices`. Safe to run repeatedly, and a no-op
 * when the tenant or the records are absent.
 */
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
      console.info(`[clean-e2e-notices] no tenant "${tenantSlug}"; nothing to do`);
      return;
    }

    const notices = await prisma.notice.findMany({
      where: { tenantId: tenant.id, title: { startsWith: 'E2E ' } },
      select: { id: true, title: true },
    });
    if (notices.length === 0) {
      console.info(`[clean-e2e-notices] ${tenantSlug} is already clean`);
      return;
    }

    const noticeIds = notices.map((notice) => notice.id);
    await prisma.$transaction([
      prisma.notificationDelivery.deleteMany({
        where: { noticeId: { in: noticeIds } },
      }),
      prisma.noticeAcknowledgement.deleteMany({
        where: { noticeId: { in: noticeIds } },
      }),
      prisma.notice.deleteMany({ where: { id: { in: noticeIds } } }),
    ]);

    console.info(
      `[clean-e2e-notices] removed ${noticeIds.length} notice(s) from ${tenantSlug}:`,
    );
    for (const notice of notices) {
      console.info(`  - ${notice.title}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[clean-e2e-notices] failed:', error);
  process.exitCode = 1;
});
