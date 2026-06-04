CREATE TABLE "DemoRequest" (
    "id" TEXT NOT NULL,
    "schoolName" TEXT NOT NULL,
    "schoolType" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "studentsCount" TEXT NOT NULL,
    "branchesCount" TEXT,
    "contactName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "preferredContact" TEXT,
    "currentSystem" TEXT,
    "expectedTimeline" TEXT NOT NULL,
    "interestedModules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemoRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DemoRequest_status_createdAt_idx" ON "DemoRequest"("status", "createdAt");
CREATE INDEX "DemoRequest_email_createdAt_idx" ON "DemoRequest"("email", "createdAt");
CREATE INDEX "DemoRequest_schoolName_idx" ON "DemoRequest"("schoolName");
