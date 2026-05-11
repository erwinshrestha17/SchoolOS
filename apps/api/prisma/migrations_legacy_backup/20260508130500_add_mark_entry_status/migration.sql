-- CreateEnum
CREATE TYPE "MarkEntryStatus" AS ENUM ('SUBMITTED', 'ABSENT', 'WITHHELD');

-- AlterTable
ALTER TABLE "MarkEntry" ADD COLUMN     "status" "MarkEntryStatus" NOT NULL DEFAULT 'SUBMITTED';
