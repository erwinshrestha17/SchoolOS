-- AlterTable
ALTER TABLE "AdmissionPolicyVersion" DROP COLUMN "approvalLevel",
ADD COLUMN     "approvalPolicyId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionPolicyVersion_approvalPolicyId_key" ON "AdmissionPolicyVersion"("approvalPolicyId");

-- AddForeignKey
ALTER TABLE "AdmissionPolicyVersion" ADD CONSTRAINT "AdmissionPolicyVersion_approvalPolicyId_fkey" FOREIGN KEY ("approvalPolicyId") REFERENCES "ApprovalPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
