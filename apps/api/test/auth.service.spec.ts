import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MembershipRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { AuthService } from '../src/auth/auth.service';

describe('AuthService security flows', () => {
  const user = { id: 'user-1', email: 'owner@example.com', displayName: 'Owner', passwordHash: '', emailVerifiedAt: new Date() };
  let db: any;
  let service: AuthService;
  let email: { sendVerification: jest.Mock; sendPasswordReset: jest.Mock };

  beforeEach(async () => {
    user.passwordHash = await argon2.hash('CorrectPassword1!', { type: argon2.argon2id });
    db = {
      user: { findUnique: jest.fn().mockResolvedValue({ ...user, memberships: [{ tenantId: 'tenant-a', role: MembershipRole.OWNER, tenant: { id: 'tenant-a', name: 'A' } }] }), update: jest.fn() },
      membership: { findUnique: jest.fn().mockResolvedValue({ tenantId: 'tenant-a', userId: user.id, role: MembershipRole.OWNER }) },
      session: { create: jest.fn().mockResolvedValue({ id: 'session-1' }), findUnique: jest.fn(), updateMany: jest.fn(), update: jest.fn() },
      emailVerificationToken: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      passwordResetToken: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      $transaction: jest.fn(async (operations: unknown[] | ((tx: unknown) => Promise<unknown>)) => Array.isArray(operations) ? Promise.all(operations) : operations(db)),
    };
    email = { sendVerification: jest.fn(), sendPasswordReset: jest.fn() };
    service = new AuthService(db, new JwtService({ secret: process.env.JWT_ACCESS_SECRET }), new ConfigService({ REFRESH_TOKEN_TTL_DAYS: 30, ACCESS_TOKEN_TTL: '15m' }), email as never);
  });

  it('uses a generic error for invalid credentials', async () => {
    await expect(service.login({ email: user.email, password: 'wrong-password' }, {})).rejects.toThrow('Invalid email or password');
  });

  it('revokes a refresh-token family when a revoked token is reused', async () => {
    db.session.findUnique.mockResolvedValue({ id: 'old', userId: user.id, tenantId: 'tenant-a', tokenFamilyId: 'family-1', revokedAt: new Date(), expiresAt: new Date(Date.now() + 10000), user });
    await expect(service.refresh({ refreshToken: 'old-token-value-with-enough-length' }, {})).rejects.toThrow('Invalid session');
    expect(db.session.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tokenFamilyId: 'family-1', revokedAt: null } }));
  });

  it('rejects password reset token reuse', async () => {
    db.passwordResetToken.findUnique.mockResolvedValue({ id: 'reset-1', userId: user.id, usedAt: new Date(), expiresAt: new Date(Date.now() + 10000) });
    await expect(service.resetPassword({ token: 'reset-token-value-with-enough-length', password: 'NewPassword1!' })).rejects.toThrow('invalid or expired');
  });

  it('checks the requested tenant through membership before switching', async () => {
    db.membership.findUnique.mockResolvedValue(null);
    await expect(service.selectTenant({ sub: user.id, sid: 'session-1', tenantId: 'tenant-a', role: MembershipRole.OWNER }, { tenantId: 'tenant-b' })).rejects.toThrow('Tenant access is not available');
    expect(db.session.update).not.toHaveBeenCalled();
  });
});
