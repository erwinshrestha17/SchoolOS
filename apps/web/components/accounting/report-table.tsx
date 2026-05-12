'use client';

import { cn } from '../../lib/utils';
import { MoneyDisplay } from '../ui/money-display';
import { Calculator } from 'lucide-react';

interface ReportTableProps {
  headers: string[];
  rows: Array<{
    id: string;
    cells: Array<{
      value: any;
      type?: 'text' | 'currency' | 'date';
      bold?: boolean;
      indent?: number;
      align?: 'left' | 'right' | 'center';
    }>;
    isHeader?: boolean;
    isFooter?: boolean;
    className?: string;
  }>;
}

export function ReportTable({ headers, rows }: ReportTableProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NP', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm border-separate border-spacing-0">
        <thead>
          <tr className="bg-slate-50">
            {headers.map((header, index) => (
              <th
                key={header}
                className={cn(
                  "border-b border-slate-200 px-4 py-3 text-[0.65rem] font-black uppercase tracking-widest text-slate-400 first:pl-6 last:pr-6",
                  index > 2 ? "text-right" : "text-left"
                )}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row) => (
            <tr
              key={row.id}
              className={cn(
                "group transition-colors hover:bg-slate-50/50",
                row.isHeader && "bg-slate-50/30",
                row.isFooter && "bg-slate-50 font-bold",
                row.className
              )}
            >
              {row.cells.map((cell, index) => (
                <td
                  key={index}
                  className={cn(
                    "px-4 py-4 text-slate-600 first:pl-6 last:pr-6 whitespace-nowrap",
                    cell.bold && "font-bold text-slate-900",
                    cell.align === 'right' || (index > 2 && !cell.align) ? "text-right tabular-nums" : "text-left",
                  )}
                  style={{ paddingLeft: cell.indent ? `${cell.indent * 1.5 + 1.5}rem` : undefined }}
                >
                  {cell.type === 'currency' ? (
                    <span className="font-medium tabular-nums">{formatCurrency(cell.value)}</span>
                  ) : cell.type === 'date' ? (
                    <span className="font-medium text-slate-500">{new Date(cell.value).toLocaleDateString()}</span>
                  ) : (
                    String(cell.value ?? '')
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div className="py-20 text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 text-slate-300 mb-4">
             <Calculator size={32} />
          </div>
          <p className="text-sm text-slate-500 font-bold">No financial records found</p>
          <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or selected period.</p>
        </div>
      )}
    </div>
  );
}
