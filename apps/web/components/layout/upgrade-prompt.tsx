'use client';

import React from 'react';
import Link from 'next/link';
import { Lock, ArrowLeft, ArrowUpRight } from 'lucide-react';

interface UpgradePromptProps {
  moduleName: string;
  currentTier?: string | null;
}

export function UpgradePrompt({ moduleName, currentTier }: UpgradePromptProps) {
  // Map moduleName to friendly titles
  const moduleFriendlyNames: Record<string, string> = {
    students: 'Admissions & Student Profiles',
    attendance: 'Smart Attendance',
    fees: 'Fees & Receipts',
    exams: 'Exams, CAS & Report Cards',
    activity: 'Activity Feed & Milestones',
    homework: 'Homework & Timetable',
    hr: 'HR & Payroll',
    library: 'Library Management',
    transport: 'Transport Management',
    canteen: 'Canteen Management',
    accounting: 'Accounting & Finance',
    notices: 'Notices & Announcements',
  };

  const friendlyName = moduleFriendlyNames[moduleName] || moduleName;

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-slate-50/50 px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)] shadow-inner">
          <Lock size={28} />
        </div>

        <h2 className="mb-2 text-2xl font-bold tracking-tight text-slate-900">
          Module Locked
        </h2>
        <p className="mb-6 text-sm leading-relaxed text-slate-500 max-w-sm mx-auto">
          The <span className="font-semibold text-slate-800">{friendlyName}</span> module is not included in your school&apos;s current plan
          {currentTier ? (
            <span>
              {' '}(<span className="font-semibold uppercase text-[var(--primary)]">{currentTier}</span>)
            </span>
          ) : (
            ''
          )}.
          Please contact your administrator to upgrade your subscription.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
            Go to Dashboard
          </Link>
          <a
            href="mailto:support@schoolos.io"
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[var(--primary-dark)]"
          >
            Request Upgrade
            <ArrowUpRight size={16} />
          </a>
        </div>
      </div>
    </div>
  );
}
