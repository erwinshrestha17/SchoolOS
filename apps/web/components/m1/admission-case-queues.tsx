"use client";

import type {
  AdmissionCaseQueueItem,
  AdmissionWaitlistCapacity,
} from "@schoolos/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Loader2,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatBsDate } from "@schoolos/core";
import {
  admissionCasesApi,
  type AdmissionCaseQueue,
} from "../../lib/api/admission-cases";
import { schoolFacingErrorMessage } from "../../lib/school-facing-error";
import { useSession } from "../session-provider";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { ErrorState } from "../ui/error-state";
import { TablePagination } from "../ui/table-pagination";
import { Badge } from "../ui/primitives/badge";
import { Button } from "../ui/primitives/button";
import { WorkSurface } from "../ui/work-surface";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "../ui/primitives/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "../ui/primitives/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "../ui/primitives/input-group";
import { Skeleton } from "../ui/primitives/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/primitives/table";
import { WorkspaceTabs } from "../ui/module-tabs";
import { useUrlFilters } from "../../lib/hooks/use-url-filters";

const QUEUES: Array<{
  id: AdmissionCaseQueue;
  label: string;
  description: string;
}> = [
  {
    id: "NEEDS_INFORMATION",
    label: "Needs Information",
    description:
      "These admission cases are missing required details or documents. Contact the applicant and complete the missing information.",
  },
  {
    id: "WAITING_FOR_REVIEW",
    label: "Waiting for Review",
    description:
      "These admission cases are ready for a staff review. Check the information, warnings, and school policy before deciding the next step.",
  },
  {
    id: "READY_TO_ADMIT",
    label: "Ready to Admit",
    description:
      "These admission cases passed the current checks. Review the final placement and admit the student when everything is correct.",
  },
  {
    id: "DUPLICATE_WARNINGS",
    label: "Duplicate Warnings",
    description:
      "These admission cases may match an existing student. Review the possible match before creating another student record.",
  },
  {
    id: "COMPLETED",
    label: "Completed",
    description:
      "These admissions were finalized and have a linked student record. Open the student profile to continue school operations.",
  },
  {
    id: "WAITLISTED",
    label: "Waitlisted",
    description:
      "Review oldest applications first, check current section capacity, and return a case to review when a place becomes available.",
  },
  {
    id: "APPROVED",
    label: "Approved",
    description:
      "These admission cases have approval but still need final admission completion.",
  },
  {
    id: "NOT_ADMITTED",
    label: "Not Admitted",
    description:
      "These admission cases have a recorded decision not to admit. Open a case to review its history.",
  },
  {
    id: "DOCUMENTS_PENDING",
    label: "Documents Pending",
    description:
      "These admitted students still have document follow-up work recorded on the original admission case.",
  },
];

const PRIMARY_QUEUE_IDS = new Set<AdmissionCaseQueue>([
  "NEEDS_INFORMATION",
  "WAITING_FOR_REVIEW",
  "READY_TO_ADMIT",
  "DUPLICATE_WARNINGS",
  "COMPLETED",
]);

const PRIMARY_QUEUE_TAB_LABELS: Partial<Record<AdmissionCaseQueue, string>> = {
  NEEDS_INFORMATION: "Needs info",
  WAITING_FOR_REVIEW: "Review",
  READY_TO_ADMIT: "Ready",
  DUPLICATE_WARNINGS: "Duplicates",
  COMPLETED: "Completed",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  NEEDS_INFORMATION: "Needs Information",
  READY_TO_ADMIT: "Ready to Admit",
  WAITING_FOR_REVIEW: "Waiting for Review",
  WAITLISTED: "Waitlisted",
  APPROVED: "Approved",
  ADMITTED: "Completed",
  NOT_ADMITTED: "Not Admitted",
  CLOSED: "Closed",
};

