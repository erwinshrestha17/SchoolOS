"use client";

import { useQuery } from "@tanstack/react-query";
import { FileText, X } from "lucide-react";
import { api } from "../../lib/api";
import { LoadingState } from "../ui/loading-state";
import { cn } from "../../lib/utils";
import { formatBsDate } from "@schoolos/core";

interface JournalEntryDialogProps {
  id: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function JournalEntryDialog({
  id,
  open,
  onOpenChange,
}: JournalEntryDialogProps) {
  const { data: entry, isLoading } = useQuery({
    queryKey: ["journal-entry", id],
    queryFn: () => (id ? api.getJournalEntry(id) : null),
    enabled: !!id && open,
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--color-overlay-strong)] backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200/50 animate-in zoom-in-95 duration-300">
        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-[var(--color-mod-accounting-bg)] text-[var(--color-mod-accounting-accent)] flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              {entry?.entryNumber
                ? `Entry ${entry.entryNumber}`
                : "Loading entry"}
            </h3>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mt-2 ml-[3.25rem]">
              {entry
                ? `Recorded on ${formatBsDate(entry.entryDate)}`
                : "Loading ledger details"}
            </p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-2.5 hover:bg-slate-100 rounded-2xl transition-all active:scale-90"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {isLoading ? (
            <LoadingState
              variant="spinner"
              label="Gathering entry details..."
            />
          ) : entry ? (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-[var(--color-mod-accounting-bg)] p-6 rounded-2xl text-sm border border-[var(--color-mod-accounting-border)] space-y-2">
                <p className="flex items-start gap-2">
                  <span className="font-black text-[var(--color-mod-accounting-text)] uppercase tracking-widest text-[10px] mt-0.5">
                    Narration
                  </span>
                  <span className="font-bold text-[var(--color-mod-accounting-text)] leading-relaxed italic">
                    &ldquo;{entry.narration}&rdquo;
                  </span>
                </p>
                <p className="flex items-center gap-2 pt-2 border-t border-[var(--color-mod-accounting-border)]">
                  <span className="font-black text-[var(--color-mod-accounting-text)] uppercase tracking-widest text-[10px]">
                    Source
                  </span>
                  <span className="font-bold text-[var(--color-mod-accounting-text)]">
                    {entry.sourceType}{" "}
                    <span className="text-[10px] opacity-70">
                      #{entry.sourceId || "Source ID not set"}
                    </span>
                  </span>
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-6 py-4 text-[0.65rem] font-black uppercase tracking-widest text-slate-400">
                        Account
                      </th>
                      <th className="text-right px-6 py-4 text-[0.65rem] font-black uppercase tracking-widest text-slate-400">
                        Debit
                      </th>
                      <th className="text-right px-6 py-4 text-[0.65rem] font-black uppercase tracking-widest text-slate-400">
                        Credit
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {entry.lines?.map((line: any) => (
                      <tr
                        key={line.id}
                        className="hover:bg-slate-50/30 transition-colors group"
                      >
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-900 group-hover:text-[var(--color-mod-accounting-text)] transition-colors">
                            {line.chartAccount.name}
                          </p>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
                            {line.chartAccount.code}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-right font-black text-slate-900 tabular-nums">
                          {line.side === "DEBIT"
                            ? Number(line.amount).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                              })
                            : "-"}
                        </td>
                        <td className="px-6 py-4 text-right font-black text-slate-900 tabular-nums">
                          {line.side === "CREDIT"
                            ? Number(line.amount).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                              })
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center">
              <p className="text-sm font-bold text-slate-400">
                Failed to load journal entry details.
              </p>
            </div>
          )}
        </div>

        <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            onClick={() => onOpenChange(false)}
            className="px-8 py-3 bg-[var(--color-mod-accounting-accent)] text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-[var(--color-mod-accounting-text)] transition-all shadow-sm active:scale-95"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
