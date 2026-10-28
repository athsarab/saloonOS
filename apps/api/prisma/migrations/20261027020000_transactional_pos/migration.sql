-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "receiptCounter" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stockPolicy" VARCHAR(20) NOT NULL DEFAULT 'REJECT';

-- AlterTable
ALTER TABLE "CatalogItem" ADD COLUMN     "taxLabel" VARCHAR(80) NOT NULL DEFAULT 'No tax',
ADD COLUMN     "taxRateBps" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "branchAddress" VARCHAR(500),
ADD COLUMN     "branchName" VARCHAR(160),
ADD COLUMN     "customerName" VARCHAR(170),
ADD COLUMN     "receiptSequence" INTEGER,
ADD COLUMN     "voidReason" VARCHAR(255),
ADD COLUMN     "voidedAt" TIMESTAMPTZ(3),
ALTER COLUMN "receiptNumber" SET DATA TYPE VARCHAR(80);

-- AlterTable
ALTER TABLE "SaleLine" ADD COLUMN     "discountLkr" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "taxLabel" VARCHAR(80) NOT NULL DEFAULT 'No tax',
ADD COLUMN     "taxLkr" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "taxRateBps" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "resolvedAt" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "BranchPrice" (
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "priceLkr" DECIMAL(12,2) NOT NULL,
    "taxRateBps" INTEGER NOT NULL DEFAULT 0,
    "taxLabel" VARCHAR(80) NOT NULL DEFAULT 'No tax',
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "BranchPrice_pkey" PRIMARY KEY ("tenantId","branchId","itemId")
);

-- CreateTable
CREATE TABLE "StockBalance" (
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL DEFAULT 0,

    CONSTRAINT "StockBalance_pkey" PRIMARY KEY ("tenantId","branchId","itemId")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "delta" DECIMAL(10,3) NOT NULL,
    "balanceAfter" DECIMAL(10,3) NOT NULL,
    "kind" VARCHAR(32) NOT NULL,
    "reason" VARCHAR(255) NOT NULL,
    "actorUserId" UUID,
    "saleId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialCommand" (
    "tenantId" UUID NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialCommand_pkey" PRIMARY KEY ("tenantId","key")
);

-- CreateIndex
CREATE INDEX "InventoryMovement_tenantId_branchId_createdAt_idx" ON "InventoryMovement"("tenantId", "branchId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_tenantId_branchId_receiptSequence_key" ON "Sale"("tenantId", "branchId", "receiptSequence");

-- AddForeignKey
ALTER TABLE "BranchPrice" ADD CONSTRAINT "BranchPrice_tenantId_branchId_fkey" FOREIGN KEY ("tenantId", "branchId") REFERENCES "Branch"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchPrice" ADD CONSTRAINT "BranchPrice_tenantId_itemId_fkey" FOREIGN KEY ("tenantId", "itemId") REFERENCES "CatalogItem"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_tenantId_branchId_fkey" FOREIGN KEY ("tenantId", "branchId") REFERENCES "Branch"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_tenantId_itemId_fkey" FOREIGN KEY ("tenantId", "itemId") REFERENCES "CatalogItem"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_tenantId_branchId_fkey" FOREIGN KEY ("tenantId", "branchId") REFERENCES "Branch"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_tenantId_itemId_fkey" FOREIGN KEY ("tenantId", "itemId") REFERENCES "CatalogItem"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_stock_policy_check" CHECK ("stockPolicy" IN ('REJECT','ALLOW_NEGATIVE'));
ALTER TABLE "CatalogItem" DROP CONSTRAINT IF EXISTS "CatalogItem_nonnegative_stock";
ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_tax_rate_check" CHECK ("taxRateBps" BETWEEN 0 AND 10000);
ALTER TABLE "BranchPrice" ADD CONSTRAINT "BranchPrice_values_check" CHECK ("priceLkr" > 0 AND "taxRateBps" BETWEEN 0 AND 10000);
ALTER TABLE "FinancialCommand" ADD CONSTRAINT "FinancialCommand_tenant_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_sale_fkey" FOREIGN KEY ("tenantId","saleId") REFERENCES "Sale"("tenantId","id") DEFERRABLE INITIALLY DEFERRED;
DROP INDEX IF EXISTS "Payment_bank_reference_unique";
CREATE UNIQUE INDEX "Payment_external_reference_unique" ON "Payment" ("tenantId", "method", upper(trim("reference"))) WHERE "method" <> 'CASH' AND "status" <> 'FAILED' AND "idempotencyKey" IS NOT NULL;
UPDATE "Payment" SET "resolvedAt" = COALESCE("verifiedAt", "createdAt") WHERE "status" <> 'PENDING';
UPDATE "Sale" s SET "branchName" = b."name", "branchAddress" = b."address" FROM "Branch" b WHERE s."branchId" = b."id";
UPDATE "Sale" s SET "customerName" = concat_ws(' ', c."firstName", c."lastName") FROM "Customer" c WHERE s."customerId" = c."id";
-- Legacy multi-branch global quantities cannot be safely assigned: leave those balances at zero until counted.
INSERT INTO "StockBalance" ("tenantId","branchId","itemId","quantity")
SELECT c."tenantId", b."id", c."id", c."stockQuantity" FROM "CatalogItem" c JOIN "Branch" b ON b."tenantId"=c."tenantId"
WHERE c."trackInventory" AND c."type"='PRODUCT' AND (SELECT count(*) FROM "Branch" x WHERE x."tenantId"=c."tenantId")=1;
INSERT INTO "InventoryMovement" ("id","tenantId","branchId","itemId","delta","balanceAfter","kind","reason")
SELECT gen_random_uuid(), "tenantId","branchId","itemId","quantity","quantity",'OPENING','Phase 4 legacy single-branch import' FROM "StockBalance";
