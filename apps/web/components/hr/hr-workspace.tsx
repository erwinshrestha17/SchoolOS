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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';

type TabId = 'staff' | 'contracts' | 'leave' | 'attendance' | 'balances' | 'salary' | 'payroll';

export function HRWorkspace() {
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
      <Tabs defaultValue="staff" className="space-y-6">
        <TabsList className="flex flex-wrap h-auto gap-2 border-b border-slate-200 bg-transparent rounded-none p-0 pb-px w-full justify-start">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="group flex items-center gap-2.5 border-b-2 border-transparent px-4 py-3 text-sm font-medium transition-all rounded-none data-[state=active]:border-primary-600 data-[state=active]:text-primary-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none hover:text-slate-700"
            >
              <tab.icon
                size={18}
                className="text-slate-400 group-data-[state=active]:text-primary-600 group-hover:text-slate-500"
              />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <TabsContent value="staff" className="mt-0">
            <StaffList />
          </TabsContent>
          <TabsContent value="contracts" className="mt-0">
            <ContractList />
          </TabsContent>
          <TabsContent value="leave" className="mt-0">
            <LeaveRequestList />
          </TabsContent>
          <TabsContent value="attendance" className="mt-0">
            <StaffAttendanceSummary />
          </TabsContent>
          <TabsContent value="balances" className="mt-0">
            <LeaveBalanceList />
          </TabsContent>
          <TabsContent value="salary" className="mt-0">
            <SalaryStructureList />
          </TabsContent>
          <TabsContent value="payroll" className="mt-0">
            <PayrollRuns />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
