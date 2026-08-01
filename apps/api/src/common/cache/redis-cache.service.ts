import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

/**
 * Small read-through cache over the shared Redis instance, for values that are
 * expensive to derive and change rarely.
 *
 * ## What may and may not go in here
 *
 * This cache is shared across API replicas and survives between requests, so a
 * stale entry is visible to every user until it is invalidated or expires. Only
 * put values here that have an **explicit invalidation contract** — a known,
 * enumerated set of write sites that call {@link invalidate}.
 *
 * Liveness checks must **not** be cached. `User.status` and `Tenant.isActive`
 * stay live reads so a suspended tenant or deactivated account fails closed on
 * the very next request, which is what `apps/api/AGENTS.md` requires. What is
 * cached is the slow-changing derived data: a user's role/permission set, and a
 * tenant's plan entitlements.
 *
 * ## Failure policy: fail open to the database, never to the caller
 *
 * Every Redis error is swallowed and the loader runs against PostgreSQL. A
 * Redis outage degrades performance back to the pre-cache baseline; it never
 * denies a legitimate request and never grants an illegitimate one, because the
 * authoritative answer always comes from the database on a miss.
 *
 * The TTL is a safety net, not the invalidation mechanism: if a write site is
 * ever missed, the entry self-heals within the TTL rather than being wrong
 * forever.
 */
@Injectable()
export class RedisCacheService {
  private readonly logger = new Logger(RedisCacheService.name);

  constructor(private readonly redisService: RedisService) {}

  private async client() {
    const client = this.redisService.getClient();
    if (client.status === 'wait') await client.connect();
    return client;
  }

  /**
   * Return the cached value for `key`, or run `loader`, store, and return it.
   *
   * `ttlSeconds` bounds how long a missed invalidation can persist.
   */
  async resolve<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    try {
      const cached = await (await this.client()).get(key);
      if (cached !== null) {
        return JSON.parse(cached) as T;
      }
    } catch (error) {
      this.logger.warn(
        `Cache read failed for ${key}, falling back to source: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return loader();
    }

    const value = await loader();

    try {
      // `undefined` does not survive JSON and would be read back as a hit that
      // deserialises to nothing, so it is never stored.
      if (value !== undefined) {
        await (
          await this.client()
        ).set(key, JSON.stringify(value), 'EX', ttlSeconds);
      }
    } catch (error) {
      this.logger.warn(
        `Cache write failed for ${key}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return value;
  }

  /** Drop one entry. Safe to call when the key is absent. */
  async invalidate(key: string): Promise<void> {
    try {
      await (await this.client()).del(key);
    } catch (error) {
      // A failed invalidation is the one case that can serve stale
      // authorization data, so it is logged at error level. The TTL bounds the
      // exposure.
      this.logger.error(
        `Cache invalidation FAILED for ${key} — stale until TTL expiry: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Drop every entry under `prefix`, using SCAN rather than KEYS so a large
   * keyspace is not blocked.
   */
  async invalidatePrefix(prefix: string): Promise<void> {
    try {
      const client = await this.client();
      let cursor = '0';
      do {
        const [next, keys] = await client.scan(
          cursor,
          'MATCH',
          `${prefix}*`,
          'COUNT',
          200,
        );
        cursor = next;
        if (keys.length > 0) await client.del(...keys);
      } while (cursor !== '0');
    } catch (error) {
      this.logger.error(
        `Cache prefix invalidation FAILED for ${prefix} — stale until TTL expiry: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
