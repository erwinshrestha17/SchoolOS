'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { admissionPoliciesApi } from '../../lib/api/admission-policies';
import { formatSchoolDate } from '../../lib/date-utils';
import { useSession } from '../session-provider';
import { Button } from '../ui/button';
import { ErrorState } from '../ui/error-state';
import { LoadingState } from '../ui/loading-state';
import { SectionCard } from '../ui/section-card';
import { StatusBadge } from '../ui/status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

export function AdmissionPolicyDetail({ policyId }: { policyId: string }) {
  const router = useRouter();
  const { hasPermissions } = useSession();
  const canManage = hasPermissions(['admission_policy:manage']);

  const policyQuery = useQuery({
    queryKey: ['admission-policy', policyId],
    queryFn: () => admissionPoliciesApi.get(policyId),
  });
  const auditQuery = useQuery({
    queryKey: ['admission-policy-audit', policyId],
    queryFn: () => admissionPoliciesApi.listAuditTrail(policyId),
  });
  const versionsQuery = useQuery({
    queryKey: ['admission-policy-versions', policyId],
    queryFn: () => admissionPoliciesApi.listVersions(policyId),
  });
  const duplicateMutation = useMutation({
    mutationFn: () => admissionPoliciesApi.duplicate(policyId, {}),
    onSuccess: (duplicated) => router.push(`/dashboard/settings/admissions/${duplicated.id}/edit`),
  });

  if (policyQuery.isLoading) {
    return <LoadingState label="Loading admission policy…" />;
  }
  if (policyQuery.isError || !policyQuery.data) {
    return (
      <ErrorState
        title="Admission policy could not load"
        message="Retry to view this policy's details."
        onRetry={() => void policyQuery.refetch()}
      />
    );
  }

  const policy = policyQuery.data;
  const version = policy.currentVersion ?? policy.draftVersion ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-950">{policy.name}</h2>
            <StatusBadge status={policy.status} />
            {policy.draftVersion ? <StatusBadge status="DRAFT" label="Draft changes pending" /> : null}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Version {version?.version ?? 1}
            {policy.isDefault ? ' — School default policy' : ''}
          </p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={duplicateMutation.isPending} onClick={() => duplicateMutation.mutate()}>
              Duplicate policy
            </Button>
            <Button type="button" onClick={() => router.push(`/dashboard/settings/admissions/${policyId}/edit`)}>
              Edit policy
            </Button>
          </div>
        ) : null}
      </div>

      {duplicateMutation.isError ? (
        <p className="rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm font-semibold text-danger-800" role="alert">
          This policy could not be duplicated. Please try again.
        </p>
      ) : null}

      <Tabs defaultValue="overview">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="form-fields">Form Fields</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="eligibility">Eligibility</TabsTrigger>
          <TabsTrigger value="assessment">Assessment</TabsTrigger>
          <TabsTrigger value="decisions">Decisions</TabsTrigger>
          <TabsTrigger value="communication">Communication</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <SectionCard title="Policy overview">
            <dl className="grid gap-3 sm:grid-cols-2">
              <Summary label="Applicant type" value={policy.applicantType === 'BOTH' ? 'New admission and transfer' : policy.applicantType === 'TRANSFER' ? 'Transfer only' : 'New admission only'} />
              <Summary label="Grade band" value={policy.gradeBand ?? 'Any'} />
              <Summary label="Required documents" value={String(policy.requiredDocumentCount)} />
              <Summary label="Assessment" value={policy.assessment} />
              <Summary label="Approval level" value={policy.approvalLevel ?? 'Front-desk'} />
              <Summary label="Last updated" value={formatSchoolDate(policy.updatedAt)} />
            </dl>
          </SectionCard>
        </TabsContent>

        <TabsContent value="form-fields">
          <SectionCard title="Required information" description="Additional fields staff must collect for this policy.">
            {version?.requiredFields.length ? (
              <ul className="flex flex-wrap gap-2">
                {version.requiredFields.map((field) => (
                  <li key={field} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700">{field}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No additional fields required beyond the school's standard admission form.</p>
            )}
            <p className="mt-3 text-sm text-slate-600">Section required: {version?.requireSection ? 'Yes' : 'No'}</p>
          </SectionCard>
        </TabsContent>

        <TabsContent value="documents">
          <SectionCard title="Required documents" description="Documents needed before admission is confirmed.">
            {version?.documentRequirements?.length ? (
              <ul className="space-y-2">
                {version.documentRequirements.map((requirement) => (
                  <li key={requirement.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
                    <span className="font-semibold text-slate-800">{requirement.label}</span>
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      {requirement.isRequired ? 'Required' : 'Optional'} · {requirement.timing === 'BEFORE_REVIEW' ? 'Before review' : 'Before enrollment'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No documents required yet.</p>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="eligibility">
          <SectionCard title="Eligibility and capacity" description="How this policy checks class capacity.">
            <dl className="grid gap-3 sm:grid-cols-2">
              <Summary label="Check capacity when configured" value={version?.enforceCapacityWhenAvailable ? 'Yes' : 'No'} />
              <Summary label="Capacity override" value={version?.capacityOverride != null ? String(version.capacityOverride) : "Uses the section's configured capacity"} />
            </dl>
          </SectionCard>
        </TabsContent>

        <TabsContent value="assessment">
          <SectionCard title="Assessment" description="Evaluation this policy requires before admission.">
            <ul className="flex flex-wrap gap-2 text-sm font-semibold text-slate-700">
              <li className="rounded-lg border border-slate-200 bg-white px-3 py-1.5">Document review: {version?.requireDocumentReview ? 'Required' : 'Not required'}</li>
              <li className="rounded-lg border border-slate-200 bg-white px-3 py-1.5">Interview: {version?.requireInterview ? 'Required' : 'Not required'}</li>
              <li className="rounded-lg border border-slate-200 bg-white px-3 py-1.5">Grade 11-12 stream/marks review: {version?.requireStreamOrMarksReview ? 'Required' : 'Not required'}</li>
            </ul>
          </SectionCard>
        </TabsContent>

        <TabsContent value="decisions">
          <SectionCard title="Decision" description="How admissions under this policy are approved.">
            <dl className="grid gap-3 sm:grid-cols-2">
              <Summary label="Admission mode" value={version?.admissionMode === 'DIRECT_ALLOWED' ? 'Direct admission allowed' : 'Review required'} />
              <Summary label="Principal approval" value={version?.requirePrincipalApproval ? 'Required' : 'Not required'} />
              <Summary label="Allow admission with documents pending" value={version?.allowAdmissionWithDocumentsPending ? 'Yes' : 'No'} />
              <Summary label="Approval level" value={version?.approvalLevel ?? 'Front-desk'} />
            </dl>
            {version?.notesForOffice ? <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{version.notesForOffice}</p> : null}
          </SectionCard>
        </TabsContent>

        <TabsContent value="communication">
          <SectionCard title="Communication" description="Parent-facing communication templates for this policy.">
            <p className="text-sm text-slate-500">Coming soon — communication templates are not yet configurable per policy.</p>
          </SectionCard>
        </TabsContent>

        <TabsContent value="history">
          <SectionCard title="Version history">
            {versionsQuery.data?.length ? (
              <ul className="space-y-2">
                {versionsQuery.data.map((historyVersion) => (
                  <li key={historyVersion.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
                    <span className="font-semibold text-slate-800">Version {historyVersion.version}</span>
                    <StatusBadge status={historyVersion.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">{versionsQuery.isLoading ? 'Loading versions…' : 'No versions yet.'}</p>
            )}
          </SectionCard>
          <SectionCard title="Policy audit timeline" className="mt-4">
            {auditQuery.data?.length ? (
              <ul className="space-y-3">
                {auditQuery.data.map((event) => (
                  <li key={event.id} className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-sm font-bold text-slate-900">{event.action.replace(/_/g, ' ')}</p>
                    <p className="mt-0.5 text-xs font-medium text-slate-500">{formatSchoolDate(event.createdAt)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">{auditQuery.isLoading ? 'Loading audit history…' : 'No changes recorded yet.'}</p>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  );
}
