import { ClsService } from 'nestjs-cls';
import { RequestCacheService } from '../../src/common/cache/request-cache.service';

/**
 * A real `RequestCacheService` running outside any CLS context, so every
 * `resolve` call falls through to its loader with no memoization.
 *
 * Unit tests that swap a Prisma mock's return value between assertions need
 * each call to hit the mock, and background workers behave the same way in
 * production (no CLS context => no memoization). Using the real class rather
 * than a hand-written stub keeps the pass-through path itself under test.
 */
export function createPassThroughRequestCache(): RequestCacheService {
  const inactiveCls = { isActive: () => false } as unknown as ClsService;
  return new RequestCacheService(inactiveCls);
}
