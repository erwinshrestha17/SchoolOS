'use client';

import { StudentProfileDetail, StudentFeeClearance, StudentTransferPayload, StudentArchivePayload, StudentDeletePayload } from '@schoolos/core';
import { SectionCard } from '@/components/ui/section-card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ArrowRightLeft, Archive, Trash2, CheckCircle2, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

type LifecycleAction = 'transfer' | 'archive' | 'alumni' | 'delete';

type LifecyclePanelProps = {
  profile: StudentProfileDetail;
  clearance: StudentFeeClearance | null;
  isCheckingClearance: boolean;
  onCheckClearance: () => void;
  onSelectAction: (action: LifecycleAction) => void;
  action: LifecycleAction | null;
  onCancelAction: () => void;
  isSaving: boolean;
  message: string;
};

const formatMoney = (amount: number) => {
  return new Intl.NumberFormat('en-NP', {
    style: 'currency',
    currency: 'NPR',
    maximumFractionDigits: 0,
  }).format(amount);
};

export function LifecyclePanel({
  profile,
  clearance,
  isCheckingClearance,
  onCheckClearance,
  onSelectAction,
  action,
  onCancelAction,
  isSaving,
  message,
}: LifecyclePanelProps) {
  const status = profile.student.lifecycleStatus ?? 'ACTIVE';
  const active = status === 'ACTIVE';
  const outstanding = clearance?.outstandingAmount ?? 0;
  const hasOutstanding = clearance ? !clearance.cleared : false;

  return (
    <SectionCard title="Lifecycle Management" description="Administrative actions for student status and school transfers.">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
           <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5">
              <p className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500 mb-4">Current Operational Status</p>
              <div className="flex flex-wrap items-center gap-3">
                 <Badge className="bg-slate-900 text-white border-none">{status}</Badge>
                 {clearance ? (
                   <Badge variant={clearance.cleared ? 'success' : 'destructive'}>
                     {clearance.cleared ? 'Fee Cleared' : `Outstanding ${formatMoney(outstanding)}`}
                   </Badge>
                 ) : (
                   <button 
                     onClick={onCheckClearance}
                     className="text-xs font-bold text-primary-600 hover:underline"
                     disabled={isCheckingClearance}
                   >
                     {isCheckingClearance ? 'Checking Clearance...' : 'Check Fee Clearance'}
                   </button>
                 )}
              </div>
           </div>

           <div className="grid grid-cols-2 gap-3">
              <ActionButton 
                label="Transfer" 
                icon={<ArrowRightLeft size={18} />} 
                active={active} 
                onClick={() => onSelectAction('transfer')} 
              />
              <ActionButton 
                label="Archive" 
                icon={<Archive size={18} />} 
                active={active} 
                onClick={() => onSelectAction('archive')} 
              />
              <ActionButton 
                label="Alumni" 
                icon={<CheckCircle2 size={18} />} 
                active={status === 'EXITED' || status === 'TRANSFERRED'} 
                onClick={() => onSelectAction('alumni')} 
              />
              <ActionButton 
                label="Delete" 
                icon={<Trash2 size={18} />} 
                danger 
                active={active} 
                onClick={() => onSelectAction('delete')} 
              />
           </div>
        </div>

        <div className="flex flex-col justify-center">
           {message && (
             <div className="rounded-2xl border border-success-100 bg-success-50 p-6 flex items-center gap-4 text-success-700 animate-in fade-in zoom-in-95">
                <CheckCircle2 size={24} />
                <p className="font-bold text-sm">{message}</p>
             </div>
           )}
           
           {hasOutstanding && (
             <div className="rounded-2xl border border-warning-100 bg-warning-50 p-6 flex items-center gap-4 text-warning-700">
                <AlertTriangle size={24} />
                <div>
                  <p className="font-bold text-sm">Action Blocked</p>
                  <p className="text-xs mt-1">Outstanding fees must be cleared before status changes.</p>
                </div>
             </div>
           )}

           {!message && !hasOutstanding && !action && (
             <div className="text-center p-8 border border-dashed border-slate-200 rounded-[2rem]">
                <ShieldAlert size={32} className="mx-auto text-slate-300 mb-4" />
                <p className="text-sm font-bold text-slate-400">Select an action to continue</p>
             </div>
           )}
        </div>
      </div>
    </SectionCard>
  );
}

function ActionButton({ label, icon, active, onClick, danger }: { label: string; icon: React.ReactNode; active: boolean; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      disabled={!active}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-2xl border p-4 transition-all",
        active 
          ? danger 
            ? "border-danger-100 bg-white text-danger-600 hover:bg-danger-50 shadow-sm" 
            : "border-slate-100 bg-white text-slate-700 hover:border-primary-200 hover:bg-primary-50 shadow-sm"
          : "opacity-40 grayscale cursor-not-allowed border-slate-100 bg-slate-50"
      )}
    >
      {icon}
      <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}
