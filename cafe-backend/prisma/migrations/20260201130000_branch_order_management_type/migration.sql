-- AlterTable: add orderManagementType to Branch (optional; falls back to tenant if null)
ALTER TABLE "Branch" ADD COLUMN "orderManagementType" "OrderManagementType";
