import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

const REQUEST_CACHE_KEY = 'requestCache';

/**
 * Per-request memoization backed by the CLS context that is already mounted
 * globally (see `ClsModule.forRoot` in `app.module.ts`).
 *
 * Scope is exactly one request. Entries are discarded when the CLS context
 * ends, so this cannot serve stale data across requests and needs no
 * invalidation: a suspended tenant or a revoked entitlement is still observed
 * on the very next request. That property is what makes it safe to apply to
 * authorization-relevant reads, where a cross-request cache would need an
 * explicit invalidation contract to keep "suspended tenants fail closed" true.
 *
 * It exists because the guard stack reads the same near-static rows several
 * times per request — `Tenant` four times and `TenantSubscription` twice on a
 * single parent mobile call. See docs/performance/BASELINE_RESULTS.md §6.
 *
 * Concurrent callers for the same key within one request share one promise, so
 * a fan-out such as `mobile/me/dashboard` (which resolves entitlements from
 * several branches in parallel) issues the underlying query once.
 */
@Injectable()
export class RequestCacheService {
  constructor(private readonly cls: ClsService) {}

  private store(): Map<string, Promise<unknown>> | null {
    // Outside a request (cron jobs, queue workers, bootstrap) there is no CLS
    // context. Callers then fall through to the loader with no memoization,
    // which is the correct behaviour for long-lived background work.
    const isActive =
      typeof this.cls.isActive === 'function' ? this.cls.isActive() : false;
    if (!isActive) return null;

    let store = this.cls.get(REQUEST_CACHE_KEY) as
      Map<string, Promise<unknown>> | undefined;

    if (!store) {
      store = new Map<string, Promise<unknown>>();
      this.cls.set(REQUEST_CACHE_KEY, store);
    }

    return store;
  }

  /**
   * Resolve `key` from the per-request store, or run `loader` and memoize it.
   *
   * A rejected loader is evicted so a transient failure is not pinned for the
   * remainder of the request.
   */
  async resolve<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const store = this.store();
    if (!store) return loader();

    const existing = store.get(key);
    if (existing) return existing as Promise<T>;

    const pending = loader().catch((error: unknown) => {
      store.delete(key);
      throw error;
    });

    store.set(key, pending);
    return pending as Promise<T>;
  }

  /**
   * Pre-populate `key` with a value already fetched in this request, so a later
   * reader resolves it without issuing its own query.
   *
   * Only for values read live earlier in the *same* request — seeding a value
   * obtained any other way would make this a correctness hazard rather than a
   * memo. Existing entries are not overwritten, so the first read of a key in a
   * request always wins.
   */
  seed<T>(key: string, value: T) {
    const store = this.store();
    if (!store || store.has(key)) return;
    store.set(key, Promise.resolve(value));
  }

  /** Drop a memoized entry so a later read in the same request re-queries. */
  invalidate(key: string) {
    this.store()?.delete(key);
  }

  /** Drop every entry whose key starts with `prefix`, within this request. */
  invalidatePrefix(prefix: string) {
    const store = this.store();
    if (!store) return;
    for (const key of [...store.keys()]) {
      if (key.startsWith(prefix)) store.delete(key);
    }
  }
}
