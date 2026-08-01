"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { WorkSurface } from "../ui/work-surface";
import { PageState } from "../ui/page-state";

type DestinationLink = {
  href: string;
  label: string;
  description: string;
};

export function AccountantDestinationWorkspace({
  title,
  description,
  links,
  children,
}: {
  title: string;
  description: string;
  links?: readonly DestinationLink[];
  children?: ReactNode;
}) {
  return (
    <div className="space-y-6 pb-10">
      <WorkSurface title={title} description={description}>
        {(links?.length ?? 0) > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {(links ?? []).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group rounded-xl border border-slate-200 bg-white p-4 outline-none transition-colors hover:border-blue-300 hover:bg-blue-50/40 focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <span className="flex items-center justify-between gap-3 font-semibold text-slate-900">
                  {link.label}
                  <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
                <span className="mt-1 block text-sm leading-6 text-slate-600">
                  {link.description}
                </span>
              </Link>
            ))}
          </div>
        ) : null}
        {children ? <div className={(links?.length ?? 0) > 0 ? "mt-6" : undefined}>{children}</div> : null}
      </WorkSurface>
    </div>
  );
}

export function AccountantDestinationUnavailable({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <PageState
      tone="info"
      title={title}
      description={description}
      secondaryAction={
        <Link
          href="/dashboard/accounting/reports"
          className="inline-flex h-11 items-center justify-center rounded-2xl border-2 border-slate-200 bg-white px-6 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          Open available reports
        </Link>
      }
    />
  );
}
