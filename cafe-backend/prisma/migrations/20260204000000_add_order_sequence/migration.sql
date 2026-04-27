-- CreateTable
CREATE TABLE "OrderSequence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchKey" TEXT NOT NULL DEFAULT '',
    "lastOrderNumber" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderSequence_tenantId_branchKey_key" ON "OrderSequence"("tenantId", "branchKey");

-- Seed from existing orders so next orderNumber = max(existing) + 1
INSERT INTO "OrderSequence" ("id", "tenantId", "branchKey", "lastOrderNumber", "updatedAt")
SELECT
  gen_random_uuid(),
  "tenantId",
  COALESCE("branchId", ''),
  COALESCE(MAX("orderNumber"), 0),
  NOW()
FROM "Order"
GROUP BY "tenantId", COALESCE("branchId", '');
