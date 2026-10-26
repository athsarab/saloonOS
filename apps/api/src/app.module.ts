import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { validateEnvironment } from './config/env';
import { HealthModule } from './health/health.module';
import { SystemModule } from './system/system.module';
import { SalonModule } from './salon/salon.module';
import { CheckoutModule } from './checkout/checkout.module';
import { OfflineModule } from './offline/offline.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    LoggerModule.forRoot({
      pinoHttp: { level: process.env.LOG_LEVEL ?? 'info', redact: ['req.headers.authorization', 'req.headers["x-offline-device-secret"]'] },
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    DatabaseModule,
    AuthModule,
    HealthModule,
    SystemModule,
    SalonModule,
    CheckoutModule,
    OfflineModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
