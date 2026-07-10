-- AlterTable
ALTER TABLE "DevelopmentalMilestone" ADD COLUMN "clientSubmissionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "developmental_milestone_client_submission_key" ON "DevelopmentalMilestone"("tenantId", "createdById", "clientSubmissionId");

-- CreateIndex
CREATE INDEX "notification_delivery_activity_post_idx" ON "NotificationDelivery"("tenantId", "activityPostId");
