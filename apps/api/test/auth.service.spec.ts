import { UnauthorizedException } from '@nestjs/common';
import { createHash, createHmac } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MembershipRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { AuthService } from '../src/auth/auth.service';

describe('AuthService security flows', () => {
  const user = { id: 'user-1', email: 'owner@example.com', displayName: 'Owner', passwordHash: '', emailVerifiedAt: new Date() };
  let db: any;
  let service: AuthService;
  let email: { assertConfigured: jest.Mock; sendVerification: jest.Mock; sendPasswordReset: jest.Mock };

  beforeEach(async () => {
    user.passwordHash = await argon2.hash('CorrectPassword1!', { type: argon2.argon2id });
    db = {
      user: { findUnique: jest.fn().mockResolvedValue({ ...user, memberships: [{ tenantId: 'tenant-a', role: MembershipRole.OWNER, tenant: { id: 'tenant-a', name: 'A' } }] }), update: jest.fn(), create: jest.fn().mockResolvedValue(user) },
      tenant: { create: jest.fn().mockResolvedValue({ id: 'tenant-a' }) },
      membership: { create: jest.fn(), findUnique: jest.fn().mockResolvedValue({ tenantId: 'tenant-a', userId: user.id, role: MembershipRole.OWNER }) },
      session: { create: jest.fn().mockResolvedValue({ id: 'session-1' }), findUnique: jest.fn(), updateMany: jest.fn(), update: jest.fn() },
      emailVerificationToken: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }), deleteMany: jest.fn() },
      passwordResetToken: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      $transaction: jest.fn(async (operations: unknown[] | ((tx: unknown) => Promise<unknown>)) => Array.isArray(operations) ? Promise.all(operations) : operations(db)),
    };
    email = { assertConfigured: jest.fn(), sendVerification: jest.fn(), sendPasswordReset: jest.fn() };
    service = new AuthService(db, new JwtService({ secret: process.env.JWT_ACCESS_SECRET }), new ConfigService({ JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET, REFRESH_TOKEN_TTL_DAYS: 30, ACCESS_TOKEN_TTL: '15m' }), email as never);
  });

  const verificationHash = (address: string, code: string) => createHmac('sha256', process.env.JWT_ACCESS_SECRET!)
    .update(`email-verification:${address.trim().toLowerCase()}:${code}`).digest('hex');

  it('emails a six-digit code and stores only its email-bound hash with a 15-minute expiry', async () => {
    db.user.findUnique.mockResolvedValue(null);
    const started = Date.now();
    await service.register({ email: ' OWNER@example.com ', displayName: 'Owner', businessName: 'Salon', password: 'CorrectPassword1!' });
    const [recipient, code] = email.sendVerification.mock.calls[0];
    expect(recipient).toBe(user.email);
    expect(code).toMatch(/^\d{6}$/);
    const stored = db.emailVerificationToken.create.mock.calls[0][0].data;
    expect(stored.tokenHash).toBe(verificationHash(user.email, code));
    expect(stored.expiresAt.getTime()).toBeGreaterThanOrEqual(started + 15 * 60 * 1000);
    expect(stored.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 15 * 60 * 1000);
    expect(JSON.stringify(stored)).not.toContain(`"${code}"`);
  });

  it('does not create an account when SMTP is unconfigured', async () => {
    email.assertConfigured.mockImplementation(() => { throw new Error('Email unavailable'); });
    await expect(service.register({ email: user.email, displayName: 'Owner', businessName: 'Salon', password: 'CorrectPassword1!' })).rejects.toThrow('Email unavailable');
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it('binds codes to the email and rejects use by another address', async () => {
    db.emailVerificationToken.findUnique.mockImplementation(({ where }: { where: { tokenHash: string } }) =>
      where.tokenHash === verificationHash(user.email, '001234') ? { id: 'verify-1', userId: user.id, expiresAt: new Date(Date.now() + 60000), usedAt: null } : null);
    await expect(service.verifyEmail({ email: 'other@example.com', token: '001234' })).rejects.toThrow('invalid or expired');
    await expect(service.verifyEmail({ email: 'OWNER@example.com', token: '001234' })).resolves.toEqual({ message: 'Email verified successfully' });
    expect(db.user.update).toHaveBeenCalledTimes(1);
  });

  it('rejects expired codes and codes already consumed by another request', async () => {
    db.emailVerificationToken.findUnique.mockResolvedValue({ id: 'verify-1', userId: user.id, expiresAt: new Date(Date.now() - 1000), usedAt: null });
    await expect(service.verifyEmail({ email: user.email, token: '001234' })).rejects.toThrow('invalid or expired');
    db.emailVerificationToken.findUnique.mockResolvedValue({ id: 'verify-1', userId: user.id, expiresAt: new Date(Date.now() + 60000), usedAt: null });
    db.emailVerificationToken.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.verifyEmail({ email: user.email, token: '001234' })).rejects.toThrow('invalid or expired');
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('supports existing long verification tokens', async () => {
    const token = 'legacy-verification-token-at-least-20-characters';
    db.emailVerificationToken.findUnique.mockResolvedValue({ id: 'verify-1', userId: user.id, expiresAt: new Date(Date.now() + 60000), usedAt: null });
    await service.verifyEmail({ token });
    expect(db.emailVerificationToken.findUnique).toHaveBeenCalledWith({ where: { tokenHash: createHash('sha256').update(token).digest('hex') } });
  });

  it('replaces pending codes when resending to an unverified account', async () => {
    db.user.findUnique.mockResolvedValue({ ...user, emailVerifiedAt: null });
    await service.resendVerification({ email: user.email });
    const code = email.sendVerification.mock.calls[0][1];
    expect(code).toMatch(/^\d{6}$/);
    expect(db.emailVerificationToken.deleteMany).toHaveBeenCalledWith({ where: { userId: user.id, usedAt: null } });
    expect(db.emailVerificationToken.create).toHaveBeenCalledWith({ data: expect.objectContaining({ tokenHash: verificationHash(user.email, code) }) });
  });

  it('does not reveal whether an account exists when resending', async () => {
    const verified = await service.resendVerification({ email: user.email });
    db.user.findUnique.mockResolvedValue(null);
    expect(await service.resendVerification({ email: 'missing@example.com' })).toEqual(verified);
    expect(email.sendVerification).not.toHaveBeenCalled();
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
