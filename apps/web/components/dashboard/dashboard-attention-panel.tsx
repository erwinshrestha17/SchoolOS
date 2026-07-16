"use client";

import type {
  OperationalAttentionItem,
  OperationalSummaryModule,
} from "@schoolos/core";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "../../lib/utils";
import { SectionCard } from "../ui/section-card";
import {
  attentionKind,
  formatNumber,
  MODULE_DEFINITIONS,
  safeRoute,
  severityPresentation,
} from "./dashboard-module-meta";

type DashboardAttentionItem = OperationalAttentionItem & {
  module: OperationalSummaryModule;
};

const DEFAULT_VISIBLE_ITEMS = 5;

/**
 * The main "Needs your attention" queue: the backend's severity-ordered,
 * permission-filtered attention items, capped at five with an in-place
 * "show all" for the rest of the already-bounded payload (max 10 items
 * server-side) — no extra fetch, no unbounded approval listing.
 */
export function DashboardAttentionPanel({
  items,
}: {
  items: DashboardAttentionItem[];
}) {
  const [expanded, setExpanded] = useState(false);
  const openItems = items.filter((item) => item.count > 0);
  const visibleItems = expanded
    ? openItems
    : openItems.slice(0, DEFAULT_VISIBLE_ITEMS);
  const hiddenCount = openItems.length - DEFAULT_VISIBLE_ITEMS;

  return (
    <section id="needs-attention" className="scroll-mt-6" aria-label="Needs your attention">
      <SectionCard
        title="Needs your attention"
        description={
          openItems.length
            ? "Start with the items that can affect today’s school day."
            : "Nothing needs your attention right now."
        }
        headerAction={
          openItems.length ? (
            <span className="inline-flex items-center rounded-full border border-warning-100 bg-warning-50 px-2.5 py-1 text-xs font-bold text-warning-700">
              {formatNumber(openItems.length)}
            </span>
          ) : (
            <CheckCircle2
              className="h-5 w-5 text-success-600"
              aria-hidden="true"
            />
          )
        }
        footer={
          hiddenCount > 0 ? (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="text-sm font-bold text-[var(--primary)] transition hover:text-[var(--primary-dark)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-soft)] focus-visible:ring-offset-2"
            >
              {expanded
                ? "Show fewer items"
                : `View all ${formatNumber(openItems.length)} attention items`}
            </button>
          ) : undefined
        }
      >
        {openItems.length ? (
          <ul className="space-y-2">
            {visibleItems.map((item) => (
              <li key={`${item.module}-${item.key}`}>
                <AttentionRow item={item} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-start gap-3 rounded-xl border border-success-100 bg-success-50 p-3">
            <CheckCircle2
              className="mt-0.5 h-4 w-4 shrink-0 text-success-600"
              aria-hidden="true"
            />
            <p className="text-sm leading-5 text-slate-700">
              No approvals, warnings, or follow-ups are open for you today.
            </p>
          </div>
        )}
      </SectionCard>
    </section>
  );
}

function AttentionRow({ item }: { item: DashboardAttentionItem }) {
  const definition = MODULE_DEFINITIONS[item.module];
  const Icon = definition.icon;
  const kind = attentionKind(item);
  const presentation = severityPresentation[item.severity];
  const href = safeRoute({
    key: item.key,
    label: item.label,
    route: item.action,
  });

  const content = (
    <>
      <span
        className={cn(
          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
          definition.accentClass,
        )}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-slate-900">
          {item.label}
        </p>
        <p className="mt-0.5 truncate text-xs font-medium text-slate-600">
          {formatNumber(item.count)} {item.count === 1 ? "item" : "items"} in{" "}
          {definition.shortLabel}
        </p>
      </div>
      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide",
          kind === "approval"
            ? "bg-[var(--primary-soft)] text-[color:var(--primary-dark)]"
            : presentation.chipClass,
        )}
      >
        {kind === "approval" ? "Approval" : presentation.label}
      </span>
      {href ? (
        <ArrowRight
          className="h-4 w-4 shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-[var(--primary)]"
          aria-hidden="true"
        />
      ) : null}
    </>
  );

  // The severity tier owns the row surface (pale red / amber / blue); the
  // module icon keeps the module accent, matching the colour direction's
  // attention-queue treatment.
  const className = cn(
    "group flex items-center gap-3 rounded-xl border p-3 transition hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)] focus:ring-offset-2",
    presentation.rowClass,
  );

  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
