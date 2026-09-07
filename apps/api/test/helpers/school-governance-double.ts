/** In-memory authority fixture. Real lock/rollback behavior is tested on PostgreSQL. */
export function installSchoolGovernanceDouble(
  prisma: {
    user: { findUnique?: jest.Mock };
    userRole: { findMany?: jest.Mock };
  },
  permissions: string[],
) {
  const assignments = prisma.userRole.findMany;
  prisma.user.findUnique = jest.fn().mockResolvedValue({
    status: 'ACTIVE',
    lockedUntil: null,
    mustChangePassword: false,
  });
  prisma.userRole.findMany = jest
    .fn()
    .mockImplementation((args: { select?: unknown }) => {
      if (args.select)
        return Promise.resolve([
          {
            role: {
              name: 'admin',
              rolePermissions: permissions.map((key) => {
                const [resource, action] = key.split(':');
                return { permission: { resource, action } };
              }),
            },
          },
        ]);
      return assignments
        ? (assignments(args) as Promise<unknown>)
        : Promise.resolve([]);
    });
  Object.assign(prisma, {
    tenant: {
      findUnique: jest.fn().mockResolvedValue({ securityDomain: 'SCHOOL' }),
    },
    refreshToken: {
      findFirst: jest.fn().mockResolvedValue({ id: 'live-session' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    otpCode: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    mobilePushToken: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    $queryRaw: jest.fn((_query: TemplateStringsArray, id: string) =>
      Promise.resolve([{ id }]),
    ),
    $transaction: jest.fn((work: (tx: unknown) => Promise<unknown>) =>
      work(prisma),
    ),
    runWithTenantScope: jest.fn(
      (_tenant: string, work: () => Promise<unknown>) => work(),
    ),
  });
}
