import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';
import { LoggerService } from '../../common';

@Injectable()
export class CacheService {
  constructor(
    private readonly redis: RedisService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Cache-aside: get from cache, else fetch + store
   */
  async wrap<T>(
    key: string,
    ttlSeconds: number,
    fetchFn: () => Promise<T>,
  ): Promise<{ data: T; fromCache: boolean }> {
    const cached = await this.redis.getJson<T>(key);
    if (cached !== null) {
      return { data: cached, fromCache: true };
    }

    const fresh = await fetchFn();
    await this.redis.setJson(key, fresh, ttlSeconds);
    return { data: fresh, fromCache: false };
  }

  /**
   * Invalidate by exact keys
   */
  async invalidate(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return this.redis.del(...keys);
  }

  /**
   * Invalidate by pattern (uses SCAN — safe for prod)
   */
  async invalidatePattern(pattern: string): Promise<number> {
    return this.redis.delByPattern(pattern);
  }

  /**
   * Clear all cache keys for a resource
   */
  async clearResource(resource: string): Promise<number> {
    return this.redis.delByPattern(`cache:${resource}:*`);
  }
}
