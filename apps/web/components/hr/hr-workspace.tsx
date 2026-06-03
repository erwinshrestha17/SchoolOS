'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  Users,
  FileText,
  CalendarDays,
  ClipboardCheck,
  Calculator,
  Briefcase,
  AlertCircle,
  FolderOpen,
  Receipt,
  BarChart3,
  LayoutDashboard,
} from 'lucide-react';
import { HROverview } from './hr-overview';
import { StaffList } from './staff-list';
import { ContractList } from './contract-list';
import { CentralDocumentsPanel } from './central-documents-panel';
import { StaffAttendanceSummary } from './staff-attendance-summary';
import { LeaveRequestList } from './leave-request-list';
import { LeaveBalanceList } from './leave-balance-list';
import { SalaryStructureList } from './salary-structure-list';
import { PayrollRuns } from './payroll-runs';
import { PayslipList } from './payslip-list';
import PayrollReportsPage from '../../app/dashboard/payroll/reports/page';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';

type TabId =
  | 'overview'
  | 'staff'
  | 'contracts'
  | 'documents'
  | 'attendance'
  | 'leave'
  | 'balances'
  | 'salary'
  | 'payroll'
  | 'payslips'
  | 'reports';

export function HRWorkspace() {
  const tabs = [
    { id: 'overview' as TabId, label: 'Overview', icon: LayoutDashboard },
    { id: 'staff' as TabId, label: 'Staff Directory', icon: Users },
    { id: 'contracts' as TabId, label: 'Contracts', icon: FileText },
    { id: 'documents' as TabId, label: 'Documents', icon: FolderOpen },
    { id: 'attendance' as TabId, label: 'Attendance', icon: ClipboardCheck },
    { id: 'leave' as TabId, label: 'Leave Requests', icon: CalendarDays },
    { id: 'balances' as TabId, label: 'Leave Balances', icon: CalendarDays },
    { id: 'salary' as TabId, label: 'Salary Structures', icon: Calculator },
    { id: 'payroll' as TabId, label: 'Payroll Runs', icon: Calculator },
    { id: 'payslips' as TabId, label: 'Payslips', icon: Receipt },
    { id: 'reports' as TabId, label: 'Reports', icon: BarChart3 },
  ];

  return (
    <div className="space-y-8">
      <Tabs defaultValue="overview" className="space-y-8">
        <div className="sticky top-4 z-20 flex justify-center">
          <TabsList className="bg-white/80 backdrop-blur-xl border border-slate-200 p-1.5 rounded-3xl shadow-lg shadow-slate-900/5 max-w-full overflow-x-auto flex-wrap h-auto">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all flex items-center gap-1.5"
              >
                <tab.icon size={13} />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <TabsContent value="overview" className="mt-0 outline-none">
            <HROverview />
          </TabsContent>
          <TabsContent value="staff" className="mt-0 outline-none">
            <StaffList />
          </TabsContent>
          <TabsContent value="contracts" className="mt-0 outline-none">
            <ContractList />
          </TabsContent>
          <TabsContent value="documents" className="mt-0 outline-none">
            <CentralDocumentsPanel />
          </TabsContent>
          <TabsContent value="attendance" className="mt-0 outline-none">
            <StaffAttendanceSummary />
          </TabsContent>
          <TabsContent value="leave" className="mt-0 outline-none">
            <LeaveRequestList />
          </TabsContent>
          <TabsContent value="balances" className="mt-0 outline-none">
            <LeaveBalanceList />
          </TabsContent>
          <TabsContent value="salary" className="mt-0 outline-none">
            <SalaryStructureList />
          </TabsContent>
          <TabsContent value="payroll" className="mt-0 outline-none">
            <PayrollRuns />
          </TabsContent>
          <TabsContent value="payslips" className="mt-0 outline-none">
            <PayslipList />
          </TabsContent>
          <TabsContent value="reports" className="mt-0 outline-none">
            <PayrollReportsPage />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
