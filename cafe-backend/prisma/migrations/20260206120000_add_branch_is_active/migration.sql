-- AlterTable: add isActive to Branch (default true for existing rows)
ALTER TABLE "Branch" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
