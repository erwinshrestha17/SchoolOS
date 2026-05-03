import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAudit() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  console.log('Last 10 Audit Logs:');
  logs.forEach(log => {
    console.log(`[${log.createdAt.toISOString()}] ${log.action} ${log.resource} by ${log.userId}`);
    if (log.after) console.log('After:', JSON.stringify(log.after));
  });
}

checkAudit()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
