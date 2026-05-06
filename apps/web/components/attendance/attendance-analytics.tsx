'use client';

import React from 'react';
import { SectionCard } from '@/components/ui/section-card';
import { StatCard } from '@/components/ui/stat-card';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { AlertCircle, TrendingDown, Users } from 'lucide-react';

interface AttendanceAnalyticsProps {
  analytics: any;
}

export function AttendanceAnalytics({ analytics }: AttendanceAnalyticsProps) {
  if (!analytics) return null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <SectionCard 
        title="Absence Patterns" 
        description="Students with high absence frequency"
      >
        <div className="space-y-4">
          {analytics.absenceHotlist?.slice(0, 5).map((item: any) => (
            <div key={item.studentId} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700">
                  {item.absenceCount}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Student {item.studentId}</p>
                  <p className="text-[0.7rem] text-slate-500 uppercase tracking-wider font-bold">Total Absences</p>
                </div>
              </div>
              <Badge variant="warning">Action Required</Badge>
            </div>
          ))}
          {(!analytics.absenceHotlist || analytics.absenceHotlist.length === 0) && (
            <p className="text-sm text-slate-500 text-center py-4">No significant patterns detected.</p>
          )}
        </div>
      </SectionCard>

      <SectionCard 
        title="Attendance Risk Alerts" 
        description="Students below 80% attendance threshold"
      >
        <div className="space-y-4">
          {analytics.below80Warnings?.slice(0, 5).map((item: any) => (
            <div key={item.studentId} className="flex items-center justify-between p-4 bg-red-50/50 border border-red-100 rounded-2xl">
              <div>
                <p className="text-sm font-bold text-slate-900">{item.fullNameEn}</p>
                <p className="text-[0.7rem] text-slate-500 uppercase tracking-wider font-bold">{item.studentSystemId}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-destructive">{item.attendancePercent}%</p>
                <p className="text-[0.6rem] text-slate-400 uppercase tracking-widest font-bold">Current Rate</p>
              </div>
            </div>
          ))}
          {(!analytics.below80Warnings || analytics.below80Warnings.length === 0) && (
            <p className="text-sm text-slate-500 text-center py-4">No students currently at risk.</p>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
