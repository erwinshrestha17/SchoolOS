import { PrincipalSummaryWorkspace } from "../../../../components/principal/principal-summary-workspace";

export default function PrincipalEnrollmentOverviewPage() {
  return (
    <PrincipalSummaryWorkspace
      title="Enrollment Overview"
      description="Review enrollment movement and student-record readiness without entering routine student administration."
      definitions={[
        {
          module: "students",
          moduleName: "Students",
          title: "Enrollment and record readiness",
          description: "Leadership-safe enrollment, document, duplicate, and iEMIS readiness signals.",
          metrics: [
            { key: "admissionsToday", label: "Admissions today" },
            { key: "applicationsNeedingReview", label: "Applications in progress" },
            { key: "unverifiedDocuments", label: "Documents not verified" },
            { key: "duplicateCandidates", label: "Possible duplicates" },
            { key: "iemisReadinessBlockers", label: "iEMIS blockers" },
          ],
        },
      ]}
    />
  );
}
