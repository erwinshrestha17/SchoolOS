CREATE TABLE "NoticeAcknowledgement" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "noticeId" TEXT NOT NULL,
  "recipientUserId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "guardianId" TEXT,
  "studentId" TEXT,
  "firstAcknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NoticeAcknowledgement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NoticeAcknowledgement_tenantId_fkey" FOREIGN KEY ("tenantId")
    REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "NoticeAcknowledgement_noticeId_fkey" FOREIGN KEY ("noticeId")
    REFERENCES "Notice"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "NoticeAcknowledgement_recipientUserId_fkey" FOREIGN KEY ("recipientUserId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "NoticeAcknowledgement_actorId_fkey" FOREIGN KEY ("actorId")
    REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "NoticeAcknowledgement_tenantId_noticeId_recipientUserId_key"
ON "NoticeAcknowledgement"("tenantId", "noticeId", "recipientUserId");

CREATE INDEX "NoticeAcknowledgement_tenantId_noticeId_firstAcknowledgedAt_idx"
ON "NoticeAcknowledgement"("tenantId", "noticeId", "firstAcknowledgedAt");

CREATE INDEX "NoticeAcknowledgement_tenantId_recipientUserId_firstAcknowledgedAt_idx"
ON "NoticeAcknowledgement"("tenantId", "recipientUserId", "firstAcknowledgedAt");
