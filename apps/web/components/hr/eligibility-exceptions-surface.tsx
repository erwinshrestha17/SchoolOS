'use client';

import { formatBsDate } from '@schoolos/core';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { Surface } from '@/components/schoolos';
import { api } from '../../lib/api';
import { Badge } from '../ui/badge';

/** Plain-language copy for eligibility reason codes. */
const REASON_COPY: Record<string, string> = {
  EMPLOYMENT_INACTIVE: 'Staff record is not active',
  EMPLOYMENT_UNVERIFIED: 'No current verified employment',
  TEACHER_PROFILE_MISSING: 'No active teacher profile',
  QUALIFICATION_UNVERIFIED: 'No current verified qualification',
  TEACHING_LICENCE_UNVERIFIED: 'Teaching licence missing, expired or revoked',
  TEACHER_POLICY_UNAVAILABLE: 'No approved eligibility policy applies',
  TEACHER_POLICY_CONFLICT: 'Conflicting eligibility policies',
  CLASS_NOT_FOUND: 'Class no longer exists',
  SUBJECT_NOT_FOUND: 'Subject no longer exists',
};

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
                      {REASON_COPY[item.currentReasonCode] ??
                        item.currentReasonCode}
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
