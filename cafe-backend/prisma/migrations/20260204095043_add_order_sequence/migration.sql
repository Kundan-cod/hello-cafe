/*
  Warnings:

  - You are about to drop the column `authUserId` on the `User` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "User_authUserId_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "authUserId";
