import { createHash, createHmac, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MembershipRole, Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { DatabaseService } from '../database/database.service';
import { EmailService } from './email.service';
import { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto, SelectTenantDto, TokenDto, VerifyEmailDto } from './dto';
import { AccessTokenPayload } from './auth.types';

type RequestContext = { userAgent?: string };
const genericAuthError = 'Invalid email or password';

@Injectable()
export class AuthService {
  constructor(private readonly database: DatabaseService, private readonly jwt: JwtService, private readonly config: ConfigService, private readonly email: EmailService) {}

  async register(dto: RegisterDto) {
    this.email.assertConfigured();
    const email = dto.email.trim().toLowerCase();
    const exists = await this.database.user.findUnique({ where: { email } });
    if (exists) throw new ConflictException('Unable to create account with these details');
    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const token = this.verificationCode();
    const user = await this.database.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { email, displayName: dto.displayName.trim(), passwordHash } });
      const tenant = await tx.tenant.create({ data: { name: dto.businessName.trim(), slug: `${dto.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${randomBytes(3).toString('hex')}` } });
      await tx.membership.create({ data: { userId: created.id, tenantId: tenant.id, role: MembershipRole.OWNER } });
      await tx.emailVerificationToken.create({ data: { userId: created.id, tokenHash: this.hashVerificationCode(email, token), expiresAt: this.inMinutes(15) } });
      return created;
    });
    await this.email.sendVerification(user.email, token);
    return { message: 'If the account can be created, verification instructions have been sent.' };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const isCode = /^\d{6}$/.test(dto.token);
    if (isCode && !dto.email) throw new UnauthorizedException('Email and verification code are required');
    const tokenHash = isCode ? this.hashVerificationCode(dto.email!, dto.token) : this.hashToken(dto.token);
    const token = await this.database.emailVerificationToken.findUnique({ where: { tokenHash } });
    if (!token || token.usedAt || token.expiresAt <= new Date()) throw new UnauthorizedException('Verification code is invalid or expired');
    await this.database.$transaction(async (tx) => {
      const consumed = await tx.emailVerificationToken.updateMany({ where: { id: token.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
      if (consumed.count !== 1) throw new UnauthorizedException('Verification code is invalid or expired');
      await tx.user.update({ where: { id: token.userId }, data: { emailVerifiedAt: new Date() } });
    });
    return { message: 'Email verified successfully' };
  }

  async resendVerification(dto: ForgotPasswordDto) {
    this.email.assertConfigured();
    const user = await this.database.user.findUnique({ where: { email: dto.email.trim().toLowerCase() } });
    if (user && !user.emailVerifiedAt) {
      const code = this.verificationCode();
      await this.database.$transaction(async (tx) => {
        await tx.emailVerificationToken.deleteMany({ where: { userId: user.id, usedAt: null } });
        await tx.emailVerificationToken.create({ data: { userId: user.id, tokenHash: this.hashVerificationCode(user.email, code), expiresAt: this.inMinutes(15) } });
      });
      await this.email.sendVerification(user.email, code);
    }
    return { message: 'If this email belongs to an unverified account, a new code has been sent.' };
  }

  async login(dto: LoginDto, context: RequestContext) {
    const user = await this.database.user.findUnique({ where: { email: dto.email.trim().toLowerCase() }, include: { memberships: { include: { tenant: true }, orderBy: { createdAt: 'asc' } } } });
    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, dto.password))) throw new UnauthorizedException(genericAuthError);
    if (!user.emailVerifiedAt || !user.memberships.length) throw new UnauthorizedException(genericAuthError);
    return this.issueSession(user.id, user.memberships[0].tenantId, user.memberships[0].role, user.memberships.map((membership) => ({ id: membership.tenantId, name: membership.tenant.name, role: membership.role })), context);
  }

  async refresh(dto: TokenDto, context: RequestContext) {
    const hash = this.hashToken(dto.refreshToken);
    const session = await this.database.session.findUnique({ where: { refreshTokenHash: hash }, include: { user: true } });
    if (!session) throw new UnauthorizedException('Invalid session');
    if (session.revokedAt || session.expiresAt <= new Date()) {
      await this.database.session.updateMany({ where: { tokenFamilyId: session.tokenFamilyId, revokedAt: null }, data: { revokedAt: new Date() } });
      throw new UnauthorizedException('Invalid session');
    }
    const membership = await this.database.membership.findUnique({ where: { tenantId_userId: { tenantId: session.tenantId, userId: session.userId } } });
    if (!membership) throw new UnauthorizedException('Invalid session');
    const nextRefresh = this.rawToken();
    const nextId = randomUUID();
    await this.database.$transaction([
      this.database.session.update({ where: { id: session.id }, data: { revokedAt: new Date(), lastUsedAt: new Date(), replacedById: nextId } }),
      this.database.session.create({ data: { id: nextId, userId: session.userId, tenantId: session.tenantId, tokenFamilyId: session.tokenFamilyId, refreshTokenHash: this.hashToken(nextRefresh), expiresAt: this.inDays(this.config.getOrThrow<number>('REFRESH_TOKEN_TTL_DAYS')), userAgent: context.userAgent } }),
    ]);
    return { accessToken: await this.accessToken({ sub: session.userId, sid: nextId, tenantId: session.tenantId, role: membership.role }), refreshToken: nextRefresh, expiresIn: this.config.getOrThrow<string>('ACCESS_TOKEN_TTL') };
  }

  async logout(user: AccessTokenPayload) {
    await this.database.offlineGrant.updateMany({ where: { userId: user.sub, tenantId: user.tenantId }, data: { revokedAt: new Date() } });
    await this.database.session.updateMany({ where: { id: user.sid, userId: user.sub }, data: { revokedAt: new Date() } });
    return { message: 'Signed out' };
  }

  async logoutAll(user: AccessTokenPayload) {
    await this.database.offlineGrant.updateMany({ where: { userId: user.sub }, data: { revokedAt: new Date() } });
    await this.database.session.updateMany({ where: { userId: user.sub }, data: { revokedAt: new Date() } });
    return { message: 'All sessions signed out' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.database.user.findUnique({ where: { email: dto.email.trim().toLowerCase() } });
    if (user) {
      const token = this.rawToken();
      await this.database.passwordResetToken.create({ data: { userId: user.id, tokenHash: this.hashToken(token), expiresAt: this.inMinutes(30) } });
      await this.email.sendPasswordReset(user.email, token);
    }
    return { message: 'If an account exists for that email, reset instructions have been sent.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const token = await this.database.passwordResetToken.findUnique({ where: { tokenHash: this.hashToken(dto.token) } });
    if (!token || token.usedAt || token.expiresAt <= new Date()) throw new UnauthorizedException('Reset link is invalid or expired');
    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    await this.database.$transaction([
      this.database.passwordResetToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
      this.database.user.update({ where: { id: token.userId }, data: { passwordHash } }),
      this.database.session.updateMany({ where: { userId: token.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    return { message: 'Password reset successfully' };
  }

  async selectTenant(user: AccessTokenPayload, dto: SelectTenantDto) {
    const membership = await this.database.membership.findUnique({ where: { tenantId_userId: { tenantId: dto.tenantId, userId: user.sub } } });
    if (!membership) throw new UnauthorizedException('Tenant access is not available');
    await this.database.session.update({ where: { id: user.sid }, data: { tenantId: dto.tenantId } });
    return { accessToken: await this.accessToken({ sub: user.sub, sid: user.sid, tenantId: dto.tenantId, role: membership.role }) };
  }

  private async issueSession(userId: string, tenantId: string, role: MembershipRole, tenants: Array<{ id: string; name: string; role: MembershipRole }>, context: RequestContext) {
    const refreshToken = this.rawToken();
    const session = await this.database.session.create({ data: { userId, tenantId, tokenFamilyId: randomUUID(), refreshTokenHash: this.hashToken(refreshToken), expiresAt: this.inDays(this.config.getOrThrow<number>('REFRESH_TOKEN_TTL_DAYS')), userAgent: context.userAgent } });
    return { accessToken: await this.accessToken({ sub: userId, sid: session.id, tenantId, role }), refreshToken, expiresIn: this.config.getOrThrow<string>('ACCESS_TOKEN_TTL'), tenants };
  }

  private accessToken(payload: AccessTokenPayload) {
    return this.jwt.signAsync(payload);
  }

  private rawToken() {
    return randomBytes(48).toString('base64url');
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private verificationCode() {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private hashVerificationCode(email: string, code: string) {
    return createHmac('sha256', this.config.getOrThrow<string>('JWT_ACCESS_SECRET'))
      .update(`email-verification:${email.trim().toLowerCase()}:${code}`).digest('hex');
  }

  private inMinutes(minutes: number) { return new Date(Date.now() + minutes * 60 * 1000); }
  private inDays(days: number) { return new Date(Date.now() + days * 24 * 60 * 60 * 1000); }
}
