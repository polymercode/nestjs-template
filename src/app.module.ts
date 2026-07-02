import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard } from '@nestjs/throttler';
import { CacheModule } from './cache/cache.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import configuration from './config/configuration';
import { validationSchema } from './config/env.validation';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { ThrottlerModule } from './throttler/throttler.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      validationOptions: { abortEarly: true },
    }),
    PrismaModule,
    CacheModule,
    ThrottlerModule,
    HealthModule,
    AuthModule,
    UsersModule,
  ],
  providers: [
    // Rate limit first, then auth — a throttled request never reaches the JWT guard.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Every route requires a valid JWT unless marked with @Public()
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
