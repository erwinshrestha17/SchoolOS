import * as React from 'react';
import Link from 'next/link';
import { 
  School, 
  ClipboardList, 
  Users, 
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

import { RequestDemoForm } from '../../components/forms/request-demo-form';

export default function RequestDemoPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans antialiased text-slate-650">
      
      {/* ── Minimal Header ── */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-sm font-black text-white">
              S
            </span>
            <div className="flex flex-col">
              <span className="text-base font-black tracking-tight leading-none text-slate-900">
                SchoolOS
              </span>
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                School ERP for Nepal
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-5">
            <Link 
              href="/" 
              className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
            >
              Back to website
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-xl text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 h-8 px-4 active:scale-[0.98] transition-all"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Layout Grid ── */}
      <main className="flex-1 max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-8 lg:gap-12 px-6 py-10 items-start">
        
        {/* Left Column: Short Info Panel */}
        <div className="space-y-6 lg:sticky lg:top-24">
          
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 leading-tight">
              Request a SchoolOS Demo
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm leading-relaxed">
              Tell us about your school and our team will contact you for verification, demo, and guided onboarding.
            </p>
          </div>

          {/* Small Note Card */}
          <div className="rounded-xl border border-slate-200 bg-slate-100/50 p-4 text-[11px] text-slate-600 leading-relaxed font-semibold">
            SchoolOS workspaces are created only after verification, so your school starts with the correct academic year, class structure, fee setup, roles, and access permissions.
          </div>

          {/* 3 Benefit Rows */}
          <div className="space-y-4 pt-2">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                <School size={16} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-950">Verified school setup</h4>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                  We check registration details and structure configurations before system handoff.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                <ClipboardList size={16} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-950">Guided onboarding</h4>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                  Our rollout engineers map your classes, fees schedules, and existing sheets.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                <Users size={16} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-950">Role-aware school access</h4>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                  Admins, teachers, accountants, and coordinators access customized layouts.
                </p>
              </div>
            </div>
          </div>

          {/* Process Timeline */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <h4 className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Process Roadmap</h4>
            <div className="relative pl-6 space-y-4 text-[11px] font-bold text-slate-650">
              {/* Vertical connecting line */}
              <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-slate-100" />

              <div className="relative flex gap-3 items-center">
                <span className="absolute -left-[23px] h-5 w-5 rounded-full bg-blue-600 border border-blue-600 text-white font-extrabold flex items-center justify-center text-[9px] shrink-0 ring-4 ring-white">1</span>
                <span>Submit request</span>
              </div>
              <div className="relative flex gap-3 items-center">
                <span className="absolute -left-[23px] h-5 w-5 rounded-full bg-slate-100 border border-slate-200 text-slate-500 font-extrabold flex items-center justify-center text-[9px] shrink-0 ring-4 ring-white">2</span>
                <span>SchoolOS team contacts you</span>
              </div>
              <div className="relative flex gap-3 items-center">
                <span className="absolute -left-[23px] h-5 w-5 rounded-full bg-slate-100 border border-slate-200 text-slate-500 font-extrabold flex items-center justify-center text-[9px] shrink-0 ring-4 ring-white">3</span>
                <span>Demo and planning</span>
              </div>
              <div className="relative flex gap-3 items-center">
                <span className="absolute -left-[23px] h-5 w-5 rounded-full bg-slate-100 border border-slate-200 text-slate-500 font-extrabold flex items-center justify-center text-[9px] shrink-0 ring-4 ring-white">4</span>
                <span>Verified school setup</span>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Intake Form Card */}
        <div className="w-full">
          <RequestDemoForm />
        </div>

      </main>
    </div>
  );
}
