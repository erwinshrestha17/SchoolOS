'use client';

import { useState } from 'react';
import type { StaffLookupOption } from '@schoolos/core';
import { FileText, User } from 'lucide-react';
import { StaffDocumentsPanel } from './staff-documents-panel';
import { RemoteStaffSelector } from '../staff/remote-staff-selector';

export function CentralDocumentsPanel() {
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [selectedStaff, setSelectedStaff] =
    useState<StaffLookupOption | null>(null);
  const formatAssignedText = (value: string | null | undefined, fallback: string) =>
    value?.trim() || fallback;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText size={18} className="text-[var(--color-mod-hr-text)]" />
              Staff Documents Hub
            </h3>
            <p className="text-xs text-slate-500">Select a staff member to upload, verify, and manage their records.</p>
          </div>
          <div className="w-full sm:w-72">
            <RemoteStaffSelector
              value={selectedStaffId}
              selectedOption={selectedStaff}
              onChange={(staffId, option) => {
                setSelectedStaffId(staffId);
                setSelectedStaff(option);
              }}
              label="Select staff member"
              placeholder="Search staff member"
              className="w-full"
            />
          </div>
        </div>
      </div>

      {selectedStaffId ? (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-[var(--color-mod-hr-soft)] text-[var(--color-mod-hr-text)] flex items-center justify-center font-black">
              {initials(selectedStaff?.fullName)}
            </div>
            <div>
              <h4 className="font-bold text-lg text-slate-900">
                {selectedStaff?.fullName}
              </h4>
              <p className="text-xs text-slate-500">
                {selectedStaff?.employeeId} &bull; {formatAssignedText(selectedStaff?.designation, 'Designation not set')} &bull; {formatAssignedText(selectedStaff?.department, 'Department not set')}
              </p>
            </div>
          </div>
          <StaffDocumentsPanel staffId={selectedStaffId} />
        </div>
      ) : (
        <div className="bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
          <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-400">
            <User size={20} />
          </div>
          <p className="text-slate-900 font-bold">No Staff Selected</p>
          <p className="text-slate-500 text-xs mt-1">Please select a staff member from the dropdown to manage their documents.</p>
        </div>
      )}
    </div>
  );
}

function initials(fullName: string | undefined) {
  return (fullName ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
