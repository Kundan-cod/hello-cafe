-- CreateEnum
CREATE TYPE "OrderManagementType" AS ENUM ('TABLE_BASED', 'COUNTER_BASED', 'BOTH');

-- Migrate existing Tenant.orderManagementType: map HYBRID to BOTH
UPDATE "Tenant" SET "orderManagementType" = 'BOTH' WHERE "orderManagementType" = 'HYBRID';

-- AlterTable: change Tenant.orderManagementType from TEXT to enum
ALTER TABLE "Tenant" ALTER COLUMN "orderManagementType" DROP DEFAULT;
ALTER TABLE "Tenant" ALTER COLUMN "orderManagementType" TYPE "OrderManagementType" USING ("orderManagementType"::"OrderManagementType");

-- AlterTable: add counterNumber to Order
ALTER TABLE "Order" ADD COLUMN "counterNumber" INTEGER;