export function AdmissionCaseQueues() {
  const { hasPermissions } = useSession();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useUrlFilters<{
    queue: AdmissionCaseQueue;
    page: number;
    search: string;
  }>({
    queue: "NEEDS_INFORMATION",
    page: 1,
    search: "",
  });
  const queue = QUEUES.some((item) => item.id === filters.queue)
    ? filters.queue
    : "NEEDS_INFORMATION";
  const page = filters.page;
  const submittedSearch = filters.search;
  const [search, setSearch] = useState(submittedSearch);
  const [promotionCandidate, setPromotionCandidate] =
    useState<AdmissionCaseQueueItem | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const canCreateAdmission = hasPermissions([
    "enrollments:create",
    "students:create",
    "guardians:create",
  ]);
  const canManageAdmissionLifecycle = hasPermissions([
    "students:manage_lifecycle",
  ]);

  useEffect(() => {
    setSearch(submittedSearch);
  }, [submittedSearch]);

  // needs OpenAPI confirmation: the current queue DTO does not accept source,
  // class, or date filters. Keep those out of the URL and request until the
  // backend contract defines their exact semantics.
  const query = useQuery({
    queryKey: ["admission-case-queues", queue, page, submittedSearch],
    queryFn: () =>
      admissionCasesApi.listQueues({
        queue,
        page,
        limit: 25,
        search: submittedSearch,
      }),
  });

  const promoteMutation = useMutation({
    mutationFn: (item: AdmissionCaseQueueItem) =>
      admissionCasesApi.reviewCase(item.id, {
        action: "PROMOTE_FROM_WAITLIST",
      }),
    onSuccess: async (_result, item) => {
      setPromotionCandidate(null);
      setSuccessMessage(
        `${item.fullNameEn} was returned to the admission review workflow.`,
      );
      await queryClient.invalidateQueries({
        queryKey: ["admission-case-queues"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["admission-case", item.id],
      });
    },
  });

  const activeQueue = useMemo(
    () => QUEUES.find((item) => item.id === queue) ?? QUEUES[0],
    [queue],
  );

  if (query.isError) {
    return (
      <ErrorState
        title="Admissions could not load"
        message="No admission details were changed. Retry to load the current school queue."
        onRetry={() => void query.refetch()}
      />
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <WorkspaceTabs
          activeValue={queue}
          onValueChange={(value) =>
            setFilters(
              { queue: value as AdmissionCaseQueue, page: 1 },
              { history: "push" },
            )
          }
          className="min-w-0 flex-1"
          label="Admission queue views"
          items={QUEUES.filter((item) => PRIMARY_QUEUE_IDS.has(item.id)).map(
            (item) => ({
              value: item.id,
              label: PRIMARY_QUEUE_TAB_LABELS[item.id] ?? item.label,
            }),
          )}
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              More queues
              <ChevronDown data-icon="inline-end" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel>More admission queues</DropdownMenuLabel>
              {QUEUES.filter((item) => !PRIMARY_QUEUE_IDS.has(item.id)).map(
                (item) => (
                  <DropdownMenuItem
                    key={item.id}
                    onSelect={() =>
                      setFilters(
                        { queue: item.id, page: 1 },
                        { history: "push" },
                      )
                    }
                  >
                    {item.label}
                  </DropdownMenuItem>
                ),
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <WorkSurface
        title={activeQueue.label}
        description={activeQueue.description}
        action={
          query.data ? (
            <Badge variant="secondary">
              {query.data.total === 1 ? "1 case" : query.data.total + " cases"}
            </Badge>
          ) : undefined
        }
        variant="queue"
        flush
        data-testid="admission-queue-workspace"
      >
        {queue === "WAITLISTED" && successMessage ? (
          <div
            className="flex items-start gap-2 border-b border-success-200 bg-success-50 px-4 py-3 text-sm font-medium text-success-900"
            role="status"
          >
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            {successMessage}
          </div>
        ) : null}

        <form
          className="flex flex-col gap-2 border-b border-border bg-muted/20 p-4 sm:flex-row sm:items-center"
          onSubmit={(event) => {
            event.preventDefault();
            setFilters({ search, page: 1 }, { history: "push" });
          }}
        >
          <label className="sr-only" htmlFor="admission-queue-search">
            Search admissions
          </label>
          <InputGroup className="flex-1">
            <InputGroupAddon>
              <Search aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              id="admission-queue-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search student, guardian, phone, or application ID"
            />
          </InputGroup>
          <Button type="submit" variant="outline" size="sm">
            <Search data-icon="inline-start" />
            Search
          </Button>
        </form>

        {query.isLoading ? (
          <AdmissionQueueSkeleton />
        ) : query.data?.items.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4">Student</TableHead>
                  <TableHead className="px-4">Guardian</TableHead>
                  {queue === "WAITLISTED" ? (
                    <>
                      <TableHead className="px-4">Placement</TableHead>
                      <TableHead className="px-4">Current capacity</TableHead>
                    </>
                  ) : (
                    <>
                      <TableHead className="hidden px-4 md:table-cell">
                        Source
                      </TableHead>
                      <TableHead className="px-4">Status</TableHead>
                      <TableHead className="hidden px-4 lg:table-cell">
                        Warnings
                      </TableHead>
                    </>
                  )}
                  <TableHead className="px-4 text-right">Next action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="px-4 py-3 whitespace-normal">
                      <p className="font-medium text-foreground">
                        {item.fullNameEn}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {queue === "WAITLISTED" ? "Applied" : "Updated"}{" "}
                        {formatBsDate(
                          queue === "WAITLISTED"
                            ? item.createdAt
                            : item.updatedAt,
                        )}
                      </p>
                    </TableCell>
                    <TableCell className="px-4 py-3 whitespace-normal">
                      <p className="font-medium text-foreground">
                        {item.guardianFullName ?? "Not added"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.guardianPhone ?? "No phone"}
                      </p>
                    </TableCell>
                    {queue === "WAITLISTED" ? (
                      <>
                        <TableCell className="px-4 py-3 whitespace-normal">
                          <p className="font-medium text-foreground">
                            {item.className ?? "Class not selected"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.sectionName
                              ? `Section ${item.sectionName}`
                              : "Section not selected"}
                          </p>
                        </TableCell>
                        <TableCell className="px-4 py-3 whitespace-normal">
                          <WaitlistCapacity capacity={item.waitlistCapacity} />
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                          {sourceLabel(item.source)}
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <Badge variant="outline">
                            {statusLabel(item.displayStatus)}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden px-4 py-3 lg:table-cell">
                          {item.hasDuplicateWarning ? (
                            <Badge variant="destructive">
                              <AlertTriangle aria-hidden />
                              Possible duplicate
                            </Badge>
                          ) : item.hasDocumentsPending ? (
                            <Badge variant="secondary">Documents pending</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              None
                            </span>
                          )}
                        </TableCell>
                      </>
                    )}
                    <TableCell className="px-4 py-3 text-right">
                      <div className="flex min-w-max items-center justify-end gap-2">
                        {queue === "WAITLISTED" &&
                        canManageAdmissionLifecycle &&
                        item.canPromoteFromWaitlist ? (
                          <Button
                            type="button"
                            size="sm"
                            disabled={promoteMutation.isPending}
                            onClick={() => {
                              setSuccessMessage("");
                              promoteMutation.reset();
                              setPromotionCandidate(item);
                            }}
                          >
                            {promoteMutation.isPending &&
                            promotionCandidate?.id === item.id ? (
                              <Loader2
                                className="animate-spin"
                                data-icon="inline-start"
                              />
                            ) : (
                              <CheckCircle2 data-icon="inline-start" />
                            )}
                            Return to review
                          </Button>
                        ) : null}
                        {queue === "WAITLISTED" &&
                        item.waitlistCapacity?.enforced &&
                        item.waitlistCapacity.state === "FULL" ? (
                          <span className="text-xs font-medium text-muted-foreground">
                            Waiting for a seat
                          </span>
                        ) : null}
                        {queue === "COMPLETED" && item.admittedStudentId ? (
                          <Button asChild variant="outline" size="sm">
                            <Link
                              href={
                                "/dashboard/students/" + item.admittedStudentId
                              }
                            >
                              View student profile
                            </Link>
                          </Button>
                        ) : (
                          <Button asChild variant="outline" size="sm">
                            <Link
                              href={"/dashboard/admissions/cases/" + item.id}
                            >
                              Open case
                            </Link>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Empty
            className="gap-4 rounded-none border-0 p-8 md:p-10"
            role="status"
          >
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ClipboardCheck aria-hidden />
              </EmptyMedia>
              <EmptyTitle>
                {submittedSearch
                  ? "No admissions match this search"
                  : "No admissions in " + activeQueue.label}
              </EmptyTitle>
              <EmptyDescription>
                {submittedSearch
                  ? "Clear the search or try another student, guardian, phone, or application ID."
                  : "There are no cases in this queue. Choose another queue or start a new admission."}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              {submittedSearch ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSearch("");
                    setFilters({ search: "", page: 1 });
                  }}
                >
                  Clear search
                </Button>
              ) : canCreateAdmission ? (
                <Button asChild>
                  <Link href="/dashboard/admissions/new">New admission</Link>
                </Button>
              ) : queue !== "NEEDS_INFORMATION" ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setFilters(
                      { queue: "NEEDS_INFORMATION", page: 1 },
                      { history: "push" },
                    )
                  }
                >
                  View needs information
                </Button>
              ) : null}
            </EmptyContent>
          </Empty>
        )}

        {query.data && (query.data.total > query.data.limit || page > 1) ? (
          <TablePagination
            page={page}
            pageSize={query.data.limit}
            total={query.data.total}
            onPageChange={(nextPage) => setFilters({ page: nextPage })}
          />
        ) : null}
      </WorkSurface>

      <ConfirmDialog
        isOpen={promotionCandidate !== null}
        title="Return this applicant to review?"
        description="SchoolOS will check the latest section capacity again, then move this case out of the waitlist and back to its appropriate review step. This does not admit the student."
        confirmLabel="Return to review"
        isConfirming={promoteMutation.isPending}
        preventCloseWhileConfirming
        onClose={() => {
          if (!promoteMutation.isPending) {
            setPromotionCandidate(null);
            promoteMutation.reset();
          }
        }}
        onConfirm={() => {
          if (promotionCandidate) promoteMutation.mutate(promotionCandidate);
        }}
      >
        {promotionCandidate ? (
          <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm">
            <p className="font-semibold text-foreground">
              {promotionCandidate.fullNameEn}
            </p>
            <p className="mt-1 text-muted-foreground">
              {placementLabel(promotionCandidate)}
            </p>
          </div>
        ) : null}
        {promoteMutation.isError ? (
          <p className="text-sm font-medium text-destructive" role="alert">
            {promotionError(promoteMutation.error)}
          </p>
        ) : null}
      </ConfirmDialog>
    </section>
  );
}

function AdmissionQueueSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-5" aria-label="Loading admissions">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="grid grid-cols-[2fr_2fr_1fr] gap-4 py-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}

function WaitlistCapacity({
  capacity,
}: {
  capacity: AdmissionWaitlistCapacity | null;
}) {
  if (!capacity || capacity.state === "NOT_CONFIGURED") {
    return (
      <div className="space-y-1">
        <Badge variant="outline">Not configured</Badge>
        <p className="text-xs text-muted-foreground">
          The latest checks run again before review.
        </p>
      </div>
    );
  }

  if (capacity.state === "FULL") {
    return (
      <div className="space-y-1">
        <Badge variant={capacity.enforced ? "destructive" : "outline"}>
          {capacity.enforced ? "Full" : "Full · advisory"}
        </Badge>
        <p className="text-xs text-muted-foreground">
          {capacity.enrolled} of {capacity.capacity} enrolled
        </p>
      </div>
    );
  }

  const seats = capacity.seatsAvailable ?? 0;
  return (
    <div className="space-y-1">
      <Badge
        variant={capacity.state === "NEARLY_FULL" ? "secondary" : "outline"}
      >
        {seats === 1 ? "1 seat available" : `${seats} seats available`}
      </Badge>
      <p className="text-xs text-muted-foreground">
        {capacity.enrolled} of {capacity.capacity} enrolled
        {!capacity.enforced ? " · advisory" : ""}
      </p>
    </div>
  );
}

function placementLabel(item: AdmissionCaseQueueItem) {
  if (!item.className) return "Placement still needs to be selected.";
  return item.sectionName
    ? `${item.className}, Section ${item.sectionName}`
    : `${item.className}, section not selected`;
}

function promotionError(error: unknown) {
  return schoolFacingErrorMessage(error, {
    fallback:
      "The waitlist could not be updated. No admission details were changed. Try again.",
    invalid:
      "The latest admission checks do not allow this case to leave the waitlist yet.",
    forbidden:
      "You do not have permission to move admission cases out of the waitlist.",
    notFound: "This admission case is no longer available.",
    conflict:
      "This admission case changed before the update finished. Refresh and try again.",
  });
}

function sourceLabel(source: string) {
  return source
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusLabel(status: string) {
  return STATUS_LABELS[status] ?? "Status unavailable";
}
