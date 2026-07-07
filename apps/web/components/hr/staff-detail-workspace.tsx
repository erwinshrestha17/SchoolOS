'use client';

import { formatBsDate, formatNepalTime, type PayrollMoneyAmount } from '@schoolos/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Save, 
  User, 
  Briefcase, 
  CalendarDays, 
  History, 
  Calculator, 
  Landmark,
  ClipboardCheck,
  ShieldCheck,
  Phone,
  UserCheck,
  Edit2,
  FileText,
  Sliders,
  AlertTriangle,
  Receipt
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { api, type StaffLifecycleHistoryEvent } from '../../lib/api';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { Toast } from '../ui/toast';
import { FormField, Input, TextArea } from '../ui/form-field';
import { useSession } from '../session-provider';

// Dialog Modals
import { StaffLifecycleDialog } from './staff-lifecycle-dialog';
import { StaffDocumentsPanel } from './staff-documents-panel';
import { StaffAttendanceCorrectionDialog } from './staff-attendance-correction-dialog';
import { LeaveRequestCreateDialog } from './leave-request-create-dialog';
import { LeaveReviewDialog } from './leave-review-dialog';
import { LeaveBalanceAdjustDialog } from './leave-balance-adjust-dialog';
import { SalaryStructureDialog } from './salary-structure-dialog';

// The backend nulls out salary/payroll figures (with a `masked: true` flag)
// for viewers without sensitive-HR access — never call .toLocaleString() on
// those directly, or it throws for exactly the accounts most likely to open
// this tab without full payroll permission.
function formatMaskableNpr(value: PayrollMoneyAmount | null | undefined) {
  if (value === null || value === undefined) return 'Restricted';
  return `NPR ${Number(value).toLocaleString()}`;
}

