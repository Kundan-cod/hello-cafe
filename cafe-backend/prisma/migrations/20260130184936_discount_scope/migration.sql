-- CreateEnum
CREATE TYPE "DiscountScope" AS ENUM ('ALL', 'CATEGORY', 'ITEM');

-- AlterTable
ALTER TABLE "Discount" ADD COLUMN     "categoryIds" JSONB,
ADD COLUMN     "menuItemIds" JSONB,
ADD COLUMN     "scope" "DiscountScope" NOT NULL DEFAULT 'ALL';
