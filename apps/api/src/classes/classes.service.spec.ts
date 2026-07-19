import type { AuthContext } from '../auth/auth.types';
import { ClassesService } from './classes.service';

const actor = { tenantId: 'tenant-a', userId: 'user-1' } as AuthContext;

describe('ClassesService.assignClassStream', () => {
  it('assigns a stream to a Higher Secondary class and records an audit entry', async () => {
    const prisma = {
      class: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'class-11',
          tenantId: 'tenant-a',
          level: 11,
          streamId: null,
        }),
        update: jest.fn().mockResolvedValue({
          id: 'class-11',
          name: 'Class 11',
          level: 11,
          streamId: 'stream-1',
          stream: { name: 'Science' },
        }),
      },
      stream: {
        findFirst: jest.fn().mockResolvedValue({ id: 'stream-1' }),
      },
    };
    const auditService = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new ClassesService(prisma as never, auditService as never);

    const result = await service.assignClassStream(
      'class-11',
      { streamId: 'stream-1' },
      actor,
    );

    expect(prisma.class.update).toHaveBeenCalledWith({
      where: { id: 'class-11' },
      data: { streamId: 'stream-1' },
      include: { stream: true },
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        resource: 'class',
        resourceId: 'class-11',
        before: { streamId: null },
        after: { streamId: 'stream-1' },
      }),
    );
    expect(result).toEqual({
      id: 'class-11',
      name: 'Class 11',
      level: 11,
      streamId: 'stream-1',
      streamName: 'Science',
    });
  });

  it('rejects stream assignment for classes below Higher Secondary level', async () => {
    const prisma = {
      class: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'class-8',
          tenantId: 'tenant-a',
          level: 8,
          streamId: null,
        }),
        update: jest.fn(),
      },
      stream: { findFirst: jest.fn() },
    };
    const service = new ClassesService(prisma as never, {} as never);

    await expect(
      service.assignClassStream('class-8', { streamId: 'stream-1' }, actor),
    ).rejects.toThrow('Higher Secondary');
    expect(prisma.class.update).not.toHaveBeenCalled();
    expect(prisma.stream.findFirst).not.toHaveBeenCalled();
  });

  it('rejects an unknown stream id in the tenant', async () => {
    const prisma = {
      class: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'class-11',
          tenantId: 'tenant-a',
          level: 11,
          streamId: null,
        }),
        update: jest.fn(),
      },
      stream: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new ClassesService(prisma as never, {} as never);

    await expect(
      service.assignClassStream('class-11', { streamId: 'missing' }, actor),
    ).rejects.toThrow('Stream not found');
    expect(prisma.class.update).not.toHaveBeenCalled();
  });

  it('allows clearing a class stream assignment with a null streamId', async () => {
    const prisma = {
      class: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'class-11',
          tenantId: 'tenant-a',
          level: 11,
          streamId: 'stream-1',
        }),
        update: jest.fn().mockResolvedValue({
          id: 'class-11',
          name: 'Class 11',
          level: 11,
          streamId: null,
          stream: null,
        }),
      },
      stream: { findFirst: jest.fn() },
    };
    const auditService = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new ClassesService(prisma as never, auditService as never);

    const result = await service.assignClassStream(
      'class-11',
      { streamId: null },
      actor,
    );

    expect(prisma.stream.findFirst).not.toHaveBeenCalled();
    expect(prisma.class.update).toHaveBeenCalledWith({
      where: { id: 'class-11' },
      data: { streamId: null },
      include: { stream: true },
    });
    expect(result.streamId).toBeNull();
  });

  it('rejects assignment for a class outside the actor tenant', async () => {
    const prisma = {
      class: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
      stream: { findFirst: jest.fn() },
    };
    const service = new ClassesService(prisma as never, {} as never);

    await expect(
      service.assignClassStream(
        'class-other-tenant',
        { streamId: 'stream-1' },
        actor,
      ),
    ).rejects.toThrow('Class not found');
  });
});
