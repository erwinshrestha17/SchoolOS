'use client';

import { useState } from 'react';
import {
  Users,
  FileText,
  CalendarDays,
  ClipboardCheck,
  Calculator,
} from 'lucide-react';
import { StaffList } from './staff-list';
import { ContractList } from './contract-list';
import { LeaveRequestList } from './leave-request-list';
import { StaffAttendanceSummary } from './staff-attendance-summary';
import { LeaveBalanceList } from './leave-balance-list';
import { PayrollRuns } from './payroll-runs';
import { SalaryStructureList } from './salary-structure-list';

type TabId = 'staff' | 'contracts' | 'leave' | 'attendance' | 'balances' | 'salary' | 'payroll';

export function HRWorkspace() {
  const [activeTab, setActiveTab] = useState<TabId>('staff');

  const tabs = [
    { id: 'staff' as TabId, label: 'Staff Directory', icon: Users },
    { id: 'contracts' as TabId, label: 'Contracts', icon: FileText },
    { id: 'leave' as TabId, label: 'Leave Requests', icon: CalendarDays },
    { id: 'attendance' as TabId, label: 'Attendance Summary', icon: ClipboardCheck },
    { id: 'balances' as TabId, label: 'Leave Balances', icon: CalendarDays },
    { id: 'salary' as TabId, label: 'Salary', icon: Calculator },
    { id: 'payroll' as TabId, label: 'Payroll Runs', icon: Calculator },
  ];

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-px">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`group flex items-center gap-2.5 border-b-2 px-4 py-3 text-sm font-medium transition-all ${
                isActive
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              <tab.icon
                size={18}
                className={isActive ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-500'}
              />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab === 'staff' && <StaffList />}
        {activeTab === 'contracts' && <ContractList />}
        {activeTab === 'leave' && <LeaveRequestList />}
        {activeTab === 'attendance' && <StaffAttendanceSummary />}
        {activeTab === 'balances' && <LeaveBalanceList />}
        {activeTab === 'salary' && <SalaryStructureList />}
        {activeTab === 'payroll' && <PayrollRuns />}
      </div>
    </div>
  );
}
