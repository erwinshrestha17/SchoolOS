'use client';

import { LeaveRequestList } from '../../../../components/hr/leave-request-list';
import { LeaveBalanceList } from '../../../../components/hr/leave-balance-list';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../../components/ui/tabs';
import { CalendarDays, Scale } from 'lucide-react';

export default function LeaveManagementPage() {
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
        </TabsList>

        <TabsContent value="requests" className="outline-none">
          <LeaveRequestList />
        </TabsContent>
        <TabsContent value="balances" className="outline-none">
          <LeaveBalanceList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
