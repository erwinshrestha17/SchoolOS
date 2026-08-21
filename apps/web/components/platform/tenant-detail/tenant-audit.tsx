"use client";

import type { PaginatedResult, PlatformAuditLog } from "@schoolos/core";
import { Download, History, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  PlatformInlineError,
  PlatformSectionSkeleton,
} from "@/app/platform/_components/platform-operator-states";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TablePagination } from "@/components/ui/table-pagination";
import { platformApi } from "@/lib/api/platform";
import { useTenantDetail } from "./tenant-detail-page";

type AuditFilters = {
  action: string;
  resource: string;
  resourceId: string;
  userId: string;
  startDate: string;
  endDate: string;
};

const EMPTY_FILTERS: AuditFilters = {
  action: "",
  resource: "",
  resourceId: "",
  userId: "",
  startDate: "",
  endDate: "",
};

const AUDIT_PAGE_SIZE = 20;

const EMPTY_AUDIT_PAGE: PaginatedResult<PlatformAuditLog> = {
  items: [],
  total: 0,
  page: 1,
  limit: AUDIT_PAGE_SIZE,
  hasNextPage: false,
};

export function TenantAudit() {
  const { tenant } = useTenantDetail();
  const [data, setData] =
    useState<PaginatedResult<PlatformAuditLog>>(EMPTY_AUDIT_PAGE);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<AuditFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<AuditFilters>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await platformApi.listPlatformAuditLogs({
        tenantId: tenant.id,
        page,
        limit: AUDIT_PAGE_SIZE,
        action: appliedFilters.action || undefined,
        resource: appliedFilters.resource || undefined,
        resourceId: appliedFilters.resourceId || undefined,
        userId: appliedFilters.userId || undefined,
        startDate: appliedFilters.startDate || undefined,
        endDate: appliedFilters.endDate || undefined,
      });
      setData(result);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Tenant audit logs could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, page, tenant.id]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  function applyFilters() {
    setPage(1);
    setAppliedFilters(filters);
    setFilterOpen(false);
  }

  const logs = data.items;

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Tenant audit</h2>
          <p className="mt-1 text-sm text-slate-500">
            Operator actions scoped to this tenant, with explicit filters and
            current-page export.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="rounded-2xl font-bold"
            onClick={() => setFilterOpen(true)}
            data-testid="tenant-audit-filter-button"
          >
            <Search className="mr-2" size={17} />
            Filter
          </Button>
          <Button
            variant="outline"
            className="rounded-2xl font-bold"
            disabled={!logs.length}
            onClick={() =>
              exportAuditCsv(logs, `${tenant.slug}-audit-current-page.csv`)
            }
          >
            <Download className="mr-2" size={17} />
            Export current page CSV
          </Button>
        </div>
      </div>

      <Card className="rounded-3xl border-slate-100 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-black">
            <History size={20} />
            Platform audit trail
          </CardTitle>
          <CardDescription>
            Tenant audit history is loaded in pages. Export includes the current
            page and filters.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6">
              <PlatformSectionSkeleton rows={6} />
            </div>
          ) : error ? (
            <div className="p-6">
              <PlatformInlineError
                message={error}
                onRetry={() => void loadLogs()}
              />
            </div>
          ) : logs.length ? (
            <div className="divide-y divide-slate-50 border-t border-slate-100">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div>
                    <p className="font-black text-slate-900">
                      {log.action.replaceAll("_", " ")}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {log.resource} · {log.resourceId || "No resource ID"}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-sm font-bold text-slate-900">
                      {log.user?.email ?? "System"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDateTime(log.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-14 text-center">
              <History className="mx-auto text-slate-200" size={42} />
              <p className="mt-4 text-sm font-semibold text-slate-500">
                No audit logs match the current filters.
              </p>
            </div>
          )}
          {!loading && !error && data.total > 0 ? (
            <TablePagination
              page={data.page}
              pageSize={data.limit}
              total={data.total}
              onPageChange={setPage}
            />
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent className="rounded-3xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Filter tenant audit</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 sm:grid-cols-2">
            <Field
              label="Action"
              value={filters.action}
              onChange={(value) => setFilters({ ...filters, action: value })}
            />
            <Field
              label="Resource"
              value={filters.resource}
              onChange={(value) => setFilters({ ...filters, resource: value })}
            />
            <Field
              label="Resource ID"
              value={filters.resourceId}
              onChange={(value) =>
                setFilters({ ...filters, resourceId: value })
              }
            />
            <Field
              label="User ID"
              value={filters.userId}
              onChange={(value) => setFilters({ ...filters, userId: value })}
            />
            <Field
              label="Start date"
              type="date"
              value={filters.startDate}
              onChange={(value) => setFilters({ ...filters, startDate: value })}
            />
            <Field
              label="End date"
              type="date"
              value={filters.endDate}
              onChange={(value) => setFilters({ ...filters, endDate: value })}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setFilters(EMPTY_FILTERS);
                setAppliedFilters(EMPTY_FILTERS);
                setPage(1);
              }}
            >
              Clear
            </Button>
            <Button onClick={applyFilters}>
              {loading ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Apply filters
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  const id = `audit-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function exportAuditCsv(logs: PlatformAuditLog[], fileName: string) {
  const headers = [
    "createdAt",
    "action",
    "resource",
    "resourceId",
    "tenantId",
    "userId",
  ] as const;
  const rows = logs.map((log) =>
    headers
      .map((key) => `"${String(log[key] ?? "").replaceAll('"', '""')}"`)
      .join(","),
  );
  const url = URL.createObjectURL(
    new Blob([[headers.join(","), ...rows].join("\n")], {
      type: "text/csv;charset=utf-8",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date not recorded"
    : date.toLocaleString();
}
