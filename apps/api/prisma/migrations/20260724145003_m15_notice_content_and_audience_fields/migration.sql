-- AlterEnum
ALTER TYPE "AudienceType" ADD VALUE 'STAFF';

-- AlterTable
ALTER TABLE "Notice" ADD COLUMN     "bodyNe" TEXT,
ADD COLUMN     "category" "CommunicationTemplateCategory" NOT NULL DEFAULT 'GENERAL',
ADD COLUMN     "guardianIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "isPinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recipientUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "roleNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "staffIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "studentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "templateId" TEXT,
ADD COLUMN     "titleNe" TEXT;

-- CreateIndex
CREATE INDEX "Notice_tenantId_isPinned_publishedAt_idx" ON "Notice"("tenantId", "isPinned", "publishedAt");

-- AddForeignKey
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CommunicationTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "NoticeAcknowledgement_tenantId_recipientUserId_firstAcknowledge" RENAME TO "NoticeAcknowledgement_tenantId_recipientUserId_firstAcknowl_idx";

-- RenameIndex
ALTER INDEX "notification_event_source_idx" RENAME TO "NotificationEvent_tenantId_sourceModule_sourceEntityType_so_idx";

-- RenameIndex
ALTER INDEX "StudentDuplicateReview_tenantId_firstStudentId_secondStudentId_" RENAME TO "StudentDuplicateReview_tenantId_firstStudentId_secondStuden_key";
