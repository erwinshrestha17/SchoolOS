/**
 * Backfills demo guardian capabilities on active verified links for staging smoke.
 * Safe to run repeatedly; only updates links with empty capabilities arrays.
 */
import { GuardianCapability, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://postgres:admin@localhost:5432/school_os?schema=public',
});

const prisma = new PrismaClient({ adapter });

const demoGuardianCapabilities: GuardianCapability[] = [
  GuardianCapability.ACADEMICS_VIEW,
  GuardianCapability.ATTENDANCE_VIEW,
  GuardianCapability.FEES_VIEW,
  GuardianCapability.SCHOOL_COMMUNICATE,
  GuardianCapability.COMPLAINT_OR_CORRECTION_SUBMIT,
  GuardianCapability.EMERGENCY_ALERT_RECEIVE,
];

async function main() {
  const updated = await prisma.studentGuardian.updateMany({
    where: {
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      approvalStatus: 'APPROVED',
      capabilities: { isEmpty: true },
    },
    data: {
      capabilities: demoGuardianCapabilities,
    },
  });
  console.log(`Backfilled capabilities on ${updated.count} guardian links.`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
