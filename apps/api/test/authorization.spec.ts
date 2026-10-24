import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MembershipRole } from '@prisma/client';
import { PermissionGuard } from '../src/auth/auth.guards';
import { Permission } from '../src/auth/auth.constants';

describe('RBAC authorization', () => {
  function context(role: MembershipRole): ExecutionContext {
    return {
      getHandler: () => function handler() {},
      getClass: () => class Controller {},
      switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
    } as unknown as ExecutionContext;
  }

  it('allows a cashier to check out but not issue refunds', () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Permission.CHECKOUT]);
    expect(new PermissionGuard(reflector).canActivate(context(MembershipRole.CASHIER))).toBe(true);
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Permission.REFUNDS]);
    expect(() => new PermissionGuard(reflector).canActivate(context(MembershipRole.CASHIER))).toThrow(ForbiddenException);
  });

  it('allows owners to access all declared permissions', () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(Object.values(Permission));
    expect(new PermissionGuard(reflector).canActivate(context(MembershipRole.OWNER))).toBe(true);
  });
});
