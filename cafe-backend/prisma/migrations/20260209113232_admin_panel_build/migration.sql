-- CreateEnum
CREATE TYPE "SubscriptionPaymentMethod" AS ENUM ('ESEWA_QR', 'ESEWA_GATEWAY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SubscriptionStatus" ADD VALUE 'PENDING_VERIFICATION';
ALTER TYPE "SubscriptionStatus" ADD VALUE 'REJECTED';

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'ADMIN';

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "paidAmount" DOUBLE PRECISION,
ADD COLUMN     "paymentMethod" "SubscriptionPaymentMethod",
ADD COLUMN     "rejectionNote" TEXT,
ADD COLUMN     "screenshotUrl" TEXT,
ADD COLUMN     "transactionId" TEXT,
ALTER COLUMN "startsAt" DROP NOT NULL,
ALTER COLUMN "endsAt" DROP NOT NULL,
ALTER COLUMN "gateway" SET DEFAULT 'MANUAL_QR';

-- CreateIndex
CREATE INDEX "Subscription_tenantId_status_endsAt_idx" ON "Subscription"("tenantId", "status", "endsAt");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
