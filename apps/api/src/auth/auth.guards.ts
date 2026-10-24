import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MembershipRole } from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import { IS_PUBLIC_KEY, PERMISSIONS_KEY } from './auth.decorators';
import { ROLE_PERMISSIONS, Permission } from './auth.constants';
import { AuthenticatedRequest } from './auth.types';

@Injectable()
export class TenantMembershipGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly database: DatabaseService) {}

  async canActivate(context: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user?.sub || !request.user.tenantId) throw new UnauthorizedException('Authentication required');
    const session = await this.database.session.findFirst({ where: { id: request.user.sid, userId: request.user.sub, tenantId: request.user.tenantId, revokedAt: null, expiresAt: { gt: new Date() } } });
    if (!session) throw new UnauthorizedException('Authentication required');
    const membership = await this.database.membership.findUnique({ where: { tenantId_userId: { tenantId: request.user.tenantId, userId: request.user.sub } } });
    if (!membership) throw new ForbiddenException('Active membership required');
    request.user.role = membership.role;
    return true;
  }
}

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
    if (!required?.length) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const permissions = ROLE_PERMISSIONS[request.user.role as MembershipRole] ?? [];
    if (!required.every((permission) => permissions.includes(permission))) throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}
