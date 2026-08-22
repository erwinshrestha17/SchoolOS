import { PrincipalSummaryWorkspace } from "../../../../components/principal/principal-summary-workspace";

export default function PrincipalAdmissionsOverviewPage() {
  return (
    <PrincipalSummaryWorkspace
      title="Admissions Overview"
      description="See admission pipeline pressure and record-quality exceptions without opening the receptionist intake desk."
      definitions={[
        {
          module: "students",
          moduleName: "Admissions",
          title: "Admissions readiness",
          description: "A read-only leadership view of applications and admission data-quality risks.",
          metrics: [
            { key: "applicationsNeedingReview", label: "Applications in progress" },
            { key: "admissionsToday", label: "Admissions today" },
            { key: "unverifiedDocuments", label: "Documents not verified" },
            { key: "duplicateCandidates", label: "Possible duplicates" },
            { key: "iemisReadinessBlockers", label: "iEMIS blockers" },
          ],
        },
      ]}
    />
  );
}
