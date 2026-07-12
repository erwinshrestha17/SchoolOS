import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

async function checkToken() {
  const token = process.env.TOKEN_TO_CHECK?.trim();
  if (!token) {
    throw new Error('TOKEN_TO_CHECK is required');
  }

  const session = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        include: {
          userRoles: {
            include: {
              role: {
                include: {
                  rolePermissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!session) {
    console.log('Session not found');
    return;
  }

  console.log('Session found for user:', session.user.email);
  console.log('User status:', session.user.status);
  console.log('Tenant ID:', session.user.tenantId);

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
  });

  console.log('Tenant found:', tenant?.slug);
  console.log('Tenant active:', tenant?.isActive);

  // Check for any potential nulls in roles/permissions
  session.user.userRoles.forEach((ur, i) => {
    if (!ur.role) console.log(`UserRole ${i} has no role`);
    else {
      ur.role.rolePermissions.forEach((rp, j) => {
        if (!rp.permission)
          console.log(
            `RolePermission ${j} in role ${ur.role.name} has no permission`,
          );
      });
    }
  });
}

checkToken()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
