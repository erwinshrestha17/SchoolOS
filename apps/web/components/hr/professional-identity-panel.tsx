'use client';

import { formatBsDate } from '@schoolos/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GraduationCap, ShieldCheck, Briefcase, Plus } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import {
  api,
  type EvidenceKind,
  type ProfessionalEvidenceRecord,
  type StaffEmploymentRecord,
} from '../../lib/api';
import { schoolFacingErrorMessage } from '../../lib/school-facing-error';
import { Badge, type BadgeProps } from '../ui/badge';
import { Button } from '../ui/button';
import { FormField, Input, Select } from '../ui/form-field';
import { ProtectedFileButton } from '../ui/protected-file';
import { FileUploader } from '../ui/file-uploader';
import { useSession } from '../session-provider';

/**
 * Phase 5J–5L: employment, teacher professional profile and evidence.
 *
 * The server decides everything: it refuses self-review and reviewing what
 * you submitted, and eligibility only counts VERIFIED evidence inside its
 * validity window. `hr:manage` here only hides controls a viewer can't use.
 */
const ERROR_COPY = {
  fallback: 'That change could not be saved. Try again.',
  invalid: 'Check the dates and required fields, then try again.',
  forbidden:
    'A different HR reviewer must do this. You cannot review a record you submitted, or your own professional record.',
  conflict:
    'This conflicts with the record’s current state — for example an overlapping verified employment period, or evidence without a document. Refresh and review.',
  notFound: 'This record no longer exists. Refresh the page.',
};

const STATUS_VARIANT: Record<string, BadgeProps['variant']> = {
  PENDING: 'warning',
  VERIFIED: 'success',
  CURRENT: 'success',
  ENDED: 'neutral',
  REJECTED: 'destructive',
  REVOKED: 'destructive',
  EXPIRED: 'destructive',
  NOT_YET_VALID: 'info',
};

const date = (value: string | null) => (value ? formatBsDate(value) : '—');

