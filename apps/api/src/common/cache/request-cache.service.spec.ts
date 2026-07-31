import { ClsService } from 'nestjs-cls';
import { RequestCacheService } from './request-cache.service';

/**
 * Minimal stand-in for the CLS context. `active: false` models code running
 * outside a request (queue workers, cron), where no memoization must happen.
 */
function makeCls(active: boolean) {
  const store = new Map<string, unknown>();
  return {
    isActive: () => active,
    get: (key: string) => store.get(key),
    set: (key: string, value: unknown) => store.set(key, value),
  } as unknown as ClsService;
}

describe('RequestCacheService', () => {
  it('runs the loader once per key inside a request context', async () => {
    const cache = new RequestCacheService(makeCls(true));
    const loader = jest.fn().mockResolvedValue('value');

    const results = await Promise.all([
      cache.resolve('k', loader),
      cache.resolve('k', loader),
      cache.resolve('k', loader),
    ]);

    expect(results).toEqual(['value', 'value', 'value']);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent callers rather than racing the loader', async () => {
    const cache = new RequestCacheService(makeCls(true));
    let resolveLoader: (value: string) => void = () => {};
    const loader = jest.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveLoader = resolve;
        }),
    );

    const first = cache.resolve('k', loader);
    const second = cache.resolve('k', loader);
    resolveLoader('shared');

    await expect(first).resolves.toBe('shared');
    await expect(second).resolves.toBe('shared');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('keeps separate keys independent', async () => {
    const cache = new RequestCacheService(makeCls(true));
    const loader = jest
      .fn()
      .mockResolvedValueOnce('a')
      .mockResolvedValueOnce('b');

    await expect(cache.resolve('a', loader)).resolves.toBe('a');
    await expect(cache.resolve('b', loader)).resolves.toBe('b');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('does not memoize outside a request context', async () => {
    const cache = new RequestCacheService(makeCls(false));
    const loader = jest.fn().mockResolvedValue('value');

    await cache.resolve('k', loader);
    await cache.resolve('k', loader);

    // Background work must always observe current state, never a value cached
    // by an unrelated earlier call.
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('evicts a rejected loader so the next call retries', async () => {
    const cache = new RequestCacheService(makeCls(true));
    const loader = jest
      .fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce('recovered');

    await expect(cache.resolve('k', loader)).rejects.toThrow('transient');
    await expect(cache.resolve('k', loader)).resolves.toBe('recovered');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('invalidate forces a fresh read within the same request', async () => {
    const cache = new RequestCacheService(makeCls(true));
    const loader = jest
      .fn()
      .mockResolvedValueOnce('before')
      .mockResolvedValueOnce('after');

    await expect(cache.resolve('k', loader)).resolves.toBe('before');
    cache.invalidate('k');
    await expect(cache.resolve('k', loader)).resolves.toBe('after');
  });

  it('invalidatePrefix clears only the matching keys', async () => {
    const cache = new RequestCacheService(makeCls(true));
    const keep = jest.fn().mockResolvedValue('keep');
    const drop = jest.fn().mockResolvedValue('drop');

    await cache.resolve('other:1', keep);
    await cache.resolve('entitlements:t1', drop);

    cache.invalidatePrefix('entitlements:');

    await cache.resolve('other:1', keep);
    await cache.resolve('entitlements:t1', drop);

    expect(keep).toHaveBeenCalledTimes(1);
    expect(drop).toHaveBeenCalledTimes(2);
  });
});
