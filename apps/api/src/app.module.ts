import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { DatabaseModule } from './database/database.module';
import { validateEnvironment } from './config/env';
import { HealthModule } from './health/health.module';
import { SystemModule } from './system/system.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    LoggerModule.forRoot({
      pinoHttp: { level: process.env.LOG_LEVEL ?? 'info', redact: ['req.headers.authorization'] },
    }),
    DatabaseModule,
    HealthModule,
    SystemModule,
  ],
})
export class AppModule {}
