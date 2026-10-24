import { MembershipRole } from '@prisma/client';

export type AccessTokenPayload = {
  sub: string;
  sid: string;
  tenantId: string;
  role: MembershipRole;
};

export type AuthenticatedRequest = {
  user: AccessTokenPayload;
};
