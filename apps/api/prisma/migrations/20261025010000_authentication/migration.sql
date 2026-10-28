-- Authentication migration. This preserves existing rows while replacing legacy role names.
ALTER TYPE "MembershipRole" RENAME TO "MembershipRole_legacy";
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'MANAGER', 'CASHIER', 'STYLIST');
ALTER TABLE "Membership"
  ALTER COLUMN "role" TYPE "MembershipRole"
  USING (
    CASE "role"::text
      WHEN 'ADMIN' THEN 'MANAGER'
      WHEN 'RECEPTIONIST' THEN 'CASHIER'
      WHEN 'STAFF' THEN 'STYLIST'
      ELSE "role"::text
    END
  )::"MembershipRole";
DROP TYPE "MembershipRole_legacy";

ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMPTZ(3);

ALTER TABLE "Session"
  ADD COLUMN "tokenFamilyId" UUID,
  ADD COLUMN "replacedById" UUID,
  ADD COLUMN "revokedAt" TIMESTAMPTZ(3),
  ADD COLUMN "lastUsedAt" TIMESTAMPTZ(3),
  ADD COLUMN "userAgent" VARCHAR(255);
UPDATE "Session" SET "tokenFamilyId" = gen_random_uuid() WHERE "tokenFamilyId" IS NULL;
ALTER TABLE "Session" ALTER COLUMN "tokenFamilyId" SET NOT NULL;
CREATE INDEX "Session_tokenFamilyId_idx" ON "Session"("tokenFamilyId");
CREATE INDEX "Session_userId_revokedAt_idx" ON "Session"("userId", "revokedAt");

CREATE TABLE "EmailVerificationToken" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "tokenHash" VARCHAR(64) NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "usedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");
CREATE INDEX "EmailVerificationToken_userId_expiresAt_idx" ON "EmailVerificationToken"("userId", "expiresAt");
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PasswordResetToken" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "tokenHash" VARCHAR(64) NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "usedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX "PasswordResetToken_userId_expiresAt_idx" ON "PasswordResetToken"("userId", "expiresAt");
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
