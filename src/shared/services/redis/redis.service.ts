import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { generateCacheKey } from '@/shared/utils/generate-cache-key.util';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;
  private readonly defaultTtlSeconds: number;
  private readonly redisRequired: boolean;
  private isAvailable = false;

  constructor(private readonly configService: ConfigService) {
    this.defaultTtlSeconds = configService.get<number>('redis.ttlSeconds') ?? 300;
    this.redisRequired = configService.get<boolean>('redis.required') ?? false;

    this.client = new Redis({
      host: configService.get<string>('redis.host'),
      port: configService.get<number>('redis.port'),
      password: configService.get<string>('redis.password'),
      db: configService.get<number>('redis.db') ?? 0,
      lazyConnect: true,
      maxRetriesPerRequest: this.redisRequired ? 3 : 1,
    });

    this.client.on('error', (error) => {
      this.isAvailable = false;
      const message = `Redis unavailable: ${error.message}`;
      if (this.redisRequired) {
        this.logger.error(message);
        return;
      }
      this.logger.warn(message);
    });
  }

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.status === 'ready') {
      await this.client.quit();
      return;
    }

    this.client.disconnect();
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isAvailable) {
      return null;
    }

    const value = await this.client.get(key);
    return value ? (JSON.parse(value) as T) : null;
  }

  async set<T>(key: string, value: T, ttl = this.defaultTtlSeconds): Promise<void> {
    if (!this.isAvailable) {
      return;
    }

    await this.client.set(key, JSON.stringify(value), 'EX', ttl);
  }

  async del(key: string): Promise<void> {
    if (!this.isAvailable) {
      return;
    }

    await this.client.del(key);
  }

  async deleteByPattern(pattern: string): Promise<number> {
    if (!this.isAvailable) {
      return 0;
    }

    let cursor = '0';
    let deleted = 0;

    do {
      const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        deleted += await this.client.del(...keys);
      }
    } while (cursor !== '0');

    return deleted;
  }

  async getOrSet<T>(key: string, fetcher: () => Promise<T>, ttl = this.defaultTtlSeconds): Promise<T> {
    const cached = await this.get<T>(key);

    if (cached !== null) {
      return cached;
    }

    const value = await fetcher();
    await this.set(key, value, ttl);
    return value;
  }

  generateKey(parts: Array<string | number>, params?: Record<string, unknown>): string {
    return generateCacheKey(parts, params);
  }

  private async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.isAvailable = true;
      this.logger.log('Redis connected');
    } catch (error) {
      this.isAvailable = false;
      const message = error instanceof Error ? error.message : 'Unknown Redis connection error';

      if (this.redisRequired) {
        this.logger.error(message);
        throw error;
      }

      this.logger.warn(`Redis disabled for this process: ${message}`);
    }
  }
}
