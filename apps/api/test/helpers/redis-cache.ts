import { RedisCacheService } from '../../src/common/cache/redis-cache.service';

/**
 * A `RedisCacheService` stand-in that never caches: every `resolve` runs its
 * loader and both invalidation methods are recorded no-ops.
 *
 * Unit tests should assert the *source* behaviour (which queries run, what they
 * are scoped to) and the *invalidation contract* (that a write calls
 * invalidate), not Redis itself. Caching in the double would hide query
 * assertions behind a hit on the second call.
 */
export function createPassThroughRedisCache(): RedisCacheService & {
  invalidate: jest.Mock;
  invalidatePrefix: jest.Mock;
} {
  return {
    resolve: <T>(_key: string, _ttl: number, loader: () => Promise<T>) =>
      loader(),
    invalidate: jest.fn(async () => undefined),
    invalidatePrefix: jest.fn(async () => undefined),
  } as unknown as RedisCacheService & {
    invalidate: jest.Mock;
    invalidatePrefix: jest.Mock;
  };
}
