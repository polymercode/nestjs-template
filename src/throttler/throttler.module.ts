import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule as NestThrottlerModule } from '@nestjs/throttler';

/**
 * Global rate limiting. Default profile applies to every route; a stricter
 * `auth` profile is used on brute-force-sensitive endpoints via
 * `@Throttle({ auth: { ttl, limit } })` (see AuthController).
 */
@Module({
  imports: [
    NestThrottlerModule.forRootAsync({
      useFactory: (config: ConfigService) => [
        {
          name: 'default',
          ttl: config.get<number>('throttle.ttlMs', 60000),
          limit: config.get<number>('throttle.limit', 100),
        },
        {
          name: 'auth',
          ttl: config.get<number>('throttle.authTtlMs', 60000),
          limit: config.get<number>('throttle.authLimit', 10),
        },
      ],
      inject: [ConfigService],
    }),
  ],
  exports: [NestThrottlerModule],
})
export class ThrottlerModule {}
