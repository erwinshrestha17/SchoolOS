import type { Prisma } from '@prisma/client';
import { lockAuthTenant, lockAuthUsers } from './auth-account-locks';

describe('authentication lock order', () => {
  function transaction() {
    const query = jest.fn<
      Promise<{ id: string }[]>,
      [TemplateStringsArray, string, unknown]
    >((_sql, id) => Promise.resolve([{ id }]));
    return {
      query,
      tx: { $queryRaw: query } as unknown as Prisma.TransactionClient,
    };
  }

  it('locks sorted unique actor and target IDs within the same tenant', async () => {
    const { tx, query } = transaction();
    const locked = await lockAuthUsers(tx, 'tenant-a', [
      'z-target',
      'a-actor',
      'z-target',
    ]);
    expect([...locked]).toEqual(['a-actor', 'z-target']);
    expect(query.mock.calls.map(([, id, tenantId]) => [id, tenantId])).toEqual([
      ['a-actor', 'tenant-a'],
      ['z-target', 'tenant-a'],
    ]);
    expect(
      query.mock.calls.every(([sql]) => sql.join('?').includes('FOR UPDATE')),
    ).toBe(true);
  });

  it('does not report missing or cross-tenant user rows as locked', async () => {
    const { tx, query } = transaction();
    query.mockResolvedValueOnce([]);
    expect(await lockAuthUsers(tx, 'tenant-a', ['missing'])).toEqual(new Set());
  });

  it('requires an active tenant by default and shares its lock', async () => {
    const { tx, query } = transaction();
    expect(await lockAuthTenant(tx, 'tenant-a')).toBe(true);
    expect(query.mock.calls[0].slice(1)).toEqual(['tenant-a', false]);
    expect(query.mock.calls[0][0].join('?')).toContain('FOR SHARE');
    query.mockResolvedValueOnce([]);
    expect(await lockAuthTenant(tx, 'missing')).toBe(false);
  });

  it('permits inactive-tenant locking only when explicitly requested for logout', async () => {
    const { tx, query } = transaction();
    await lockAuthTenant(tx, 'tenant-a', true);
    expect(query.mock.calls[0].slice(1)).toEqual(['tenant-a', true]);
  });

  it('propagates storage failures instead of claiming a lock', async () => {
    const { tx, query } = transaction();
    query.mockRejectedValueOnce(new Error('Synthetic unavailable storage'));
    await expect(lockAuthUsers(tx, 'tenant-a', ['user-a'])).rejects.toThrow(
      'Synthetic unavailable storage',
    );
  });
});
