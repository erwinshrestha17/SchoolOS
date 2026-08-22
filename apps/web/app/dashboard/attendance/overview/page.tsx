import { PrincipalSummaryWorkspace } from "../../../../components/principal/principal-summary-workspace";

export default function PrincipalAttendanceOverviewPage() {
  return (
    <PrincipalSummaryWorkspace
      title="Attendance Oversight"
      description="Check whether today’s attendance operation is complete and review exceptions without opening the marking desk."
      definitions={[
        {
          module: "attendance",
          moduleName: "Attendance",
          title: "Today’s attendance",
          description: "Backend-owned school-wide attendance completion and exception signals.",
          metrics: [
            { key: "expectedStudents", label: "Active students" },
            { key: "attendanceSessionsToday", label: "Registers started" },
            { key: "presentToday", label: "Present today" },
            { key: "absentToday", label: "Absent today" },
            { key: "lateToday", label: "Late today" },
            { key: "pendingCorrections", label: "Corrections waiting" },
            { key: "unsubmittedRegisters", label: "Registers not submitted" },
          ],
        },
      ]}
    />
  );
}
