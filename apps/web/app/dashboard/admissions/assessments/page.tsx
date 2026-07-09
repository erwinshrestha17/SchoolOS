import { DashboardPageShell } from "../../../../components/dashboard/dashboard-page-shell";
import { AssessmentInterviewWorkspace } from "../../../../components/m1/assessment-interview-workspace";
import { M1PageHeader } from "../../../../components/m1/m1-page-header";

export default function AdmissionAssessmentPage() {
  return (
    <DashboardPageShell>
      <M1PageHeader
        title="Assessment & Interview"
        description="Schedule admission assessments and interviews, then record results before final review."
      />
      <AssessmentInterviewWorkspace />
    </DashboardPageShell>
  );
}
