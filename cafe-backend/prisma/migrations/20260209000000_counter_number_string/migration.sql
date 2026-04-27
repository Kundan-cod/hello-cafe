-- AlterTable: change counterNumber from INTEGER to TEXT so it can store any label (e.g. "A1", "Window 2")
ALTER TABLE "Order" ALTER COLUMN "counterNumber" TYPE TEXT USING "counterNumber"::text;
