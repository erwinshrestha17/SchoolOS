import { PrincipalSummaryWorkspace } from "../../../../components/principal/principal-summary-workspace";

export default function PrincipalAcademicReadinessPage() {
  return (
    <PrincipalSummaryWorkspace
      title="Academic Readiness"
      description="See exam, marks, result, report-card, and promotion blockers that require leadership awareness or review."
      definitions={[
        {
          module: "academics",
          moduleName: "Academics",
          title: "Academic readiness",
          description: "Read-only academic progress and publication readiness from the school database.",
          metrics: [
            { key: "examSlotsToday", label: "Exam periods today" },
            { key: "marksOpen", label: "Open mark entries" },
            { key: "pendingMarkLocks", label: "Mark lock requests" },
            { key: "reportCardPublishBlockers", label: "Report cards not published" },
            { key: "pendingReportCardCorrections", label: "Result corrections waiting" },
            { key: "promotionReady", label: "Promotion records ready" },
          ],
        },
      ]}
    />
  );
}
