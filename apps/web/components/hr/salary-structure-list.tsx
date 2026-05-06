'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Archive } from 'lucide-react';
import { api } from '../../lib/api';

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
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
      <h3 className="font-bold text-gray-900">Salary Structures</h3>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs uppercase text-gray-400">
              <th className="px-3 py-2">Staff</th>
              <th className="px-3 py-2">Effective</th>
              <th className="px-3 py-2">Basic</th>
              <th className="px-3 py-2">PF/TDS</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {(structuresQuery.data ?? []).map((structure) => (
              <tr key={structure.id}>
                <td className="px-3 py-2">{structure.staff?.firstName} {structure.staff?.lastName}</td>
                <td className="px-3 py-2">{new Date(structure.effectiveFrom).toLocaleDateString()}</td>
                <td className="px-3 py-2">{structure.basicSalary}</td>
                <td className="px-3 py-2">{structure.pfEnabled ? 'PF' : '-'} / {structure.tdsEnabled ? 'TDS' : '-'}</td>
                <td className="px-3 py-2">{structure.status}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => activateMutation.mutate(structure.id)}
                      className="rounded-lg border border-gray-200 p-2"
                      title="Activate"
                    >
                      <CheckCircle2 size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => archiveMutation.mutate(structure.id)}
                      className="rounded-lg border border-gray-200 p-2"
                      title="Archive"
                    >
                      <Archive size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {structuresQuery.data?.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">No salary structures yet.</p>
        ) : null}
      </div>
    </section>
  );
}
