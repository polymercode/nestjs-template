import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createKeyv } from '@keyv/redis';

/**
 * Global cache module backed by Redis (via Keyv). Inject `CACHE_MANAGER`
 * (from `@nestjs/cache-manager`) or use the `@CacheTTL()`/`CacheInterceptor`
 * decorators to cache route responses.
 */
@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      isGlobal: true,
      useFactory: (config: ConfigService) => ({
        stores: [createKeyv(config.getOrThrow<string>('cache.redisUrl'))],
        ttl: config.get<number>('cache.ttlSeconds', 60) * 1000,
      }),
      inject: [ConfigService],
    }),
  ],
  exports: [NestCacheModule],
})
export class CacheModule {}
