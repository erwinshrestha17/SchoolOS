'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { FileText, Search, User } from 'lucide-react';
import { StaffDocumentsPanel } from './staff-documents-panel';
import { Select } from '../ui/select';

export function CentralDocumentsPanel() {
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');

  const staffQuery = useQuery({
    queryKey: ['staff'],
    queryFn: api.listStaff,
  });

  const staffList = staffQuery.data ?? [];
  const selectedStaff = staffList.find((s) => s.id === selectedStaffId);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText size={18} className="text-blue-500" />
              Staff Documents Hub
            </h3>
            <p className="text-xs text-slate-500">Select a staff member to upload, verify, and manage their records.</p>
          </div>
          <div className="w-full sm:w-72">
            <label className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 block mb-1.5 ml-1">
              Select Staff Member
            </label>
            <Select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="w-full"
            >
              <option value="">Choose staff...</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName} ({s.employeeId})
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {selectedStaffId ? (
        <div className="space-y-6">
          <div className="bg-slate-900 rounded-[2rem] p-6 text-white flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center font-black">
              {selectedStaff?.firstName[0]}
              {selectedStaff?.lastName[0]}
            </div>
            <div>
              <h4 className="font-bold text-lg">
                {selectedStaff?.firstName} {selectedStaff?.lastName}
              </h4>
              <p className="text-xs text-slate-400">
                {selectedStaff?.employeeId} • {selectedStaff?.designation || 'Staff'} • {selectedStaff?.department || 'General'}
              </p>
            </div>
          </div>
          <StaffDocumentsPanel staffId={selectedStaffId} />
        </div>
      ) : (
        <div className="bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 py-16 text-center">
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
