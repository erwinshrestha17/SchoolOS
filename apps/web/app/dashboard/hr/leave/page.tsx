'use client';

import { LeaveRequestList } from '../../../../components/hr/leave-request-list';
import { LeaveBalanceList } from '../../../../components/hr/leave-balance-list';
import { LeaveCoveragePanel } from '../../../../components/hr/leave-coverage-panel';
import { useSession } from '../../../../components/session-provider';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '../../../../components/ui/tabs';
import { CalendarClock, CalendarDays, Scale } from 'lucide-react';

export default function LeaveManagementPage() {
  const { hasPermissions } = useSession();
  // Coverage is decided with leave approval (server-gated by hr:leave:approve).
  const canSeeCoverage = hasPermissions(['hr:leave:approve']);
  return (
    <div className="animate-in fade-in duration-500">
      <Tabs defaultValue="requests" className="space-y-6">
        <TabsList className="bg-white/50 border border-slate-200">
          <TabsTrigger value="requests" className="gap-2">
            <CalendarDays size={16} />
            Leave Requests
          </TabsTrigger>
          <TabsTrigger value="balances" className="gap-2">
            <Scale size={16} />
            Leave Balances
          </TabsTrigger>
          {canSeeCoverage ? (
            <TabsTrigger value="coverage" className="gap-2">
              <CalendarClock size={16} />
              Coverage
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="requests" className="outline-none">
          <LeaveRequestList />
        </TabsContent>
        <TabsContent value="balances" className="outline-none">
          <LeaveBalanceList />
        </TabsContent>
        {canSeeCoverage ? (
          <TabsContent value="coverage" className="outline-none">
            <LeaveCoveragePanel />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
