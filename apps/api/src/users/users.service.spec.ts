import { ConflictException, NotFoundException } from '@nestjs/common';
import { AuthMethod } from '@prisma/client';
import { UsersService } from './users.service';
import { AuthContext } from '../auth/auth.types';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: any;
  let configService: any;
  let auditService: any;
  let actor: AuthContext;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      role: {
        findMany: jest.fn(),
      },
    };
    configService = { bcryptRounds: 4 };
    auditService = { record: jest.fn() };
    actor = {
      userId: 'admin-1',
      tenantId: 'tenant-1',
      tenantSlug: 'school-a',
      email: 'admin@school.com',
      authMethod: AuthMethod.PASSWORD,
      roles: ['admin'],
      permissions: ['users:create'],
    };

    service = new UsersService(prisma, configService, auditService);
  });

  it('creates a tenant-scoped user with hashed password and roles', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.role.findMany.mockResolvedValue([
      { id: 'role-1', name: 'teacher' },
      { id: 'role-2', name: 'librarian' },
    ]);
    prisma.user.create.mockImplementation(async ({ data }: any) => ({
      id: 'user-2',
      email: data.email,
      phone: data.phone,
      status: 'ACTIVE',
      userRoles: [
        { role: { id: 'role-1', name: 'teacher' } },
        { role: { id: 'role-2', name: 'librarian' } },
      ],
    }));

    const result = await service.createUser(
      {
        email: 'teacher@school.com',
        password: 'password123',
        roleIds: ['role-1', 'role-2'],
      },
      actor,
    );

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          email: 'teacher@school.com',
          passwordHash: expect.any(String),
        }),
      }),
    );
    expect(result.roles).toHaveLength(2);
    expect(auditService.record).toHaveBeenCalled();
  });

  it('rejects duplicate email in the same tenant', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

    await expect(
      service.createUser(
        {
          email: 'teacher@school.com',
          password: 'password123',
          roleIds: ['role-1'],
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('allows same email in a different tenant because lookup is tenant scoped', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.role.findMany.mockResolvedValue([{ id: 'role-1', name: 'teacher' }]);
    prisma.user.create.mockResolvedValue({
      id: 'user-3',
      email: 'shared@school.com',
      phone: null,
      status: 'ACTIVE',
      userRoles: [{ role: { id: 'role-1', name: 'teacher' } }],
    });

    await service.createUser(
      {
        email: 'shared@school.com',
        password: 'password123',
        roleIds: ['role-1'],
      },
      actor,
    );

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: {
        tenantId_email: {
          tenantId: 'tenant-1',
          email: 'shared@school.com',
        },
      },
    });
  });

  it('rejects roles outside the tenant', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.role.findMany.mockResolvedValue([]);

    await expect(
      service.createUser(
        {
          email: 'teacher@school.com',
          password: 'password123',
          roleIds: ['missing-role'],
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
