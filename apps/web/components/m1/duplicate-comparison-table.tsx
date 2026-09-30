'use client';

import {
  formatBsDate,
  type StudentDuplicateCandidate,
  type StudentDuplicateCandidateStudent,
} from '@schoolos/core';
import { StatusBadge, type StatusTone } from '@/components/schoolos';

type MatchState = 'Exact' | 'Overlap' | 'Different' | 'Missing';

const MATCH_TONE: Record<MatchState, StatusTone> = {
  Exact: 'approved',
  Overlap: 'pending',
  Different: 'conflict',
  Missing: 'inactive',
};

interface ComparisonRow {
  field: string;
  a: string | null;
  b: string | null;
  match: MatchState;
}

const normalize = (value: string | null | undefined) =>
  value?.trim().toLowerCase().replace(/\s+/g, ' ') || null;

function compare(a: string | null, b: string | null): MatchState {
  const left = normalize(a);
  const right = normalize(b);
  if (!left || !right) return 'Missing';
  return left === right ? 'Exact' : 'Different';
}

/** Guardian phones are shown masked; comparison uses the full values. */
function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return digits.length > 4 ? `••••••${digits.slice(-4)}` : '••••';
}

function comparePhones(a: string[], b: string[]): MatchState {
  if (a.length === 0 || b.length === 0) return 'Missing';
  const right = new Set(b.map((phone) => phone.replace(/\D/g, '')));
  const shared = a.filter((phone) => right.has(phone.replace(/\D/g, '')));
  if (shared.length === 0) return 'Different';
  return shared.length === a.length && a.length === b.length
    ? 'Exact'
    : 'Overlap';
}

const placement = (student: StudentDuplicateCandidateStudent) =>
  [student.className, student.sectionName].filter(Boolean).join(' · ') || null;

function rowsFor(candidate: StudentDuplicateCandidate): ComparisonRow[] {
  const a = candidate.sourceStudent;
  const b = candidate.candidateStudent;
  const dob = (value: string) => (value ? formatBsDate(value) : null);
  return [
    {
      field: 'Name',
      a: a.fullNameEn,
      b: b.fullNameEn,
      match: compare(a.fullNameEn, b.fullNameEn),
    },
    {
      field: 'Date of birth',
      a: dob(a.dateOfBirth),
      b: dob(b.dateOfBirth),
      match: compare(a.dateOfBirth?.slice(0, 10), b.dateOfBirth?.slice(0, 10)),
    },
    {
      field: 'Guardian phone',
      a: a.guardianPhones.map(maskPhone).join(', ') || null,
      b: b.guardianPhones.map(maskPhone).join(', ') || null,
      match: comparePhones(a.guardianPhones, b.guardianPhones),
    },
    {
      field: 'Admission number',
      a: a.admissionNumber,
      b: b.admissionNumber,
      match: compare(a.admissionNumber, b.admissionNumber),
    },
    {
      field: 'Class / section',
      a: placement(a),
      b: placement(b),
      match: compare(placement(a), placement(b)),
    },
    {
      field: 'Previous school',
      a: a.previousSchool,
      b: b.previousSchool,
      match: compare(a.previousSchool, b.previousSchool),
    },
    {
      field: 'Record status',
      a: a.lifecycleStatus,
      b: b.lifecycleStatus,
      match: compare(a.lifecycleStatus, b.lifecycleStatus),
    },
  ];
}

/**
 * Phase 5D: side-by-side comparison for a duplicate pair. Match states are
 * a reading aid only; merge safety comes from the server merge preview and
 * nothing is merged without an explicit, confirmed decision.
 */
export function DuplicateComparisonTable({
  candidate,
}: {
  candidate: StudentDuplicateCandidate;
}) {
  const rows = rowsFor(candidate);
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[520px] text-left text-xs">
        <caption className="sr-only">
          Field-by-field comparison of the two student records
        </caption>
        <thead className="bg-muted/50 text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2">
              Field
            </th>
            <th scope="col" className="px-3 py-2">
              Record A · {candidate.sourceStudent.studentSystemId}
            </th>
            <th scope="col" className="px-3 py-2">
              Record B · {candidate.candidateStudent.studentSystemId}
            </th>
            <th scope="col" className="px-3 py-2">
              Match
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.field}>
              <th scope="row" className="px-3 py-2 font-medium text-foreground">
                {row.field}
              </th>
              <td className="px-3 py-2">{row.a ?? '—'}</td>
              <td className="px-3 py-2">{row.b ?? '—'}</td>
              <td className="px-3 py-2">
                <StatusBadge tone={MATCH_TONE[row.match]}>
                  {row.match}
                </StatusBadge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
