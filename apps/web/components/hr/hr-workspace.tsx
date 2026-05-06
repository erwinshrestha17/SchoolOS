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
} from 'lucide-react';
import { StaffList } from './staff-list';
import { ContractList } from './contract-list';
import { LeaveRequestList } from './leave-request-list';
import { StaffAttendanceSummary } from './staff-attendance-summary';
import { LeaveBalanceList } from './leave-balance-list';
import { PayrollRuns } from './payroll-runs';
import { SalaryStructureList } from './salary-structure-list';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { StatCard } from '../ui/stat-card';

type TabId = 'staff' | 'contracts' | 'leave' | 'attendance' | 'balances' | 'salary' | 'payroll';

export function HRWorkspace() {
  const staffQuery = useQuery({ queryKey: ['staff'], queryFn: api.listStaff });
  const contractsQuery = useQuery({
    queryKey: ['staff-contracts'],
    queryFn: api.listStaffContracts,
  });
  const leaveRequestsQuery = useQuery({ queryKey: ['leave-requests'], queryFn: api.listLeaveRequests });

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
    <div className="space-y-8">
      {/* Metrics Row */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total Staff"
          value={staffQuery.data?.length ?? 0}
          icon={<Users className="h-5 w-5" />}
          loading={staffQuery.isLoading}
        />
        <StatCard
          title="Active Contracts"
          value={
            contractsQuery.data?.filter((contract) => contract.status === 'ACTIVE')
              .length ?? 0
          }
          icon={<Briefcase className="h-5 w-5" />}
          loading={contractsQuery.isLoading}
        />
        <StatCard
          title="Pending Leave"
          value={leaveRequestsQuery.data?.filter((leave) => leave.status === 'PENDING').length ?? 0}
          icon={<AlertCircle className="h-5 w-5" />}
          loading={leaveRequestsQuery.isLoading}
        />
      </div>

      <Tabs defaultValue="staff" className="space-y-8">
        <div className="sticky top-4 z-20 flex justify-center">
          <TabsList className="bg-white/80 backdrop-blur-xl border border-slate-200 p-1.5 rounded-3xl shadow-lg shadow-slate-900/5">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all"
              >
                <tab.icon size={14} className="mr-2" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <TabsContent value="staff" className="mt-0 outline-none">
            <StaffList />
          </TabsContent>
          <TabsContent value="contracts" className="mt-0 outline-none">
            <ContractList />
          </TabsContent>
          <TabsContent value="leave" className="mt-0 outline-none">
            <LeaveRequestList />
          </TabsContent>
          <TabsContent value="attendance" className="mt-0 outline-none">
            <StaffAttendanceSummary />
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
        </div>
      </Tabs>
    </div>
  );
}
