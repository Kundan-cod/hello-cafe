-- CreateIndex
CREATE INDEX "Order_tenantId_branchId_status_createdAt_idx" ON "Order"("tenantId", "branchId", "status", "createdAt" DESC);
