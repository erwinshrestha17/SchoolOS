"use client";

import Link from "next/link";
import { useQueries } from "@tanstack/react-query";
import {
  CalendarClock,
  ClipboardList,
  FileCheck2,
  FileWarning,
  QrCode,
  ScanSearch,
  UserPlus,
  UserRoundCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { DashboardPageShell } from "../../../components/dashboard/dashboard-page-shell";
import { AdmissionCaseQueues } from "../../../components/m1/admission-case-queues";
import { M1PageHeader } from "../../../components/m1/m1-page-header";
import {
  SummaryCard,
  SummaryGrid,
} from "../../../components/ui/summary-card";
import { useSession } from "../../../components/session-provider";
import { Button } from "../../../components/ui/primitives/button";
import {
  admissionCasesApi,
  type AdmissionCaseQueue,
} from "../../../lib/api/admission-cases";

const ADMISSION_SUMMARY_QUEUES = [
  "NEEDS_INFORMATION",
  "WAITING_FOR_REVIEW",
  "READY_TO_ADMIT",
  "DUPLICATE_WARNINGS",
] as const satisfies readonly AdmissionCaseQueue[];

export default function AdmissionsPage() {
  const router = useRouter();
  const { hasPermissions } = useSession();
  const canCreateAdmission = hasPermissions([
    "enrollments:create",
    "students:create",
    "guardians:create",
  ]);
  const canManageDuplicates = hasPermissions(["students:manage_lifecycle"]);
  const canReadAdmissionPolicies = hasPermissions(["admission_policy:read"]);

  const summaryQueries = useQueries({
    queries: ADMISSION_SUMMARY_QUEUES.map((queue) => ({
      queryKey: ["admission-case-queue-summary", queue],
      queryFn: () => admissionCasesApi.listQueues({ queue, page: 1, limit: 1 }),
    })),
  });
  const summaryQuery = (queue: AdmissionCaseQueue) =>
    summaryQueries[ADMISSION_SUMMARY_QUEUES.indexOf(queue as (typeof ADMISSION_SUMMARY_QUEUES)[number])];

  return (
    <DashboardPageShell className="gap-5">
      <M1PageHeader
        title="Admissions"
        description="Review admission cases, collect missing information, resolve warnings, and admit ready students safely."
        primaryAction={
          canCreateAdmission ? (
            <Button asChild>
              <Link href="/dashboard/admissions/new">
                <UserPlus data-icon="inline-start" />
                New admission
              </Link>
            </Button>
          ) : undefined
        }
        moreActionItems={
          [
              {
                label: "Online applications",
                icon: <ClipboardList />,
                onClick: () =>
                  router.push("/dashboard/admissions/applications"),
              },
              ...(canCreateAdmission
                ? [
                {
                  label: "Assessment & interview",
                  icon: <CalendarClock />,
                  onClick: () =>
                    router.push("/dashboard/admissions/assessments"),
                },
                ]
                : []),
              {
                label: "Document issues",
                icon: <FileWarning />,
                onClick: () => router.push("/dashboard/admissions/documents"),
              },
              ...(canManageDuplicates
                ? [
                {
                  label: "Duplicate review",
                  icon: <ScanSearch />,
                  onClick: () =>
                    router.push("/dashboard/admissions/duplicates"),
                },
                ]
                : []),
              {
                  label: "Imports & iEMIS readiness",
                  icon: <FileCheck2 />,
                  onClick: () => router.push("/dashboard/admissions/iemis"),
              },
              {
                label: "QR / ID cards",
                icon: <QrCode />,
                onClick: () => router.push("/dashboard/admissions/qr"),
              },
              ...(canReadAdmissionPolicies
                ? [
                    {
                      label: "Admission policies",
                      icon: <FileCheck2 />,
                      onClick: () =>
                        router.push("/dashboard/settings/admissions"),
                    },
                  ]
                : []),
            ]
        }
      />

      <SummaryGrid>
        <SummaryCard
          label="Needs Information"
          value={summaryQuery("NEEDS_INFORMATION")?.data?.total ?? "Unavailable"}
          loading={summaryQuery("NEEDS_INFORMATION")?.isLoading}
          icon={<FileWarning aria-hidden />}
          href="/dashboard/admissions?queue=NEEDS_INFORMATION"
          description="Cases missing details or documents."
        />
        <SummaryCard
          label="Waiting for Review"
          value={summaryQuery("WAITING_FOR_REVIEW")?.data?.total ?? "Unavailable"}
          loading={summaryQuery("WAITING_FOR_REVIEW")?.isLoading}
          icon={<ClipboardList aria-hidden />}
          href="/dashboard/admissions?queue=WAITING_FOR_REVIEW"
          description="Cases waiting for staff review."
        />
        <SummaryCard
          label="Ready to Admit"
          value={summaryQuery("READY_TO_ADMIT")?.data?.total ?? "Unavailable"}
          loading={summaryQuery("READY_TO_ADMIT")?.isLoading}
          icon={<UserRoundCheck aria-hidden />}
          href="/dashboard/admissions?queue=READY_TO_ADMIT"
          description="Cases ready for final admission."
        />
        <SummaryCard
          label="Duplicate Warnings"
          value={summaryQuery("DUPLICATE_WARNINGS")?.data?.total ?? "Unavailable"}
          loading={summaryQuery("DUPLICATE_WARNINGS")?.isLoading}
          icon={<ScanSearch aria-hidden />}
          href="/dashboard/admissions?queue=DUPLICATE_WARNINGS"
          description="Possible matches with existing students."
        />
      </SummaryGrid>
      <AdmissionCaseQueues />
    </DashboardPageShell>
  );
}
