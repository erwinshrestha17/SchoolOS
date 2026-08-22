import { PrincipalSummaryWorkspace } from "../../../../components/principal/principal-summary-workspace";

export default function PrincipalActivityOversightPage() {
  return (
    <PrincipalSummaryWorkspace
      title="Activity Oversight"
      description="Review parent-visible activity, consent, moderation, and media exceptions without turning the Principal workspace into a posting desk."
      definitions={[
        {
          module: "activity",
          moduleName: "Activity Feed",
          title: "Activity and consent readiness",
          description: "Leadership-safe moderation and consent signals from the activity domain.",
          metrics: [
            { key: "pendingReview", label: "Posts awaiting moderation" },
            { key: "consentIssues", label: "Photo consent issues" },
            { key: "failedUploads", label: "Failed media uploads" },
          ],
        },
      ]}
    />
  );
}
