'use client';

import { GraduationCap, Users } from 'lucide-react';
import type { TeacherAssignmentOption } from '@/lib/hooks/use-teacher-assignment-context';
import { cn } from '@/lib/utils';

/**
 * "Working as" selector (assignment-based access-control spec, Assignment
 * Context UX).
 *
 * Every option is one of the teacher's own active assignments resolved by the
 * backend, so there is no "All Teachers" filter and nothing here can be
 * pointed at a colleague's scope. Choosing an option only prefills the
 * workflow; the backend re-validates the class/section/subject on save.
 *
 * The responsibility is always spelled out, because the same teacher acting
 * as Subject Teacher and as Class Teacher has genuinely different rights and
 * needs to know which one they are exercising.
 */
export function AssignmentContextSelector({
  options,
  value,
  onChange,
  label = 'Working as',
  id = 'assignment-context',
  disabled = false,
}: {
  options: TeacherAssignmentOption[];
  value: string | null;
  onChange: (assignmentId: string, option: TeacherAssignmentOption) => void;
  label?: string;
  id?: string;
  disabled?: boolean;
}) {
  if (options.length === 0) return null;

  const selected = options.find((option) => option.assignmentId === value);

  // A single assignment needs no picker -- showing a one-item dropdown just
  // asks the teacher to confirm something the system already knows.
  if (options.length === 1) {
    const only = options[0];
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
        <ResponsibilityIcon option={only} />
        <span className="font-semibold text-slate-500">{label}:</span>
        <span className="font-bold text-slate-900">{only.label}</span>
        {only.isTemporary ? <TemporaryBadge option={only} /> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-slate-600">
        {label}
      </label>
      <select
        id={id}
        value={value ?? ''}
        disabled={disabled}
        onChange={(event) => {
          const next = options.find(
            (option) => option.assignmentId === event.target.value,
          );
          if (next) onChange(next.assignmentId, next);
        }}
        className={cn(
          'h-11 min-w-[16rem] rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900',
          'focus:outline-none focus:ring-2 focus:ring-[var(--primary)]',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        {options.map((option) => (
          <option key={option.assignmentId} value={option.assignmentId}>
            {option.label}
          </option>
        ))}
      </select>
      {selected?.isTemporary ? <TemporaryBadge option={selected} /> : null}
    </div>
  );
}

function ResponsibilityIcon({ option }: { option: TeacherAssignmentOption }) {
  const Icon = option.responsibility === 'CLASS_TEACHER' ? Users : GraduationCap;
  return <Icon className="h-4 w-4 text-slate-500" aria-hidden="true" />;
}

/**
 * A substitution ends on its own. Saying when removes the surprise of a
 * scope disappearing mid-term.
 */
function TemporaryBadge({ option }: { option: TeacherAssignmentOption }) {
  return (
    <span className="inline-flex items-center rounded-full border border-warning-100 bg-warning-50 px-2 py-0.5 text-[0.7rem] font-bold text-warning-700">
      {option.effectiveUntil
        ? `Temporary cover until ${new Date(option.effectiveUntil).toISOString().slice(0, 10)}`
        : 'Temporary cover'}
    </span>
  );
}
