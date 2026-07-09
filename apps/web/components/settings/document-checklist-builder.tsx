'use client';

import type { AdmissionPolicyDocumentRequirement } from '@schoolos/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { admissionPoliciesApi } from '../../lib/api/admission-policies';
import { Button } from '../ui/button';

const DOCUMENT_LIBRARY = [
  'Birth certificate',
  'Student passport photo',
  'Parent/guardian citizenship',
  'Previous report card',
  'Transfer certificate',
  'Character certificate',
  'SEE marksheet',
  'Migration certificate',
  'Vaccination card',
  'Medical certificate',
  'Scholarship proof',
  'Residence proof',
  'Recommendation letter',
];

export function toDocumentKind(label: string) {
  return label.trim().replace(/[\s-]+/g, '_').toUpperCase();
}

export function DocumentChecklistBuilder({
  policyId,
  versionId,
  documentRequirements,
}: {
  policyId: string;
  versionId: string;
  documentRequirements: AdmissionPolicyDocumentRequirement[];
}) {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState(DOCUMENT_LIBRARY[0]);
  const [customLabel, setCustomLabel] = useState('');

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['admission-policy', policyId] });

  const addMutation = useMutation({
    mutationFn: (newLabel: string) =>
      admissionPoliciesApi.upsertDocumentRequirement(policyId, versionId, {
        documentKind: toDocumentKind(newLabel),
        label: newLabel,
      }),
    onSuccess: () => {
      setCustomLabel('');
      void invalidate();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (requirement: AdmissionPolicyDocumentRequirement) =>
      admissionPoliciesApi.upsertDocumentRequirement(policyId, versionId, {
        documentKind: requirement.documentKind,
        label: requirement.label,
        isRequired: requirement.isRequired,
        requiresOriginalVerification: requirement.requiresOriginalVerification,
        timing: requirement.timing,
        canBeWaived: requirement.canBeWaived,
      }),
    onSuccess: () => void invalidate(),
  });

  const removeMutation = useMutation({
    mutationFn: (requirementId: string) =>
      admissionPoliciesApi.deleteDocumentRequirement(policyId, versionId, requirementId),
    onSuccess: () => void invalidate(),
  });

  const existingKinds = new Set(documentRequirements.map((requirement) => requirement.documentKind));

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {documentRequirements.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            No documents required yet. Add from the library below or add a custom document.
          </p>
        ) : null}
        {documentRequirements.map((requirement) => (
          <div key={requirement.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-bold text-slate-950">{requirement.label}</p>
              <button
                type="button"
                onClick={() => removeMutation.mutate(requirement.id)}
                disabled={removeMutation.isPending}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-danger-50 hover:text-danger-600"
                aria-label={`Remove ${requirement.label}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={requirement.isRequired}
                  onChange={(event) => updateMutation.mutate({ ...requirement, isRequired: event.target.checked })}
                />
                Required
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={requirement.requiresOriginalVerification}
                  onChange={(event) =>
                    updateMutation.mutate({ ...requirement, requiresOriginalVerification: event.target.checked })
                  }
                />
                Original verification required
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={requirement.canBeWaived}
                  onChange={(event) => updateMutation.mutate({ ...requirement, canBeWaived: event.target.checked })}
                />
                Can be waived
              </label>
            </div>
            <label className="mt-3 block text-sm font-semibold text-slate-700">
              When checked
              <select
                className="mt-1 block w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={requirement.timing}
                onChange={(event) =>
                  updateMutation.mutate({
                    ...requirement,
                    timing: event.target.value as AdmissionPolicyDocumentRequirement['timing'],
                  })
                }
              >
                <option value="BEFORE_REVIEW">Required before review</option>
                <option value="BEFORE_ENROLLMENT">Required before enrollment</option>
              </select>
            </label>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
        <p className="text-sm font-bold text-slate-700">Add document requirement</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          >
            {DOCUMENT_LIBRARY.map((option) => (
              <option key={option} value={option} disabled={existingKinds.has(toDocumentKind(option))}>
                {option}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            onClick={() => addMutation.mutate(label)}
            disabled={addMutation.isPending || existingKinds.has(toDocumentKind(label))}
          >
            {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add from library
          </Button>
          <input
            className="min-w-48 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Custom document name"
            value={customLabel}
            onChange={(event) => setCustomLabel(event.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => addMutation.mutate(customLabel)}
            disabled={addMutation.isPending || !customLabel.trim() || existingKinds.has(toDocumentKind(customLabel))}
          >
            Add custom document
          </Button>
        </div>
      </div>
    </div>
  );
}
