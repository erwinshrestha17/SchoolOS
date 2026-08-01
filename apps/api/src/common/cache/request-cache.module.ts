import { Global, Module } from '@nestjs/common';
import { RedisModule } from '../../redis/redis.module';
import { RedisCacheService } from './redis-cache.service';
import { RequestCacheService } from './request-cache.service';

/**
 * Global so any module can memoize per-request reads without adding an import
 * edge. `RequestCacheService` holds no state of its own — everything lives in
 * the CLS context — so making it global does not create shared mutable state
 * between requests or between API replicas.
 *
 * `RedisCacheService` is cross-request and cross-replica by design; see its
 * doc comment for what may be cached there.
 */
@Global()
@Module({
  imports: [RedisModule],
  providers: [RequestCacheService, RedisCacheService],
  exports: [RequestCacheService, RedisCacheService],
})
export class RequestCacheModule {}
