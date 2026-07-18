import Link from 'next/link';
import { ArrowRight, CircleAlert } from 'lucide-react';
import {
  SchoolSettingsPageHeader,
  SettingsPermissionNotice,
} from './settings-page-header';

type DirectoryArea = {
  title: string;
  description: string;
  href?: string;
  status?: 'available' | 'module-owned' | 'contract-needed';
};

export function SettingsDirectoryWorkspace({
  title,
  description,
  areas,
  note,
}: {
  title: string;
  description: string;
  areas: DirectoryArea[];
  note?: string;
}) {
  return (
    <div className="space-y-6 p-5 pb-20 lg:p-7">
      <SchoolSettingsPageHeader
        title={title}
        description={description}
        access="view-only"
        status="Module-owned workflows"
      />
      <SettingsPermissionNotice
        access="view-only"
        description="This page is a directory. Open the owning school module to use supported controls."
      />
      <section className="grid gap-4 md:grid-cols-2">
        {areas.map((area) => {
          const body = (
            <>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-bold text-slate-950">{area.title}</h2>
                  {area.status === 'available' ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                      Available
                    </span>
                  ) : null}
                  {area.status === 'module-owned' ? (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 ring-1 ring-blue-200">
                      Module-owned
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {area.description}
                </p>
                {area.status === 'contract-needed' ? (
                  <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                    <CircleAlert className="h-3.5 w-3.5" />
                    Configuration is not editable until the backend contract is
                    confirmed.
                  </p>
                ) : null}
              </div>
              {area.href ? (
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
              ) : null}
            </>
          );
          return area.href ? (
            <Link
              key={area.title}
              href={area.href}
              className="flex min-h-36 items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/30"
            >
              {body}
            </Link>
          ) : (
            <div
              key={area.title}
              className="flex min-h-36 items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              {body}
            </div>
          );
        })}
      </section>
      {note ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
          <div className="flex gap-3">
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-bold">Configuration boundary</p>
              <p className="mt-1 leading-6">{note}</p>
              <p className="sr-only">needs API contract</p>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
