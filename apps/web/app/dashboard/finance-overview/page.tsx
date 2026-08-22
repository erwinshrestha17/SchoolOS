import { PrincipalSummaryWorkspace } from "../../../components/principal/principal-summary-workspace";

export default function PrincipalFinanceOverviewPage() {
  return (
    <PrincipalSummaryWorkspace
      title="Finance Overview"
      description="Review finance readiness and accounting exceptions without entering cashier or journal operations."
      definitions={[
        {
          module: "accounting",
          moduleName: "Accounting",
          title: "Finance readiness",
          description: "Read-only period, posting, and reconciliation signals. Fee collection operations remain in authorized finance workspaces.",
          metrics: [
            { key: "openFiscalPeriods", label: "Open fiscal periods" },
            { key: "unpostedJournals", label: "Journals not posted" },
            { key: "unreconciledStatements", label: "Statements not reconciled" },
            { key: "periodCloseBlockers", label: "Period close blockers" },
          ],
        },
      ]}
    />
  );
}
