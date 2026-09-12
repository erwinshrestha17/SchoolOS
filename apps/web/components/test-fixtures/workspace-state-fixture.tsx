'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  Ban,
  Clock3,
  FileWarning,
  Inbox,
  Loader2,
  SearchX,
} from 'lucide-react';
import { DashboardPageShell } from '@/components/dashboard/dashboard-page-shell';
import { WorkspaceTabs } from '@/components/dashboard/module-tabs';
import { QueuedJobState } from '@/components/schoolos/jobs/queued-job-state';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { ModuleHeader } from '@/components/ui/module-header';
import { ModuleLockedState } from '@/components/ui/module-locked-state';
import { PermissionDenied } from '@/components/ui/permission-denied';
import { WorkSurface } from '@/components/ui/work-surface';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FormField, Input } from '@/components/ui/form-field';
import { DataTable } from '@/components/ui/data-table';
import { PaginatedDataTable } from '@/components/schoolos/data/paginated-data-table';
import {
  FileUnavailableState,
  NoResultsState,
  PartialFailureState,
} from '@/components/ui/workspace-states';

const fixtureStates = [
  { value: 'loading', label: 'Loading', icon: Loader2 },
  { value: 'empty', label: 'Empty', icon: Inbox },
  { value: 'no-results', label: 'No results', icon: SearchX },
  { value: 'error', label: 'Error', icon: AlertTriangle },
  { value: 'permission', label: 'Permission', icon: Ban },
  { value: 'locked', label: 'Locked', icon: Ban },
  { value: 'partial', label: 'Partial', icon: AlertTriangle },
  { value: 'queued', label: 'Queued', icon: Clock3 },
  { value: 'file', label: 'File unavailable', icon: FileWarning },
] as const;

type FixtureState = (typeof fixtureStates)[number]['value'];

export function WorkspaceStateFixture() {
  const [state, setState] = useState<FixtureState>('loading');
  const [lastAction, setLastAction] = useState('No fixture action run.');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [reason, setReason] = useState('');
  const [validated, setValidated] = useState(false);

  return (
    <DashboardPageShell>
      <ModuleHeader
        title="Workspace state fixtures"
        description="Authenticated, test-only rendering of SchoolOS shared workspace states. No official totals or tenant settings are changed."
      />
      <WorkspaceTabs
        label="Visual fixture states"
        items={[...fixtureStates]}
        activeValue={state}
        onValueChange={(value) => setState(value as FixtureState)}
      />
      <WorkSurface
        title={fixtureStates.find((item) => item.value === state)?.label ?? 'State'}
        description="Deterministic visual evidence for the shared state contract."
        action={
          <span className="text-xs font-medium text-slate-500">
            {lastAction}
          </span>
        }
      >
        <FixtureStateContent
          state={state}
          onAction={(message) => setLastAction(message)}
        />
      </WorkSurface>
      <WorkSurface title="Shared interaction fixtures" description="Local UI state only; these controls do not submit school records.">
        <div className="space-y-4 p-4">
          <Button onClick={() => { setDialogOpen(true); setValidated(false); }}>Open fixture confirmation</Button>
          <p role="status" aria-label="Fixture result">{lastAction}</p>
          <DataTable
            columns={[{ header: 'Fixture record', accessorKey: 'name' }]}
            data={[{ id: 'alpha', name: 'Fixture Alpha' }]}
            getRowActionLabel={(row) => `Open ${row.name}`}
            onRowClick={() => setLastAction('Alpha opened by row action.')}
          />
          <PaginatedDataTable
            columns={[{ id: 'name', header: 'Fixture record', cell: (row: { id: string; name: string }) => row.name }]}
            items={[{ id: 'beta', name: 'Fixture Beta' }]}
            getRowId={(row) => row.id}
            page={1} pageSize={10} totalItems={1} onPageChange={() => {}}
            getRowActionLabel={(row) => `Open ${row.name}`}
            onRowClick={() => setLastAction('Beta opened by row action.')}
          />
        </div>
      </WorkSurface>
      <ConfirmDialog
        isOpen={dialogOpen}
        title="Confirm fixture action"
        description="Test focus, validation and pending state without changing a school record."
        confirmLabel="Start fixture action"
        isConfirming={pending}
        preventCloseWhileConfirming
        onClose={() => setDialogOpen(false)}
        onConfirm={() => { setValidated(true); if (reason.trim()) setPending(true); }}
      >
        <div className="space-y-4 p-5">
          <FormField label="Fixture reason" description="Enter a reason to test the pending state." error={validated && !reason.trim() ? 'Enter a fixture reason.' : undefined}>
            <Input required value={reason} onChange={(event) => setReason(event.target.value)} />
          </FormField>
          {pending ? <Button onClick={() => { setPending(false); setDialogOpen(false); setLastAction('Fixture action completed.'); }}>Complete fixture action</Button> : null}
        </div>
      </ConfirmDialog>
    </DashboardPageShell>
  );
}

function FixtureStateContent({
  state,
  onAction,
}: {
  state: FixtureState;
  onAction: (message: string) => void;
}) {
  if (state === 'loading') {
    return <LoadingState variant="page" label="Loading fixture workspace..." />;
  }
  if (state === 'empty') {
    return (
      <EmptyState
        title="No records yet"
        description="New records will appear here after the first approved workflow is completed."
      />
    );
  }
  if (state === 'no-results') {
    return (
      <NoResultsState
        description="No records match the controlled fixture filters."
        onReset={() => onAction('Fixture filters reset.')}
      />
    );
  }
  if (state === 'error') {
    return (
      <ErrorState
        title="Fixture workspace unavailable"
        message="Nothing was changed. Retry the controlled fixture request."
        onRetry={() => onAction('Fixture retry requested.')}
      />
    );
  }
  if (state === 'permission') {
    return (
      <PermissionDenied
        title="Permission denied"
        description="This controlled fixture represents a backend-denied workspace boundary."
        resource="Workspace fixture"
        action="Read"
        showNavigation={false}
      />
    );
  }
  if (state === 'locked') {
    return (
      <ModuleLockedState
        moduleName="Fixture module"
        description="This controlled fixture represents a tenant module entitlement that is not enabled."
        featureKey="visual-fixture-only"
      />
    );
  }
  if (state === 'partial') {
    return (
      <PartialFailureState
        description="Two fixture items completed and one needs attention. These are test-only labels, not official school totals."
        items={
          <p className="rounded-lg border border-warning-100 bg-white p-3 text-sm text-slate-700">
            Fixture item C: protected attachment was unavailable.
          </p>
        }
        onRetry={() => onAction('Failed fixture item retry requested.')}
      />
    );
  }
  if (state === 'queued') {
    return (
      <QueuedJobState
        status="QUEUED"
        label="Fixture export job"
        queuedAt="Fixture timestamp"
        onCancel={() => onAction('Fixture queue cancellation requested.')}
      />
    );
  }
  return (
    <FileUnavailableState
      description="The fixture record remains visible while its protected file is unavailable."
      onRetry={() => onAction('Fixture File Registry check requested.')}
    />
  );
}
