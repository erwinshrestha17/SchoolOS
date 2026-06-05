'use client';

import {
  Users,
  FileText,
  CalendarDays,
  ClipboardCheck,
  Calculator,
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
          <TabsList className="flex h-auto max-w-full flex-wrap overflow-x-auto rounded-2xl border border-[var(--color-mod-hr-border)] bg-white/90 p-1.5 shadow-sm backdrop-blur-xl">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 transition-all data-[state=active]:bg-[var(--color-mod-hr-accent)] data-[state=active]:text-white"
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
