import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailService } from './email.service';
import { JwtStrategy } from './auth.strategy';
import { JwtAuthGuard } from './auth.guard';
import { PermissionGuard, TenantMembershipGuard } from './auth.guards';

@Module({
  imports: [PassportModule, JwtModule.registerAsync({ inject: [ConfigService], useFactory: (config: ConfigService) => ({ secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'), signOptions: { expiresIn: (config.get<string>('ACCESS_TOKEN_TTL') ?? '15m') as `${number}${'s' | 'm' | 'h' | 'd'}` } }) })],
  controllers: [AuthController],
  providers: [AuthService, EmailService, JwtStrategy, { provide: APP_GUARD, useClass: JwtAuthGuard }, { provide: APP_GUARD, useClass: TenantMembershipGuard }, { provide: APP_GUARD, useClass: PermissionGuard }],
  exports: [AuthService],
})
export class AuthModule {}
