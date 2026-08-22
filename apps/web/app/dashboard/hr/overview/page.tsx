import { PrincipalSummaryWorkspace } from "../../../../components/principal/principal-summary-workspace";

export default function PrincipalStaffOverviewPage() {
  return (
    <PrincipalSummaryWorkspace
      title="Staff Overview"
      description="Review staff availability, leave pressure, attendance exceptions, and contract risks without entering HR administration or payroll operations."
      definitions={[
        {
          module: "hr-payroll",
          moduleName: "HR & Payroll",
          title: "People readiness",
          description: "Leadership-safe staff counts and operational exceptions from the HR domain.",
          metrics: [
            { key: "staffPresentToday", label: "Staff present today" },
            { key: "staffOnApprovedLeaveToday", label: "On approved leave" },
            { key: "pendingLeaveRequests", label: "Leave requests waiting" },
            { key: "staffAttendanceAnomalies", label: "Attendance exceptions" },
            { key: "contractsExpiringSoon", label: "Contracts expiring soon" },
          ],
        },
      ]}
    />
  );
}
