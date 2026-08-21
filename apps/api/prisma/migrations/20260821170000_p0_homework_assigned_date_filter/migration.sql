-- Support tenant-scoped Nepal school-day range filtering without loading a
-- full homework history into the browser.
CREATE INDEX "HomeworkAssignment_tenantId_assignedDate_idx"
ON "HomeworkAssignment"("tenantId", "assignedDate");
