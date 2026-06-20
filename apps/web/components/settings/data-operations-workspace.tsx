import Link from 'next/link';
import { ArrowLeft, ArrowRight, Database, Download, FileInput, FileOutput, Landmark, UsersRound } from 'lucide-react';
import { PageHeader } from '../ui/page-header';

const areas = [
  {
    title: 'Imports',
    icon: FileInput,
    description: 'Bring verified school data into SchoolOS through the module that owns the record.',
    items: [
      { label: 'Student import', description: 'CSV intake, duplicate review, document readiness and admissions migration.', href: '/dashboard/admissions' },
      { label: 'Staff import', description: 'Bring staff records into the HR workspace.', href: '/dashboard/hr/staff' },
      { label: 'Historic fee data', description: 'Review fee setup and historical collection migration in Fees.', href: '/dashboard/fees' },
    ],
  },
  {
    title: 'Exports',
    icon: FileOutput,
    description: 'Request reports and data files from the operational module with its own permission and File Registry controls.',
    items: [
      { label: 'Student & iEMIS readiness', description: 'Review student data and official-readiness issues before export.', href: '/dashboard/students' },
      { label: 'Accounting reports', description: 'Generate protected accounting reports and queued exports.', href: '/dashboard/accounting' },
      { label: 'Payroll reports', description: 'Export approved payroll summaries through Payroll.', href: '/dashboard/payroll/reports' },
    ],
  },
];

export function DataOperationsWorkspace() {
  return <div className="space-y-6 p-6 pb-24">
    <PageHeader title="Import & export" description="Open the appropriate school module for bulk data movement and protected reports. Platform integrations and provider credentials are intentionally not configured here." actions={<Link href="/dashboard/settings" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"><ArrowLeft className="h-4 w-4" />All settings</Link>} />
    <section className="rounded-2xl border border-sky-100 bg-sky-50 p-5 text-sm text-sky-900"><div className="flex gap-3"><Database className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-bold">Data stays with its owning module</p><p className="mt-1 leading-6">Students, fees, payroll, attendance, and accounting each have different validation, permissions, audit, and file-retention rules. This directory sends staff to the correct workflow instead of creating an unsafe generic import screen.</p></div></div></section>
    <section className="grid gap-5 xl:grid-cols-2">{areas.map((area) => { const Icon = area.icon; return <div key={area.title} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-start gap-3 border-b border-slate-100 p-5"><span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white"><Icon className="h-5 w-5" /></span><div><h2 className="font-bold text-slate-950">{area.title}</h2><p className="mt-1 text-sm leading-6 text-slate-600">{area.description}</p></div></div><div className="divide-y divide-slate-100">{area.items.map((item) => <Link key={item.href} href={item.href} className="group flex items-center gap-3 px-5 py-4 transition hover:bg-slate-50"><span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">{area.title === 'Imports' ? <UsersRound className="h-4 w-4" /> : <Download className="h-4 w-4" />}</span><div className="min-w-0 flex-1"><p className="font-semibold text-slate-900">{item.label}</p><p className="mt-1 text-sm leading-5 text-slate-600">{item.description}</p></div><ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-800" /></Link>)}</div></div>; })}</section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start gap-3"><Landmark className="mt-0.5 h-5 w-5 text-slate-700" /><div><h2 className="font-bold text-slate-950">What does not belong here</h2><p className="mt-1 text-sm leading-6 text-slate-600">SchoolOS SaaS subscription billing, provider credentials, queue administration, backup restore, platform support override, and cross-school operations remain in the Platform control plane. School staff cannot manage them from this school Settings area.</p></div></div></section>
  </div>;
}
