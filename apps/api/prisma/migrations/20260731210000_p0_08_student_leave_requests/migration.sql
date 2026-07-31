-- P0-08 residual: student leave requests that inform attendance state.

CREATE TABLE "StudentLeaveRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "leaveType" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentLeaveRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StudentLeaveRequest_tenantId_studentId_status_idx" ON "StudentLeaveRequest"("tenantId", "studentId", "status");
CREATE INDEX "StudentLeaveRequest_tenantId_startsOn_endsOn_idx" ON "StudentLeaveRequest"("tenantId", "startsOn", "endsOn");
CREATE INDEX "StudentLeaveRequest_tenantId_status_startsOn_endsOn_idx" ON "StudentLeaveRequest"("tenantId", "status", "startsOn", "endsOn");

ALTER TABLE "StudentLeaveRequest" ADD CONSTRAINT "StudentLeaveRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentLeaveRequest" ADD CONSTRAINT "StudentLeaveRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentLeaveRequest" ADD CONSTRAINT "StudentLeaveRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentLeaveRequest" ADD CONSTRAINT "StudentLeaveRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
