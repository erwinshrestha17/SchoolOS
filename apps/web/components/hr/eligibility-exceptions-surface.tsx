'use client';

import { formatBsDate, teacherEligibilityReasonLabel } from '@schoolos/core';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { Surface } from '@/components/schoolos';
import { api } from '../../lib/api';
import { Badge } from '../ui/badge';

/**
 * Phase 5M follow-up: active teaching assignments that would fail the
 * professional-eligibility check today. Read-only; nothing is revoked here.
 */
export function EligibilityExceptionsSurface() {
  const report = useQuery({
    queryKey: ['hr-eligibility-exceptions'],
    queryFn: () => api.getEligibilityExceptions(),
  });

  return (
    <Surface
      title="Teaching eligibility exceptions"
      description="Active assignments whose teacher would not pass the professional-eligibility check today, for example after a licence expired or employment ended."
      actions={
        <Link
          href="/dashboard/hr/teacher-eligibility"
          className="text-sm font-semibold text-primary-700 hover:underline"
        >
          Open eligibility workspace
        </Link>
      }
    >
      {report.isLoading ? (
        <p className="text-sm text-slate-500">Checking assignments…</p>
      ) : report.isError || !report.data ? (
        <p className="text-sm text-slate-600">
          Eligibility exceptions could not be loaded. Check your HR permission
          and retry.
        </p>
      ) : report.data.items.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-slate-600">
          <ShieldAlert
            className="h-4 w-4 text-emerald-600"
            aria-hidden="true"
          />
          All {report.data.scanned} active assignments currently pass.
        </p>
      ) : (
        <div className="space-y-3">
          {report.data.truncated && (
            <p className="text-xs text-warning-700">
              Showing results from the first {report.data.scanned} active
              assignments only.
            </p>
          )}
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2">Teacher</th>
                <th>Class / subject</th>
                <th>Why it fails now</th>
                <th>Created under</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.data.items.map((item) => (
                <tr key={item.assignmentId} className="align-top">
                  <td className="py-2">
                    <Link
                      href={`/dashboard/staff/${encodeURIComponent(item.staff.id)}`}
                      className="font-semibold text-slate-900 hover:underline"
                    >
                      {item.staff.name}
                    </Link>
                    <div className="text-xs text-slate-500">
                      {item.staff.employeeId}
                    </div>
                  </td>
                  <td>
                    {item.className} {item.sectionName}
                    {item.subjectName ? ` · ${item.subjectName}` : ''}
                  </td>
                  <td>
                    <Badge variant="destructive">
                      {teacherEligibilityReasonLabel(item.currentReasonCode)}
                    </Badge>
                  </td>
                  <td className="text-xs text-slate-500">
                    {item.createdUnder
                      ? `${item.createdUnder.outcome} on ${formatBsDate(item.createdUnder.evaluatedAt)}`
                      : 'Before eligibility checks (legacy)'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Surface>
  );
}
