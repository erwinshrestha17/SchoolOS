import { PrincipalSummaryWorkspace } from "../../../../components/principal/principal-summary-workspace";

export default function PrincipalCommunicationOversightPage() {
  return (
    <PrincipalSummaryWorkspace
      title="Communication Oversight"
      description="Review high-impact notices and delivery exceptions while leaving routine composing and delivery operations in their owning workspaces."
      definitions={[
        {
          module: "communications",
          moduleName: "Notices & Announcements",
          title: "Communication readiness",
          description: "Backend-owned scheduling, delivery, unread-recipient, and high-impact notice signals.",
          metrics: [
            { key: "scheduledNotices", label: "Scheduled notices" },
            { key: "failedDeliveries", label: "Failed deliveries" },
            { key: "unreadNoticeRecipients", label: "Unread recipients" },
            { key: "highImpactNoticesAwaitingPublication", label: "High-impact notices waiting" },
          ],
        },
      ]}
    />
  );
}
