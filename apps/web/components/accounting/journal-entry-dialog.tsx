'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2, FileText, X } from 'lucide-react';
import { api } from '../../lib/api';
import { LoadingState } from '../ui/loading-state';
import { cn } from '../../lib/utils';

interface JournalEntryDialogProps {
  id: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function JournalEntryDialog({ id, open, onOpenChange }: JournalEntryDialogProps) {
  const { data: entry, isLoading } = useQuery({
    queryKey: ['journal-entry', id],
    queryFn: () => (id ? api.getJournalEntry(id) : null),
    enabled: !!id && open,
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200/50 animate-in zoom-in-95 duration-300">
        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-primary-100 text-primary-600 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              Entry {entry?.entryNumber || '...'}
            </h3>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mt-2 ml-[3.25rem]">
              Recorded on {entry ? new Date(entry.entryDate).toLocaleDateString() : '...'}
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
            <LoadingState variant="spinner" label="Gathering entry details..." />
          ) : entry ? (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-slate-50 p-6 rounded-[2rem] text-sm border border-slate-100 space-y-2">
                <p className="flex items-start gap-2">
                  <span className="font-black text-slate-400 uppercase tracking-widest text-[10px] mt-0.5">Narration</span>
                  <span className="font-bold text-slate-700 leading-relaxed italic">&ldquo;{entry.narration}&rdquo;</span>
                </p>
                <p className="flex items-center gap-2 pt-2 border-t border-slate-200/50">
                  <span className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Source</span>
                  <span className="font-bold text-slate-600">{entry.sourceType} <span className="text-[10px] opacity-50">#{entry.sourceId || 'N/A'}</span></span>
                </p>
              </div>

              <div className="rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-6 py-4 text-[0.65rem] font-black uppercase tracking-widest text-slate-400">Account</th>
                      <th className="text-right px-6 py-4 text-[0.65rem] font-black uppercase tracking-widest text-slate-400">Debit</th>
                      <th className="text-right px-6 py-4 text-[0.65rem] font-black uppercase tracking-widest text-slate-400">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {entry.lines?.map((line: any) => (
                      <tr key={line.id} className="hover:bg-slate-50/30 transition-colors group">
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-900 group-hover:text-primary-700 transition-colors">{line.chartAccount.name}</p>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{line.chartAccount.code}</p>
                        </td>
                        <td className="px-6 py-4 text-right font-black text-slate-900 tabular-nums">
                          {line.side === 'DEBIT' ? Number(line.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                        </td>
                        <td className="px-6 py-4 text-right font-black text-slate-900 tabular-nums">
                          {line.side === 'CREDIT' ? Number(line.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center">
              <p className="text-sm font-bold text-slate-400">Failed to load journal entry details.</p>
            </div>
          )}
        </div>
        
        <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            onClick={() => onOpenChange(false)}
            className="px-8 py-3 bg-slate-900 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10 active:scale-95"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
