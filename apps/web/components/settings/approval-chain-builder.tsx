'use client';

import type { AdmissionApprovalChain, AdmissionApprovalChainStage } from '@schoolos/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { admissionPoliciesApi } from '../../lib/api/admission-policies';
import { usersApi } from '../../lib/api/users';
import { Button } from '../ui/button';

function humanizeRole(role: string) {
  return role
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function ApprovalChainBuilder({
  policyId,
  versionId,
  chain,
}: {
  policyId: string;
  versionId: string;
  chain: AdmissionApprovalChain | null;
}) {
  const queryClient = useQueryClient();
  const [stages, setStages] = useState<AdmissionApprovalChainStage[]>(
    chain?.stages ?? [],
  );

  const rolesQuery = useQuery({
    queryKey: ['role-catalog'],
    queryFn: usersApi.listRoleCatalog,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['admission-policy', policyId] });

  const saveMutation = useMutation({
    mutationFn: (nextStages: AdmissionApprovalChainStage[]) =>
      admissionPoliciesApi.replaceApprovalChain(policyId, versionId, {
        stages: nextStages,
      }),
    onSuccess: () => void invalidate(),
  });

  const deleteMutation = useMutation({
    mutationFn: () => admissionPoliciesApi.deleteApprovalChain(policyId, versionId),
    onSuccess: () => {
      setStages([]);
      void invalidate();
    },
  });

  function addStage() {
    setStages((current) => [...current, { approverRole: null, approverPermission: null }]);
  }

  function removeStage(index: number) {
    setStages((current) => current.filter((_, i) => i !== index));
  }

  function moveStage(index: number, direction: -1 | 1) {
    setStages((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function updateStageRole(index: number, role: string) {
    setStages((current) =>
      current.map((stage, i) => (i === index ? { ...stage, approverRole: role || null } : stage)),
    );
  }

  const hasUnsavedChanges =
    JSON.stringify(stages) !== JSON.stringify(chain?.stages ?? []);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-bold text-slate-700">Approval chain</p>
        <p className="mt-1 text-xs text-slate-500">
          Add ordered stages a case must clear before it is fully approved. Each stage names a
          role — anyone holding that role (or an admin/principal) can decide it. Leave this empty
          to use the simple &quot;Require principal approval&quot; toggle instead.
        </p>
      </div>

      {stages.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          No approval chain configured. Add a stage to require sequential sign-off.
        </p>
      ) : (
        <ol className="space-y-3">
          {stages.map((stage, index) => (
            <li
              key={index}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                {index + 1}
              </span>
              <select
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={stage.approverRole ?? ''}
                onChange={(event) => updateStageRole(index, event.target.value)}
              >
                <option value="">Select a role</option>
                {(rolesQuery.data ?? []).map((role) => (
                  <option key={role.id} value={role.name}>
                    {humanizeRole(role.name)}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveStage(index, -1)}
                  disabled={index === 0}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                  aria-label={`Move stage ${index + 1} up`}
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveStage(index, 1)}
                  disabled={index === stages.length - 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                  aria-label={`Move stage ${index + 1} down`}
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => removeStage(index)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-danger-50 hover:text-danger-600"
                  aria-label={`Remove stage ${index + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={addStage}>
          <Plus className="h-4 w-4" />
          Add stage
        </Button>
        <Button
          type="button"
          onClick={() => saveMutation.mutate(stages)}
          disabled={saveMutation.isPending || stages.length === 0 || !hasUnsavedChanges}
        >
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save chain
        </Button>
        {chain ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Remove chain
          </Button>
        ) : null}
      </div>
      {saveMutation.isError ? (
        <p className="text-sm font-semibold text-danger-700" role="alert">
          The approval chain could not be saved. Please try again.
        </p>
      ) : null}
    </div>
  );
}
