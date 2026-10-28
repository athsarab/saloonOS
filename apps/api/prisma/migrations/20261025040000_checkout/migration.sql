CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED', 'REFUNDED');
CREATE TYPE "RefundStatus" AS ENUM ('COMPLETED', 'VOIDED');
CREATE TYPE "CashShiftStatus" AS ENUM ('OPEN', 'CLOSED');

ALTER TABLE "CatalogItem" ADD COLUMN "trackInventory" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CatalogItem" ADD COLUMN "stockQuantity" DECIMAL(10,3) NOT NULL DEFAULT 0;

ALTER TABLE "Sale" ADD COLUMN "receiptNumber" VARCHAR(40);
ALTER TABLE "Sale" ADD COLUMN "idempotencyKey" VARCHAR(120);
ALTER TABLE "Sale" ADD COLUMN "createdByUserId" UUID;
UPDATE "Sale" SET "receiptNumber" = 'SAL-' || substring(replace("id"::text, '-', ''), 1, 24) WHERE "receiptNumber" IS NULL;
UPDATE "Sale" SET "idempotencyKey" = 'legacy-' || "id"::text WHERE "idempotencyKey" IS NULL;
ALTER TABLE "Sale" ALTER COLUMN "receiptNumber" SET NOT NULL;
ALTER TABLE "Sale" ALTER COLUMN "idempotencyKey" SET NOT NULL;

ALTER TABLE "SaleLine" ADD COLUMN "assignedStaffProfileId" UUID;
ALTER TABLE "Payment" ADD COLUMN "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Payment" ADD COLUMN "idempotencyKey" VARCHAR(120);
UPDATE "Payment" SET "status" = CASE WHEN "method"::text = 'BANK_TRANSFER' THEN 'PENDING'::"PaymentStatus" ELSE 'VERIFIED'::"PaymentStatus" END;

CREATE TABLE "Refund" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "saleId" UUID NOT NULL,
  "amountLkr" DECIMAL(12,2) NOT NULL,
  "reason" VARCHAR(255) NOT NULL,
  "status" "RefundStatus" NOT NULL DEFAULT 'COMPLETED',
  "createdByUserId" UUID,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CashShift" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "openedByUserId" UUID NOT NULL,
  "closedByUserId" UUID,
  "openingAmountLkr" DECIMAL(12,2) NOT NULL,
  "closingAmountLkr" DECIMAL(12,2),
  "status" "CashShiftStatus" NOT NULL DEFAULT 'OPEN',
  "openedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMPTZ(3),
  CONSTRAINT "CashShift_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Sale_tenantId_receiptNumber_key" ON "Sale"("tenantId", "receiptNumber");
CREATE UNIQUE INDEX "Sale_tenantId_idempotencyKey_key" ON "Sale"("tenantId", "idempotencyKey");
CREATE UNIQUE INDEX "Payment_tenantId_idempotencyKey_key" ON "Payment"("tenantId", "idempotencyKey");
CREATE INDEX "Refund_tenantId_saleId_createdAt_idx" ON "Refund"("tenantId", "saleId", "createdAt");
CREATE INDEX "CashShift_tenantId_branchId_status_idx" ON "CashShift"("tenantId", "branchId", "status");
CREATE UNIQUE INDEX "CashShift_one_open_per_branch" ON "CashShift"("tenantId", "branchId") WHERE "status" = 'OPEN';

ALTER TABLE "Sale" ADD CONSTRAINT "Sale_tenantId_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_tenantId_assignedStaffProfileId_fkey" FOREIGN KEY ("tenantId", "assignedStaffProfileId") REFERENCES "StaffProfile"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_tenantId_saleId_fkey" FOREIGN KEY ("tenantId", "saleId") REFERENCES "Sale"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CashShift" ADD CONSTRAINT "CashShift_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CashShift" ADD CONSTRAINT "CashShift_tenantId_branchId_fkey" FOREIGN KEY ("tenantId", "branchId") REFERENCES "Branch"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashShift" ADD CONSTRAINT "CashShift_openedByUserId_fkey" FOREIGN KEY ("openedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashShift" ADD CONSTRAINT "CashShift_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
