-- CreateEnum
CREATE TYPE "ActivityPostLanguage" AS ENUM ('ENGLISH', 'NEPALI', 'BOTH');

-- AlterTable
ALTER TABLE "ActivityPost" ADD COLUMN "language" "ActivityPostLanguage" NOT NULL DEFAULT 'ENGLISH';
