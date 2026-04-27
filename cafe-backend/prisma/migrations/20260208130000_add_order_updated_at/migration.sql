-- AlterTable: add updatedAt to Order (required by schema and getOrdersStatus)
ALTER TABLE "Order" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex for getOrdersStatus ordering (tenantId, branchId, updatedAt desc)
CREATE INDEX "Order_tenantId_branchId_updatedAt_idx" ON "Order"("tenantId", "branchId", "updatedAt" DESC);
