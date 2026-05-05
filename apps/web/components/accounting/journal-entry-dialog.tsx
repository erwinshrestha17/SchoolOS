'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2, FileText, X } from 'lucide-react';
import { api } from '../../lib/api';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-950 flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-600" />
              Journal Entry {entry?.entryNumber || '...'}
            </h3>
            <p className="text-sm text-gray-500">
              Recorded on {entry ? new Date(entry.entryDate).toLocaleDateString() : '...'}
            </p>
          </div>
          <button 
            onClick={() => onOpenChange(false)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
            </div>
          ) : entry ? (
            <div className="space-y-6">
              <div className="bg-purple-50/50 p-4 rounded-2xl text-sm border border-purple-100">
                <p><span className="font-semibold text-purple-900">Narration:</span> {entry.narration}</p>
                <p className="mt-1"><span className="font-semibold text-purple-900">Source:</span> {entry.sourceType} ({entry.sourceId || 'N/A'})</p>
              </div>

              <div className="rounded-2xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left p-4 font-semibold text-gray-900">Account</th>
                      <th className="text-right p-4 font-semibold text-gray-900">Debit</th>
                      <th className="text-right p-4 font-semibold text-gray-900">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {entry.lines?.map((line: any) => (
                      <tr key={line.id}>
                        <td className="p-4">
                          <p className="font-medium text-gray-900">{line.chartAccount.name}</p>
                          <p className="text-[10px] font-mono text-gray-500">{line.chartAccount.code}</p>
                        </td>
                        <td className="p-4 text-right font-mono text-gray-900">
                          {line.side === 'DEBIT' ? Number(line.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                        </td>
                        <td className="p-4 text-right font-mono text-gray-900">
                          {line.side === 'CREDIT' ? Number(line.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              Failed to load journal entry details.
            </div>
          )}
        </div>
        
        <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button
            onClick={() => onOpenChange(false)}
            className="px-6 py-2 bg-gray-900 text-white font-semibold rounded-full hover:bg-gray-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
