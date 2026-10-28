CREATE TABLE "OfflineDevice" (
 "id" UUID PRIMARY KEY, "tenantId" UUID NOT NULL, "name" VARCHAR(80) NOT NULL,
 "secretHash" VARCHAR(64) NOT NULL, "registeredBy" UUID NOT NULL,
 "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "OfflineDevice_tenantId_active_idx" ON "OfflineDevice"("tenantId", "active");
CREATE TABLE "OfflineGrant" (
 "id" UUID PRIMARY KEY, "deviceId" UUID NOT NULL REFERENCES "OfflineDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "tenantId" UUID NOT NULL, "userId" UUID NOT NULL, "sessionId" UUID NOT NULL,
 "branchId" UUID NOT NULL, "shiftId" UUID NOT NULL, "issuedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "expiresAt" TIMESTAMPTZ(3) NOT NULL, "revokedAt" TIMESTAMPTZ(3), "snapshot" JSONB NOT NULL,
 "usedCount" INTEGER NOT NULL DEFAULT 0, "usedAmountLkr" DECIMAL(12,2) NOT NULL DEFAULT 0,
 CONSTRAINT "OfflineGrant_limits" CHECK ("usedCount" BETWEEN 0 AND 50 AND "usedAmountLkr" BETWEEN 0 AND 250000)
);
CREATE INDEX "OfflineGrant_tenantId_userId_idx" ON "OfflineGrant"("tenantId", "userId");
CREATE INDEX "OfflineGrant_deviceId_expiresAt_idx" ON "OfflineGrant"("deviceId", "expiresAt");
CREATE TABLE "OfflineOperation" (
 "id" UUID PRIMARY KEY, "grantId" UUID NOT NULL REFERENCES "OfflineGrant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "payloadHash" VARCHAR(64) NOT NULL, "state" VARCHAR(20) NOT NULL, "result" JSONB NOT NULL,
 "saleId" UUID UNIQUE, "recordedAt" TIMESTAMPTZ(3) NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "OfflineOperation_state" CHECK ("state" IN ('synchronized','rejected','conflicted'))
);
CREATE INDEX "OfflineOperation_grantId_state_idx" ON "OfflineOperation"("grantId", "state");
