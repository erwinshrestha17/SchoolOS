import type { AuthContext } from '../auth/auth.types';
import { StreamsService } from './streams.service';

const actor = { tenantId: 'tenant-a', userId: 'user-1' } as AuthContext;

describe('StreamsService', () => {
  it('lists tenant-scoped streams with class counts', async () => {
    const prisma = {
      stream: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'stream-1',
            name: 'Science',
            code: 'SCI',
            isActive: true,
            _count: { classes: 2 },
          },
        ]),
      },
    };
    const service = new StreamsService(prisma as never, {} as never);

    const result = await service.listStreams(actor);

    expect(prisma.stream.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a' },
      include: { _count: { select: { classes: true } } },
      orderBy: { name: 'asc' },
    });
    expect(result).toEqual([
      {
        id: 'stream-1',
        name: 'Science',
        code: 'SCI',
        isActive: true,
        classCount: 2,
      },
    ]);
  });

  it('creates a stream and records an audit entry', async () => {
    const prisma = {
      stream: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockResolvedValue({ id: 'stream-1', name: 'Science', code: 'SCI' }),
      },
    };
    const auditService = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new StreamsService(prisma as never, auditService as never);

    const result = await service.createStream(
      { name: 'Science', code: 'SCI' },
      actor,
    );

    expect(prisma.stream.create).toHaveBeenCalledWith({
      data: { tenantId: 'tenant-a', name: 'Science', code: 'SCI' },
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'create',
        resource: 'stream',
        tenantId: 'tenant-a',
        resourceId: 'stream-1',
      }),
    );
    expect(result).toEqual({ id: 'stream-1', name: 'Science', code: 'SCI' });
  });

  it('rejects a duplicate stream name or code within the tenant', async () => {
    const prisma = {
      stream: {
        findFirst: jest.fn().mockResolvedValue({ id: 'existing' }),
        create: jest.fn(),
      },
    };
    const service = new StreamsService(prisma as never, {} as never);

    await expect(
      service.createStream({ name: 'Science', code: 'SCI' }, actor),
    ).rejects.toThrow('already exists');
    expect(prisma.stream.create).not.toHaveBeenCalled();
  });
});