export function StaffDetailWorkspace({ staffId }: { staffId: string }) {
  const queryClient = useQueryClient();
  const { hasPermissions } = useSession();
  // Mirrors the backend's canSeeSensitiveStaffData gate (apps/api staff.service.ts).
  // Viewers without this access receive partially-masked PAN/bank values and
  // fully-nulled salary figures — those must never be treated as editable or
  // round-tripped back to the server.
  const canSeeSensitiveHrData =
    hasPermissions(['hr:manage']) ||
    hasPermissions(['payroll:manage']) ||
    hasPermissions(['payroll:salary:read']);
  const staffQuery = useQuery({
    queryKey: ['staff-detail', staffId],
    queryFn: () => api.getStaffDetail(staffId),
  });
  const historyQuery = useQuery({
    queryKey: ['staff-history', staffId],
    queryFn: () => api.listStaffHistory(staffId),
  });
  
  const staff = staffQuery.data;

  // Form states
  const [draft, setDraft] = useState({
    firstName: '',
    lastName: '',
    email: '',
    address: '',
    department: '',
    designation: '',
    bankName: '',
    bankAccount: '',
    emergencyName: '',
    emergencyPhone: '',
    emergencyRelation: '',
    qualifications: '',
    experience: '',
    teacherRegistryId: '',
    citizenshipNo: '',
    panNumber: '',
  });

  const [toastMsg, setToastMsg] = useState<{ title: string; desc: string; tone: 'success' | 'danger' } | null>(null);

  // Dialog triggers
  const [isLifecycleOpen, setIsLifecycleOpen] = useState(false);
  const [isRequestLeaveOpen, setIsRequestLeaveOpen] = useState(false);
  const [isAdjustBalanceOpen, setIsAdjustBalanceOpen] = useState(false);
  const [isSalaryStructureOpen, setIsSalaryStructureOpen] = useState(false);
  
  // Selected items for correction/review/edit
  const [selectedAttendanceRecord, setSelectedAttendanceRecord] = useState<any | null>(null);
  const [selectedLeaveRequest, setSelectedLeaveRequest] = useState<any | null>(null);
  const [selectedSalaryStructure, setSelectedSalaryStructure] = useState<any | null>(null);

  useEffect(() => {
    if (staff) {
      setDraft({
        firstName: staff.firstName ?? '',
        lastName: staff.lastName ?? '',
        email: staff.email ?? '',
        address: staff.personal?.address ?? staff.address ?? '',
        department: staff.employment?.department ?? staff.department ?? '',
        designation: staff.employment?.designation ?? staff.designation ?? '',
        bankName: staff.bankName ?? '',
        bankAccount: staff.bankAccount ?? '',
        emergencyName: staff.personal?.emergencyContact?.name ?? '',
        emergencyPhone: staff.personal?.emergencyContact?.phone ?? '',
        emergencyRelation: staff.personal?.emergencyContact?.relation ?? '',
        qualifications: (staff as any).qualifications ?? '',
        experience: (staff as any).experience ?? '',
        teacherRegistryId: (staff as any).employment?.teacherRegistryId ?? (staff as any).teacherRegistryId ?? '',
        citizenshipNo: (staff as any).citizenshipNo ?? '',
        panNumber: (staff as any).panNumber ?? '',
      });
    }
  }, [staff]);

  const updateMutation = useMutation({
    mutationFn: () => {
      const optionalTrim = (value: string) => {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
      };

      return api.updateStaffDetail(staffId, {
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        email: draft.email.trim(),
        address: draft.address.trim(),
        department: optionalTrim(draft.department),
        designation: optionalTrim(draft.designation),
        emergencyContactName: optionalTrim(draft.emergencyName),
        emergencyContactPhone: optionalTrim(draft.emergencyPhone),
        emergencyContactRelation: optionalTrim(draft.emergencyRelation),
        qualifications: optionalTrim(draft.qualifications),
        experience: optionalTrim(draft.experience),
        teacherRegistryId: optionalTrim(draft.teacherRegistryId),
        // The backend partially masks these three fields for viewers without
        // sensitive-HR access (e.g. "12****89"). Never send them back unless
        // this viewer received the real value — otherwise saving any other
        // field on this form would silently overwrite the real PAN/bank
        // details with the masked placeholder string.
        ...(canSeeSensitiveHrData
          ? {
              bankName: optionalTrim(draft.bankName),
              bankAccount: optionalTrim(draft.bankAccount),
              citizenshipNo: optionalTrim(draft.citizenshipNo),
              panNumber: optionalTrim(draft.panNumber),
            }
          : {}),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['staff-detail', staffId] });
      void queryClient.invalidateQueries({ queryKey: ['staff'] });
      setToastMsg({
        title: 'Profile Updated',
        desc: 'Staff member information has been updated successfully.',
        tone: 'success',
      });
    },
    onError: (err: any) => {
      setToastMsg({
        title: 'Update Failed',
        desc: err.message || 'Failed to update staff member details.',
        tone: 'danger',
      });
    },
  });

  const activateStructureMutation = useMutation({
    mutationFn: (id: string) => api.activateSalaryStructure(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['staff-detail', staffId] });
      void queryClient.invalidateQueries({ queryKey: ['payroll-preview'] });
      setToastMsg({
        title: 'Salary Structure Activated',
        desc: 'The selected salary structure is now active.',
        tone: 'success',
      });
    },
  });

  const archiveStructureMutation = useMutation({
    mutationFn: (id: string) => api.archiveSalaryStructure(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['staff-detail', staffId] });
      setToastMsg({
        title: 'Salary Structure Archived',
        desc: 'The salary structure has been archived.',
        tone: 'success',
      });
    },
  });

  const handleSaveProfile = () => {
    const requiredText = [draft.firstName, draft.lastName, draft.email, draft.address];
    if (requiredText.some((value) => value.trim().length === 0)) {
      setToastMsg({
        title: 'Validation Error',
        desc: 'Please fill out first name, last name, email, and residential address before saving.',
        tone: 'danger',
      });
      return;
    }

    updateMutation.mutate();
  };

  if (staffQuery.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--color-mod-hr-soft)] border-t-[var(--color-mod-hr-accent)]" />
        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest animate-pulse">
          Hydrating Staff Profile...
        </p>
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="bg-rose-50 border border-rose-100 p-8 rounded-2xl text-center">
        <p className="text-rose-600 font-bold">Staff member not found or access denied.</p>
      </div>
    );
  }

  const activeSalaryStructure = staff.salaryStructures?.find((ss) => ss.status === 'ACTIVE');

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {toastMsg && (
        <Toast
          title={toastMsg.title}
          description={toastMsg.desc}
          tone={toastMsg.tone}
          onDismiss={() => setToastMsg(null)}
          className="fixed bottom-6 right-6 z-50 shadow-lg"
        />
      )}

      {/* Header Profile Card */}
      <section className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="relative flex flex-col md:flex-row gap-8 items-start md:items-center">
          <div className="h-24 w-24 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200 shadow-inner">
            <User size={48} />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-3xl font-black text-slate-900">
                {staff.firstName} {staff.lastName}
              </h2>
              <Badge className={cn(
                "font-black uppercase tracking-widest text-[10px] px-3 py-1",
                staff.status === 'ACTIVE' || !staff.status
                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/10"
                  : staff.status === 'TERMINATED'
                  ? "bg-rose-500/10 text-rose-600 border-rose-500/10"
                  : "bg-slate-100 text-slate-500"
              )}>
                {staff.status ?? 'ACTIVE'}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-6 text-sm text-slate-500 font-medium">
              <span className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-[var(--color-mod-hr-text)]" />
                {staff.employeeId}
              </span>
              <span className="flex items-center gap-2">
                <Briefcase size={16} className="text-slate-400" />
                {staff.employment?.designation ?? staff.designation ?? 'No designation'}
              </span>
              <span className="flex items-center gap-2">
                <Landmark size={16} className="text-slate-400" />
                {staff.employment?.department ?? staff.department ?? 'No department'}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setIsLifecycleOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-all text-sm"
            >
              <UserCheck size={18} />
              Status Lifecycle
            </button>
            <button
              type="button"
              onClick={handleSaveProfile}
              disabled={updateMutation.isPending || staff.status === 'TERMINATED'}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[var(--color-mod-hr-accent)] text-white font-bold hover:bg-[var(--color-mod-hr-text)] transition-all shadow-sm disabled:opacity-50 text-sm"
            >
              <Save size={18} />
              {updateMutation.isPending ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </div>
      </section>

      {staff.status === 'TERMINATED' && (
        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex gap-3 text-xs text-rose-800 leading-relaxed items-center">
          <AlertTriangle className="text-rose-600 shrink-0" size={18} />
          <div>
            <strong>Termination Notice:</strong> This profile is locked. Terminated profiles cannot be edited or modified without shifting the user lifecycle status back to ACTIVE.
          </div>
        </div>
      )}

      <Tabs defaultValue="overview" className="space-y-8">
        <TabsList className="bg-white/80 border border-slate-200 p-1.5 rounded-2xl flex-wrap h-auto">
          <TabsTrigger value="overview" className="gap-2">
            <User size={14} />
            Overview
          </TabsTrigger>
          <TabsTrigger value="employment" className="gap-2">
            <Briefcase size={14} />
            Employment
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2">
            <FileText size={14} />
            Documents
          </TabsTrigger>
          <TabsTrigger value="attendance" className="gap-2">
            <ClipboardCheck size={14} />
            Attendance
          </TabsTrigger>
          <TabsTrigger value="leave" className="gap-2">
            <CalendarDays size={14} />
            Leaves
          </TabsTrigger>
          <TabsTrigger value="payroll" className="gap-2">
            <Calculator size={14} />
            Payroll & salary
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History size={14} />
            Audit Log
          </TabsTrigger>
        </TabsList>

        <div className="grid lg:grid-cols-[1fr_360px] gap-8 items-start">
          <div className="space-y-8">
            {/* Tab: Overview */}
            <TabsContent value="overview" className="m-0 outline-none">
              <section className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm space-y-8">
                <h3 className="text-xl font-bold flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-[var(--color-mod-hr-soft)] text-[var(--color-mod-hr-text)] flex items-center justify-center">
                    <User size={18} />
                  </div>
                  Personal Details
                </h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <FormField label="First Name">
                    <Input 
                      value={draft.firstName} 
                      onChange={(e: any) => setDraft(c => ({ ...c, firstName: e.target.value }))}
                      disabled={staff.status === 'TERMINATED'}
                    />
                  </FormField>
                  <FormField label="Last Name">
                    <Input 
                      value={draft.lastName} 
                      onChange={(e: any) => setDraft(c => ({ ...c, lastName: e.target.value }))}
                      disabled={staff.status === 'TERMINATED'}
                    />
                  </FormField>
                  <FormField label="Email Address">
                    <Input 
                      type="email" 
                      value={draft.email} 
                      disabled={staff.status === 'TERMINATED'}
                      onChange={(e: any) => setDraft(c => ({ ...c, email: e.target.value }))}
                    />
                  </FormField>
                  <FormField label="Residential Address">
                    <Input 
                      value={draft.address} 
                      disabled={staff.status === 'TERMINATED'}
                      onChange={(e: any) => setDraft(c => ({ ...c, address: e.target.value }))}
                    />
                  </FormField>
                  <FormField label="Academic Qualifications">
                    <TextArea 
                      value={draft.qualifications} 
                      disabled={staff.status === 'TERMINATED'}
                      onChange={(e: any) => setDraft(c => ({ ...c, qualifications: e.target.value }))}
                    />
                  </FormField>
                  <FormField label="Prior Experience">
                    <TextArea 
                      value={draft.experience} 
                      disabled={staff.status === 'TERMINATED'}
                      onChange={(e: any) => setDraft(c => ({ ...c, experience: e.target.value }))}
                    />
                  </FormField>
                </div>

                <h3 className="text-lg font-bold flex items-center gap-3 pt-6 border-t">
                  <div className="h-8 w-8 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center">
                    <Phone size={18} />
                  </div>
                  Emergency Contact
                </h3>
                <div className="grid md:grid-cols-3 gap-6">
                  <FormField label="Contact Name">
                    <Input 
                      value={draft.emergencyName} 
                      disabled={staff.status === 'TERMINATED'}
                      onChange={(e: any) => setDraft(c => ({ ...c, emergencyName: e.target.value }))}
                      placeholder="Contact full name"
                    />
                  </FormField>
                  <FormField label="Contact Phone">
                    <Input 
                      value={draft.emergencyPhone} 
                      disabled={staff.status === 'TERMINATED'}
                      onChange={(e: any) => setDraft(c => ({ ...c, emergencyPhone: e.target.value }))}
                      placeholder="Emergency contact phone"
                    />
                  </FormField>
                  <FormField label="Relation">
                    <Input 
                      value={draft.emergencyRelation} 
                      disabled={staff.status === 'TERMINATED'}
                      onChange={(e: any) => setDraft(c => ({ ...c, emergencyRelation: e.target.value }))}
                      placeholder="e.g. Spouse, Father, Friend"
                    />
                  </FormField>
                </div>
              </section>
            </TabsContent>

            {/* Tab: Employment */}
            <TabsContent value="employment" className="m-0 outline-none">
              <section className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm space-y-8">
                <h3 className="text-xl font-bold flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-500 flex items-center justify-center">
                    <Briefcase size={18} />
                  </div>
                  Employment Details
                </h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <FormField label="Department">
                    <Input 
                      value={draft.department} 
                      disabled={staff.status === 'TERMINATED'}
                      onChange={(e: any) => setDraft(c => ({ ...c, department: e.target.value }))}
                    />
                  </FormField>
                  <FormField label="Designation">
                    <Input 
                      value={draft.designation} 
                      disabled={staff.status === 'TERMINATED'}
                      onChange={(e: any) => setDraft(c => ({ ...c, designation: e.target.value }))}
                    />
                  </FormField>
                  <FormField label="Teacher Registry ID">
                    <Input 
                      value={draft.teacherRegistryId} 
                      disabled={staff.status === 'TERMINATED'}
                      onChange={(e: any) => setDraft(c => ({ ...c, teacherRegistryId: e.target.value }))}
                      placeholder="TRN registry ID"
                    />
                  </FormField>
                  <FormField label="Citizenship / National ID">
                    <Input
                      value={draft.citizenshipNo}
                      disabled={staff.status === 'TERMINATED' || !canSeeSensitiveHrData}
                      onChange={(e: any) => setDraft(c => ({ ...c, citizenshipNo: e.target.value }))}
                    />
                    {!canSeeSensitiveHrData && (
                      <p className="mt-1.5 text-[11px] font-semibold text-slate-400">
                        Masked. Requires HR or payroll sensitive-data access to view or edit.
                      </p>
                    )}
                  </FormField>
                  <FormField label="PAN Number">
                    <Input
                      value={draft.panNumber}
                      disabled={staff.status === 'TERMINATED' || !canSeeSensitiveHrData}
                      onChange={(e: any) => setDraft(c => ({ ...c, panNumber: e.target.value }))}
                    />
                    {!canSeeSensitiveHrData && (
                      <p className="mt-1.5 text-[11px] font-semibold text-slate-400">
                        Masked. Requires HR or payroll sensitive-data access to view or edit.
                      </p>
                    )}
                  </FormField>
                </div>

                <h3 className="text-lg font-bold flex items-center gap-3 pt-6 border-t">
                  <div className="h-8 w-8 rounded-lg bg-slate-50 text-slate-500 flex items-center justify-center">
                    <Landmark size={18} />
                  </div>
                  Disbursement Bank Details
                </h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <FormField label="Bank Name">
                    <Input
                      value={draft.bankName}
                      disabled={staff.status === 'TERMINATED' || !canSeeSensitiveHrData}
                      onChange={(e: any) => setDraft(c => ({ ...c, bankName: e.target.value }))}
                    />
                    {!canSeeSensitiveHrData && (
                      <p className="mt-1.5 text-[11px] font-semibold text-slate-400">
                        Requires HR or payroll sensitive-data access to edit.
                      </p>
                    )}
                  </FormField>
                  <FormField label="Account Number">
                    <Input
                      value={draft.bankAccount}
                      disabled={staff.status === 'TERMINATED' || !canSeeSensitiveHrData}
                      onChange={(e: any) => setDraft(c => ({ ...c, bankAccount: e.target.value }))}
                    />
                    {!canSeeSensitiveHrData && (
                      <p className="mt-1.5 text-[11px] font-semibold text-slate-400">
                        Masked. Requires HR or payroll sensitive-data access to view or edit.
                      </p>
                    )}
                  </FormField>
                </div>
              </section>
            </TabsContent>

            {/* Tab: Documents */}
            <TabsContent value="documents" className="m-0 outline-none">
              <StaffDocumentsPanel staffId={staffId} />
            </TabsContent>

            {/* Tab: Attendance */}
            <TabsContent value="attendance" className="m-0 outline-none">
              <section className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm space-y-6">
                <h3 className="text-xl font-bold flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-slate-50 text-slate-500 flex items-center justify-center">
                    <ClipboardCheck size={18} />
                  </div>
                  Attendance Log
                </h3>
                <div className="rounded-2xl border border-slate-100 overflow-hidden">
                  {staff.attendanceRecords && staff.attendanceRecords.length > 0 ? (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/50 border-b border-slate-100">
                        <tr>
                          <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-wider">Date</th>
                          <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-wider">Status</th>
                          <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-wider">Check In</th>
                          <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-wider">Remarks</th>
                          <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-wider text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {(staff.attendanceRecords as any[]).slice(0, 15).map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                            <td className="px-5 py-3.5 font-bold text-slate-900">
                              {formatBsDate(item.attendanceDate)}
                            </td>
                            <td className="px-5 py-3.5">
                              <Badge variant="outline" className={cn(
                                "font-bold text-[9px] uppercase tracking-widest",
                                item.status === 'PRESENT' ? 'text-emerald-600 bg-emerald-50 border-emerald-100' :
                                item.status === 'ABSENT' ? 'text-rose-600 bg-rose-50 border-rose-100' :
                                'text-amber-600 bg-amber-50 border-amber-100'
                              )}>
                                {item.status}
                              </Badge>
                            </td>
                            <td className="px-5 py-3.5 text-slate-600 font-medium">
                              {item.checkIn ? formatNepalTime(item.checkIn) : '-'}
                            </td>
                            <td className="px-5 py-3.5 text-slate-500 max-w-xs truncate">
                              {item.note || '-'}
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <button
                                type="button"
                                disabled={staff.status === 'TERMINATED'}
                                onClick={() => setSelectedAttendanceRecord(item)}
                                className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[var(--color-mod-hr-text)] border border-[var(--color-mod-hr-border)] rounded-lg hover:bg-[var(--color-mod-hr-soft)] transition-colors"
                              >
                                Correct
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="py-12 text-center text-slate-400 italic">
                      No attendance logged for this staff member.
                    </div>
                  )}
                </div>
              </section>
            </TabsContent>

            {/* Tab: Leave */}
            <TabsContent value="leave" className="m-0 outline-none space-y-8">
              {/* Leave Balances */}
              <section className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-xl font-bold flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center">
                      <Sliders size={18} />
                    </div>
                    Leave Balances
                  </h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={staff.status === 'TERMINATED'}
                      onClick={() => setIsAdjustBalanceOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 text-slate-700 font-bold text-xs transition-colors"
                    >
                      Adjust Balance
                    </button>
                    <button
                      type="button"
                      disabled={staff.status === 'TERMINATED'}
                      onClick={() => setIsRequestLeaveOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-mod-hr-accent)] hover:bg-[var(--color-mod-hr-text)] text-white font-bold text-xs transition-colors"
                    >
                      Request Leave
                    </button>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-100 overflow-hidden">
                  {staff.leaveBalances && staff.leaveBalances.length > 0 ? (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50/50 border-b border-slate-100">
                        <tr>
                          <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-wider">Leave Type</th>
                          <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-wider text-center">Entitlement</th>
                          <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-wider text-center">Used</th>
                          <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-wider text-center">Pending</th>
                          <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-wider text-center text-[var(--color-mod-hr-text)]">Remaining</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {(staff.leaveBalances as any[]).map((balance) => (
                          <tr key={balance.id} className="hover:bg-slate-50/30 transition-colors">
                            <td className="px-5 py-3.5 font-bold text-slate-900">{balance.leaveType.replace('_', ' ')}</td>
                            <td className="px-5 py-3.5 text-center text-slate-600 font-medium">{balance.entitlement + balance.carriedForward}</td>
                            <td className="px-5 py-3.5 text-center text-rose-600 font-bold">{balance.used}</td>
                            <td className="px-5 py-3.5 text-center text-amber-500 font-bold">{balance.pending}</td>
                            <td className="px-5 py-3.5 text-center font-black text-emerald-600">{balance.remaining}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="py-12 text-center text-slate-400 italic">
                      No leave balance details configured for this staff member.
                    </div>
                  )}
                </div>
              </section>

              {/* Leave History / Requests */}
              <section className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm space-y-6">
                <h3 className="text-xl font-bold flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-slate-50 text-slate-500 flex items-center justify-center">
                    <CalendarDays size={18} />
                  </div>
                  Leave Request History
                </h3>
                <div className="rounded-2xl border border-slate-100 overflow-hidden">
                  {staff.leaveRequests && staff.leaveRequests.length > 0 ? (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50/50 border-b border-slate-100">
                        <tr>
                          <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-wider">Leave Type</th>
                          <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-wider">Period</th>
                          <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-wider text-center">Days</th>
                          <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-wider">Status</th>
                          <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-wider text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {(staff.leaveRequests as any[]).map((req) => (
                          <tr key={req.id} className="hover:bg-slate-50/30 transition-colors">
                            <td className="px-5 py-3.5 font-bold text-slate-900 uppercase tracking-tight">{req.leaveType.replace('_', ' ')}</td>
                            <td className="px-5 py-3.5 text-slate-500 font-medium">
                              {formatBsDate(req.startsOn)} - {formatBsDate(req.endsOn)}
                            </td>
                            <td className="px-5 py-3.5 text-center font-bold text-slate-700">{req.days}</td>
                            <td className="px-5 py-3.5">
                              <Badge variant="outline" className={cn(
                                "font-black uppercase tracking-widest text-[8px]",
                                req.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                req.status === 'REJECTED' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                'bg-amber-50 text-amber-600 border-amber-100'
                              )}>
                                {req.status}
                              </Badge>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              {req.status === 'PENDING' && (
                                <button
                                  type="button"
                                  disabled={staff.status === 'TERMINATED'}
                                  onClick={() => setSelectedLeaveRequest(req)}
                                  className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[var(--color-mod-hr-text)] border border-[var(--color-mod-hr-border)] rounded-lg hover:bg-[var(--color-mod-hr-soft)] transition-colors"
                                >
                                  Review
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="py-12 text-center text-slate-400 italic">
                      No leave requests submitted.
                    </div>
                  )}
                </div>
              </section>
            </TabsContent>

            {/* Tab: Payroll */}
            <TabsContent value="payroll" className="m-0 outline-none space-y-8">
              {/* Salary Structures */}
              <section className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-xl font-bold flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-500 flex items-center justify-center">
                      <Calculator size={18} />
                    </div>
                    Salary Structures
                  </h3>
                  <button
                    type="button"
                    disabled={staff.status === 'TERMINATED'}
                    onClick={() => {
                      setSelectedSalaryStructure(null);
                      setIsSalaryStructureOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-mod-hr-accent)] hover:bg-[var(--color-mod-hr-text)] text-white font-bold text-xs transition-colors"
                  >
                    Add Structure
                  </button>
                </div>
                <div className="rounded-2xl border border-slate-100 overflow-hidden">
                  {staff.salaryStructures && staff.salaryStructures.length > 0 ? (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50/50 border-b border-slate-100">
                        <tr>
                          <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-wider">Effective Period</th>
                          <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-wider">Details</th>
                          <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-wider text-right">Basic Pay</th>
                          <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-wider">Status</th>
                          <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {(staff.salaryStructures as any[]).map((structure) => (
                          <tr key={structure.id} className="hover:bg-slate-50/30 transition-colors">
                            <td className="px-5 py-3.5 font-bold text-slate-900">
                              {formatBsDate(structure.effectiveFrom)}
                              {structure.effectiveTo ? ` - ${formatBsDate(structure.effectiveTo)}` : ' - Present'}
                            </td>
                            <td className="px-5 py-3.5 text-slate-500">
                              {structure.pfEnabled ? 'PF' : 'No PF'} • {structure.tdsEnabled ? 'TDS' : 'No TDS'}
                            </td>
                            <td className="px-5 py-3.5 text-right font-black text-slate-900">
                              {formatMaskableNpr(structure.basicSalary)}
                            </td>
                            <td className="px-5 py-3.5">
                              <Badge variant="outline" className={cn(
                                "font-black uppercase tracking-widest text-[8px]",
                                structure.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-100 text-slate-500'
                              )}>
                                {structure.status}
                              </Badge>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <div className="flex justify-end gap-2">
                                {structure.status !== 'ACTIVE' && (
                                  <button
                                    onClick={() => activateStructureMutation.mutate(structure.id)}
                                    disabled={staff.status === 'TERMINATED' || activateStructureMutation.isPending}
                                    className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-600 border border-emerald-100 rounded-lg hover:bg-emerald-50 transition-colors"
                                  >
                                    Activate
                                  </button>
                                )}
                                <button
                                  onClick={() => archiveStructureMutation.mutate(structure.id)}
                                  disabled={staff.status === 'TERMINATED' || archiveStructureMutation.isPending}
                                  className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-rose-600 border border-rose-100 rounded-lg hover:bg-rose-50 transition-colors"
                                >
                                  Archive
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedSalaryStructure(structure);
                                    setIsSalaryStructureOpen(true);
                                  }}
                                  disabled={staff.status === 'TERMINATED'}
                                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                  <Edit2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="py-12 text-center text-slate-400 italic">
                      No salary structure configured. Payroll run will require basic salary details.
                    </div>
                  )}
                </div>
              </section>

              {/* Payroll History */}
              <section className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm space-y-6">
                <h3 className="text-xl font-bold flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-slate-50 text-slate-500 flex items-center justify-center">
                    <Receipt size={18} />
                  </div>
                  Payslips
                </h3>
                <div className="rounded-2xl border border-slate-100 overflow-hidden">
                  {staff.payrollLines && staff.payrollLines.length > 0 ? (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50/50 border-b border-slate-100">
                        <tr>
                          <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-wider">Payroll Period</th>
                          <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-wider">Gross</th>
                          <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-wider">Deductions</th>
                          <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-wider text-right">Net Payable</th>
                          <th className="px-5 py-3 font-bold text-slate-500 uppercase tracking-wider">Payment Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {(staff.payrollLines as any[]).map((line) => (
                          <tr key={line.id} className="hover:bg-slate-50/30 transition-colors">
                            <td className="px-5 py-3.5 font-bold text-slate-900">
                              {line.payrollRun?.periodMonth}/{line.payrollRun?.periodYear}
                            </td>
                            <td className="px-5 py-3.5 text-slate-600 font-medium">{formatMaskableNpr(line.grossSalary)}</td>
                            <td className="px-5 py-3.5 text-rose-600 font-medium">
                              {line.deductions === null || line.deductions === undefined ? 'Restricted' : `- NPR ${Number(line.deductions).toLocaleString()}`}
                            </td>
                            <td className="px-5 py-3.5 text-right font-black text-slate-900">{formatMaskableNpr(line.netSalary)}</td>
                            <td className="px-5 py-3.5">
                              <Badge className={cn(
                                "font-bold text-[8px] uppercase tracking-widest",
                                line.paymentStatus === 'PAID' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/10' : 'bg-slate-100 text-slate-500'
                              )}>
                                {line.paymentStatus || 'UNPAID'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="py-12 text-center text-slate-400 italic">
                      No payroll lines exist for this profile.
                    </div>
                  )}
                </div>
              </section>
            </TabsContent>

            {/* Tab: History */}
            <TabsContent value="history" className="m-0 outline-none">
              <LifecycleHistoryPanel 
                events={historyQuery.data ?? []} 
                loading={historyQuery.isLoading} 
                error={historyQuery.error} 
              />
            </TabsContent>
          </div>

          <aside className="space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h4 className="font-bold mb-4 text-slate-400 uppercase tracking-widest text-[10px]">Staff Summary</h4>
              <div className="space-y-4">
                <div className="flex justify-between items-center gap-4 py-2 border-b border-slate-100">
                  <span className="text-xs text-slate-400 font-medium">Joined Date</span>
                  <span className="text-xs font-bold text-slate-900">{formatBsDate(staff.employment?.joiningDate ?? staff.joiningDate)}</span>
                </div>
                <div className="flex justify-between items-center gap-4 py-2 border-b border-slate-100">
                  <span className="text-xs text-slate-400 font-medium">Contract Type</span>
                  <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-mod-hr-text)]">{staff.contractType ?? 'Not set'}</span>
                </div>
                <div className="flex justify-between items-center gap-4 py-2">
                  <span className="text-xs text-slate-400 font-medium">Active Salary Structure</span>
                  <span className="text-xs font-bold text-emerald-600">
                    {activeSalaryStructure ? formatMaskableNpr(activeSalaryStructure.basicSalary) : 'Not configured'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-[var(--color-mod-hr-soft)]/70 border border-[var(--color-mod-hr-border)] rounded-2xl p-6">
              <h4 className="font-bold mb-2 text-[var(--color-mod-hr-text)] text-sm">HR Note</h4>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Profile updates are audited and synced with user authentication records. 
                Sensitive financial changes require a separate salary structure update.
              </p>
            </div>
          </aside>
        </div>
      </Tabs>

      {/* Lifecycle Status Dialog */}
      <StaffLifecycleDialog
        isOpen={isLifecycleOpen}
        onClose={() => setIsLifecycleOpen(false)}
        staffId={staffId}
        currentStatus={staff.status ?? 'ACTIVE'}
        fullName={`${staff.firstName} ${staff.lastName}`}
      />

      {/* Leave Request Dialog */}
      <LeaveRequestCreateDialog
        isOpen={isRequestLeaveOpen}
        onClose={() => setIsRequestLeaveOpen(false)}
        lockedStaffId={staffId}
      />

      {/* Adjust Leave Balance Dialog */}
      <LeaveBalanceAdjustDialog
        isOpen={isAdjustBalanceOpen}
        onClose={() => setIsAdjustBalanceOpen(false)}
        lockedStaffId={staffId}
      />

      {/* Salary Structure Create/Edit Dialog */}
      <SalaryStructureDialog
        isOpen={isSalaryStructureOpen}
        onClose={() => setIsSalaryStructureOpen(false)}
        lockedStaffId={staffId}
        existingStructure={selectedSalaryStructure}
      />

      {/* Attendance Correction Dialog */}
      {selectedAttendanceRecord && (
        <StaffAttendanceCorrectionDialog
          isOpen={!!selectedAttendanceRecord}
          onClose={() => setSelectedAttendanceRecord(null)}
          staffId={staffId}
          record={selectedAttendanceRecord}
          fullName={`${staff.firstName} ${staff.lastName}`}
        />
      )}

      {/* Leave Review Dialog */}
      {selectedLeaveRequest && (
        <LeaveReviewDialog
          isOpen={!!selectedLeaveRequest}
          onClose={() => setSelectedLeaveRequest(null)}
          leaveRequest={{
            ...selectedLeaveRequest,
            staff: {
              firstName: staff.firstName,
              lastName: staff.lastName,
              employeeId: staff.employeeId
            }
          }}
        />
      )}
    </div>
  );
}

function LifecycleHistoryPanel({ events, loading, error }: { events: StaffLifecycleHistoryEvent[]; loading: boolean; error: Error | null }) {
  return (
    <section className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm space-y-6">
      <h3 className="text-xl font-bold flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center">
          <History size={18} />
        </div>
        Lifecycle Audit
      </h3>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-50" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error.message}</div>
      ) : events.length > 0 ? (
        <div className="space-y-3">
          {events.map((event) => {
            const actorName = `${event.createdBy?.staff?.firstName ?? ''} ${event.createdBy?.staff?.lastName ?? ''}`.trim() || event.createdBy?.email || 'System';

            return (
              <div key={event.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Badge variant="outline" className="font-bold text-[10px] uppercase tracking-widest">
                      {formatLifecycleEvent(event.eventType)}
                    </Badge>
                    <p className="mt-2 text-sm font-bold text-slate-900">{event.reason || event.notes || 'Lifecycle record'}</p>
                    <p className="mt-1 text-xs font-medium text-slate-500">Performed by: {actorName}</p>
                  </div>
                  <span className="text-xs font-bold text-slate-400">{formatBsDate(event.eventDate)}</span>
                </div>
                {event.metadata ? <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-medium text-slate-500">{formatMetadata(event.metadata)}</p> : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-12 text-center">
          <p className="text-sm text-slate-400 font-medium italic">No lifecycle audit records found.</p>
        </div>
      )}
    </section>
  );
}

function formatLifecycleEvent(value: string) {
  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMetadata(metadata: Record<string, unknown>) {
  const entries = Object.entries(metadata).filter(([, value]) => value !== undefined && value !== null && value !== '');

  if (entries.length === 0) {
    return 'No metadata';
  }

  return entries.map(([key, value]) => `${formatLifecycleEvent(key)}: ${String(value)}`).join(' • ');
}
