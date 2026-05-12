'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Archive } from 'lucide-react';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';

export function SalaryStructureList() {
  const queryClient = useQueryClient();
  const structuresQuery = useQuery({
    queryKey: ['salary-structures'],
    queryFn: api.listSalaryStructures,
  });
  const activateMutation = useMutation({
    mutationFn: api.activateSalaryStructure,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['salary-structures'] }),
  });
  const archiveMutation = useMutation({
    mutationFn: api.archiveSalaryStructure,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['salary-structures'] }),
  });

  return (
      <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Staff</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Effective</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Structure</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Status</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {structuresQuery.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-6 py-4"><div className="h-4 w-full bg-slate-50 rounded" /></td>
                  </tr>
                ))
              ) : structuresQuery.data?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    No salary structures defined yet.
                  </td>
                </tr>
              ) : (
                structuresQuery.data?.map((structure) => (
                  <tr key={structure.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900">
                      {structure.staff?.firstName} {structure.staff?.lastName}
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-500">
                      {new Date(structure.effectiveFrom).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <p className="font-black text-slate-900 text-sm">NPR {structure.basicSalary.toLocaleString()}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                          {structure.pfEnabled ? 'PF Enabled' : 'No PF'} • {structure.tdsEnabled ? 'TDS Enabled' : 'No TDS'}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border",
                        structure.status === 'ACTIVE' ? "bg-emerald-50 text-emerald-600 border-emerald-200/50" : "bg-slate-100 text-slate-500 border-slate-200/50"
                      )}>
                        {structure.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {structure.status !== 'ACTIVE' && (
                          <button
                            onClick={() => activateMutation.mutate(structure.id)}
                            className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all"
                            title="Activate Structure"
                          >
                            <CheckCircle2 size={18} />
                          </button>
                        )}
                        <button
                          onClick={() => archiveMutation.mutate(structure.id)}
                          className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                          title="Archive Structure"
                        >
                          <Archive size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
  );
}