export function ProfessionalIdentityPanel({ staffId }: { staffId: string }) {
  const queryClient = useQueryClient();
  const { hasPermissions } = useSession();
  const canManage = hasPermissions(['hr:manage']);
  const canUploadDocuments = hasPermissions(['hr:documents:manage']);
  const [error, setError] = useState<string | null>(null);

  const overview = useQuery({
    queryKey: ['staff-professional', staffId],
    queryFn: () => api.getProfessionalIdentity(staffId),
  });
  const documents = useQuery({
    queryKey: ['staff-documents', staffId],
    queryFn: () => api.listStaffDocuments(staffId),
    enabled: canManage,
  });

  const run = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({
        queryKey: ['staff-professional', staffId],
      });
    },
    onError: (e) => setError(schoolFacingErrorMessage(e, ERROR_COPY)),
  });

  if (overview.isLoading) {
    return <Section title="Professional identity">Loading…</Section>;
  }
  if (overview.isError || !overview.data) {
    return (
      <Section title="Professional identity">
        <p className="text-sm text-slate-600">
          {schoolFacingErrorMessage(overview.error, {
            fallback: 'Professional records could not be loaded.',
            forbidden: 'You do not have access to professional records.',
          })}
        </p>
      </Section>
    );
  }

  const data = overview.data;
  const profile = data.teacherProfile;
  const docOptions = Array.isArray(documents.data)
    ? (documents.data as Array<{ fileId?: string; name?: string }>).filter(
        (doc) => doc.fileId,
      )
    : [];

  return (
    <div className="space-y-6">
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}
      <p className="text-xs text-slate-500">
        A Teacher role does not count as employment, a teacher profile or
        evidence. Assignments require verified records under the applicable
        policy.
      </p>

      <Section
        title="Employment / service records"
        icon={<Briefcase size={16} />}
        action={
          canManage && (
            <EmploymentForm
              busy={run.isPending}
              onSubmit={(body) =>
                run.mutate(() => api.createStaffEmployment(staffId, body))
              }
            />
          )
        }
      >
        {data.employments.length === 0 ? (
          <Empty>No employment record. Assignment preflight will fail.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2">Type / post</th>
                <th>School type</th>
                <th>Effective</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.employments.map((row) => (
                <EmploymentRow
                  key={row.id}
                  row={row}
                  current={row.id === data.currentEmploymentId}
                  canManage={canManage}
                  busy={run.isPending}
                  onReview={(decision) =>
                    run.mutate(() =>
                      api.reviewStaffEmployment(staffId, row.id, decision),
                    )
                  }
                  onEnd={(effectiveTo, reason) =>
                    run.mutate(() =>
                      api.endStaffEmployment(staffId, row.id, {
                        effectiveTo,
                        reason,
                      }),
                    )
                  }
                />
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section
        title="Teacher professional profile"
        icon={<GraduationCap size={16} />}
      >
        {profile ? (
          <p className="text-sm">
            <Badge
              variant={profile.status === 'ACTIVE' ? 'success' : 'neutral'}
            >
              {profile.status}
            </Badge>{' '}
            from {date(profile.effectiveFrom)}
            {profile.effectiveTo && ` to ${date(profile.effectiveTo)}`}
          </p>
        ) : canManage ? (
          <InlineDateAction
            label="Create teacher profile"
            busy={run.isPending}
            onSubmit={(effectiveFrom) =>
              run.mutate(() => api.createTeacherProfile(staffId, effectiveFrom))
            }
          />
        ) : (
          <Empty>No teacher profile.</Empty>
        )}
      </Section>

      {profile &&
        (['qualifications', 'licences'] as EvidenceKind[]).map((kind) => (
          <Section
            key={kind}
            title={
              kind === 'qualifications' ? 'Qualifications' : 'Teaching licences'
            }
            icon={<ShieldCheck size={16} />}
            action={
              canManage && (
                <EvidenceForm
                  staffId={staffId}
                  kind={kind}
                  documents={docOptions}
                  canUploadDocuments={canUploadDocuments}
                  busy={run.isPending}
                  onSubmit={(body) =>
                    run.mutate(() =>
                      api.addProfessionalEvidence(staffId, kind, body),
                    )
                  }
                />
              )
            }
          >
            <EvidenceTable
              rows={profile[kind]}
              kind={kind}
              canManage={canManage}
              busy={run.isPending}
              onReview={(id, decision) =>
                run.mutate(() =>
                  api.reviewProfessionalEvidence(staffId, kind, id, decision),
                )
              }
              onRevoke={(id, reason) =>
                run.mutate(() =>
                  api.revokeProfessionalEvidence(staffId, kind, id, reason),
                )
              }
            />
          </Section>
        ))}

      {data.recentAssessments.length > 0 && (
        <Section title="Recent eligibility decisions">
          <ul className="space-y-1 text-sm">
            {data.recentAssessments.map((a) => (
              <li key={a.id} className="flex items-center gap-2">
                <Badge
                  variant={a.outcome === 'ELIGIBLE' ? 'success' : 'destructive'}
                >
                  {a.outcome}
                </Badge>
                <code className="text-xs">{a.reasonCode}</code>
                <span className="text-slate-500">{date(a.evaluatedAt)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base font-bold">
          {icon}
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-slate-500">{children}</p>;
}

function EmploymentRow({
  row,
  current,
  canManage,
  busy,
  onReview,
  onEnd,
}: {
  row: StaffEmploymentRecord;
  current: boolean;
  canManage: boolean;
  busy: boolean;
  onReview: (decision: 'VERIFY' | 'REJECT') => void;
  onEnd: (effectiveTo: string, reason: string) => void;
}) {
  const [ending, setEnding] = useState(false);
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  return (
    <tr className="align-top">
      <td className="py-2">
        {row.employmentType} · {row.postCategoryCode}
        {current && (
          <Badge variant="info" className="ml-2">
            Current
          </Badge>
        )}
      </td>
      <td>{row.schoolTypeCode}</td>
      <td>
        {date(row.effectiveFrom)} –{' '}
        {row.effectiveTo ? date(row.effectiveTo) : 'open'}
        {row.endReason && (
          <div className="text-xs text-slate-500">Ended: {row.endReason}</div>
        )}
      </td>
      <td>
        <Badge variant={STATUS_VARIANT[row.status]}>{row.status}</Badge>
      </td>
      <td className="space-x-2 text-right">
        {canManage && row.status === 'PENDING' && (
          <>
            <Button
              size="sm"
              disabled={busy}
              onClick={() => onReview('VERIFY')}
            >
              Verify
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => onReview('REJECT')}
            >
              Reject
            </Button>
          </>
        )}
        {canManage && row.status === 'VERIFIED' && !ending && (
          <Button size="sm" variant="outline" onClick={() => setEnding(true)}>
            End…
          </Button>
        )}
        {ending && (
          <form
            className="mt-2 flex flex-col items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              onEnd(endDate, reason);
              setEnding(false);
            }}
          >
            <Input
              type="date"
              required
              aria-label="Employment end date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            <Input
              required
              minLength={3}
              placeholder="Reason (required)"
              aria-label="End reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="space-x-2">
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={() => setEnding(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                type="submit"
                disabled={busy}
              >
                End employment
              </Button>
            </div>
          </form>
        )}
      </td>
    </tr>
  );
}

function EvidenceTable({
  rows,
  kind,
  canManage,
  busy,
  onReview,
  onRevoke,
}: {
  rows: ProfessionalEvidenceRecord[];
  kind: EvidenceKind;
  canManage: boolean;
  busy: boolean;
  onReview: (id: string, decision: 'VERIFY' | 'REJECT') => void;
  onRevoke: (id: string, reason: string) => void;
}) {
  const [revoking, setRevoking] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  if (rows.length === 0) return <Empty>No evidence submitted.</Empty>;
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs uppercase text-slate-500">
        <tr>
          <th className="py-2">
            {kind === 'qualifications'
              ? 'Qualification'
              : 'Authority / reference'}
          </th>
          <th>Level / subject</th>
          <th>Valid</th>
          <th>State</th>
          <th className="text-right">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((row) => (
          <tr key={row.id} className="align-top">
            <td className="py-2">
              {kind === 'qualifications'
                ? `${row.qualification}${row.institution ? ` · ${row.institution}` : ''}`
                : `${row.authorityCode} · ${row.externalReference}`}
              {row.revocationReason && (
                <div className="text-xs text-red-700">
                  Revoked: {row.revocationReason}
                </div>
              )}
            </td>
            <td>
              {row.levelCode ?? 'any'} / {row.subjectCode ?? 'any'}
            </td>
            <td>
              {date(row.validFrom)} –{' '}
              {row.validUntil ? date(row.validUntil) : 'open'}
            </td>
            <td>
              <Badge variant={STATUS_VARIANT[row.effectiveState]}>
                {row.effectiveState.replaceAll('_', ' ')}
              </Badge>
            </td>
            <td className="space-x-2 text-right">
              {row.documentId && (
                <ProtectedFileButton
                  fileAssetId={row.documentId}
                  action="preview"
                  size="sm"
                  variant="outline"
                  showStatus={false}
                  ariaLabel="Open evidence document"
                >
                  Document
                </ProtectedFileButton>
              )}
              {canManage && row.status === 'PENDING' && (
                <>
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => onReview(row.id, 'VERIFY')}
                  >
                    Verify
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => onReview(row.id, 'REJECT')}
                  >
                    Reject
                  </Button>
                </>
              )}
              {canManage &&
                row.status === 'VERIFIED' &&
                revoking !== row.id && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRevoking(row.id)}
                  >
                    Revoke…
                  </Button>
                )}
              {revoking === row.id && (
                <form
                  className="mt-2 flex flex-col items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    onRevoke(row.id, reason);
                    setRevoking(null);
                    setReason('');
                  }}
                >
                  <Input
                    required
                    minLength={3}
                    placeholder="Revocation reason"
                    aria-label="Revocation reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    type="submit"
                    disabled={busy}
                  >
                    Revoke
                  </Button>
                </form>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function InlineDateAction({
  label,
  busy,
  onSubmit,
}: {
  label: string;
  busy: boolean;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState('');
  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(value);
      }}
    >
      <FormField label="Effective from" htmlFor="teacher-profile-from">
        <Input
          id="teacher-profile-from"
          type="date"
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </FormField>
      <Button type="submit" disabled={busy}>
        {label}
      </Button>
    </form>
  );
}

function formValues(event: FormEvent<HTMLFormElement>) {
  const out: Record<string, unknown> = {};
  new FormData(event.currentTarget).forEach((value, key) => {
    const text = String(value).trim();
    if (text !== '') out[key] = text;
  });
  return out;
}

function ToggleForm({
  label,
  busy,
  onSubmit,
  children,
}: {
  label: string;
  busy: boolean;
  onSubmit: (body: Record<string, unknown>) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus size={14} className="mr-1" />
        {label}
      </Button>
    );
  }
  return (
    <form
      className="grid w-full gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(formValues(e));
        setOpen(false);
      }}
    >
      {children}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={busy}>
          Submit for review
        </Button>
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  type = 'text',
  required,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  const id = `pi-${name}`;
  return (
    <FormField label={label} htmlFor={id}>
      <Input id={id} name={name} type={type} required={required} />
    </FormField>
  );
}

function EmploymentForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  return (
    <ToggleForm label="Add employment" busy={busy} onSubmit={onSubmit}>
      <FormField label="Employment type" htmlFor="pi-employmentType">
        <Select
          id="pi-employmentType"
          name="employmentType"
          required
          defaultValue="PERMANENT"
        >
          {['PERMANENT', 'TEMPORARY', 'PART_TIME', 'CONTRACT', 'INTERN'].map(
            (t) => (
              <option key={t} value={t}>
                {t.replace('_', ' ')}
              </option>
            ),
          )}
        </Select>
      </FormField>
      <Field name="postCategoryCode" label="Post category code" required />
      <Field name="schoolTypeCode" label="School type code" required />
      <Field name="effectiveFrom" label="Effective from" type="date" required />
      <Field name="effectiveTo" label="Effective to (optional)" type="date" />
    </ToggleForm>
  );
}

function EvidenceForm({
  staffId,
  kind,
  documents,
  canUploadDocuments,
  busy,
  onSubmit,
}: {
  staffId: string;
  kind: EvidenceKind;
  documents: Array<{ fileId?: string; name?: string }>;
  canUploadDocuments: boolean;
  busy: boolean;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const queryClient = useQueryClient();
  const [documentId, setDocumentId] = useState('');
  const [uploaded, setUploaded] = useState<
    Array<{ fileId: string; name: string }>
  >([]);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Phase 5L: an uploaded evidence file is first registered as a protected
  // staff document (same storage, permission and audit as the Documents
  // tab), then attached to this evidence. Evidence still starts PENDING.
  const registerDocument = useMutation({
    mutationFn: (file: { fileId: string; fileName: string }) =>
      api.addStaffDocument(staffId, {
        kind: kind === 'qualifications' ? 'ACADEMIC_CERTIFICATE' : 'OTHER',
        fileId: file.fileId,
        name:
          (kind === 'qualifications'
            ? 'Qualification evidence: '
            : 'Teaching licence evidence: ') +
          file.fileName.replace(/\.[^/.]+$/, ''),
      }),
    onSuccess: (_result, file) => {
      setUploadError(null);
      const name = file.fileName.replace(/\.[^/.]+$/, '');
      setUploaded((current) => [...current, { fileId: file.fileId, name }]);
      setDocumentId(file.fileId);
      void queryClient.invalidateQueries({
        queryKey: ['staff-documents', staffId],
      });
    },
    onError: (error) =>
      setUploadError(
        schoolFacingErrorMessage(error, {
          fallback: 'The document could not be attached. Try again.',
          forbidden: 'You do not have permission to add staff documents.',
        }),
      ),
  });

  const options = [
    ...uploaded,
    ...documents
      .filter(
        (doc): doc is { fileId: string; name?: string } =>
          Boolean(doc.fileId) &&
          !uploaded.some((item) => item.fileId === doc.fileId),
      )
      .map((doc) => ({ fileId: doc.fileId, name: doc.name ?? doc.fileId })),
  ];

  return (
    <ToggleForm
      label={kind === 'qualifications' ? 'Add qualification' : 'Add licence'}
      busy={busy || registerDocument.isPending}
      onSubmit={(body) => {
        onSubmit(body);
        setDocumentId('');
      }}
    >
      {kind === 'qualifications' ? (
        <>
          <Field name="qualification" label="Qualification" required />
          <Field name="institution" label="Institution" />
        </>
      ) : (
        <>
          <Field
            name="authorityCode"
            label="Issuing authority (e.g. TSC)"
            required
          />
          <Field
            name="externalReference"
            label="Licence number / reference"
            required
          />
        </>
      )}
      <Field name="levelCode" label="Level code (blank = any)" />
      <Field name="subjectCode" label="Subject code (blank = any)" />
      <Field name="validFrom" label="Valid from" type="date" required />
      <Field name="validUntil" label="Valid until" type="date" />
      <FormField label="Evidence document" htmlFor={`pi-documentId-${kind}`}>
        <Select
          id={`pi-documentId-${kind}`}
          name="documentId"
          value={documentId}
          onChange={(event) => setDocumentId(event.target.value)}
        >
          <option value="">None (use source reference)</option>
          {options.map((doc) => (
            <option key={doc.fileId} value={doc.fileId}>
              {doc.name}
            </option>
          ))}
        </Select>
      </FormField>
      {canUploadDocuments ? (
        <FormField label="Or upload the document now">
          <FileUploader
            module="staff_documents"
            maxFiles={1}
            accept=".pdf,.png,.jpg,.jpeg"
            onUploadComplete={(fileId, fileName) =>
              registerDocument.mutate({ fileId, fileName })
            }
            onRemove={(fileId) => {
              if (documentId === fileId) setDocumentId('');
            }}
          />
          {registerDocument.isPending ? (
            <p className="mt-1 text-xs text-slate-500">Attaching document…</p>
          ) : null}
          {uploadError ? (
            <p role="alert" className="mt-1 text-xs text-red-700">
              {uploadError}
            </p>
          ) : null}
        </FormField>
      ) : null}
      <Field name="sourceUri" label="Source reference (https)" type="url" />
      <p className="text-xs text-slate-500 sm:col-span-2">
        Submitted evidence stays PENDING until a different HR reviewer verifies
        it. Verification needs a document or source reference.
      </p>
    </ToggleForm>
  );
}
