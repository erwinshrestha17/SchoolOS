import { Global, Module } from '@nestjs/common';
import { RequestCacheService } from './request-cache.service';

/**
 * Global so any module can memoize per-request reads without adding an import
 * edge. The service holds no state of its own — everything lives in the CLS
 * context — so making it global does not create shared mutable state between
 * requests or between API replicas.
 */
@Global()
@Module({
  providers: [RequestCacheService],
  exports: [RequestCacheService],
})
export class RequestCacheModule {}
