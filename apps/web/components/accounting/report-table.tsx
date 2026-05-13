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
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-100">
      <table className="w-full text-left text-sm border-separate border-spacing-0">
        <thead className="sticky top-0 z-10">
          <tr className="bg-slate-50">
            {headers.map((header, index) => (
              <th
                key={header}
                className={cn(
                  "border-b border-slate-200 px-4 py-3.5 text-[0.65rem] font-black uppercase tracking-widest text-slate-400 first:pl-6 last:pr-6 bg-slate-50/95 backdrop-blur-sm",
                  index > 2 || header.toLowerCase().includes('debit') || header.toLowerCase().includes('credit') || header.toLowerCase().includes('balance') || header.toLowerCase().includes('amount') ? "text-right" : "text-left"
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
                row.isHeader && "bg-slate-50/40",
                row.isFooter && "bg-slate-50/80 font-black text-slate-900",
                row.className
              )}
            >
              {row.cells.map((cell, index) => {
                const isNumeric = cell.type === 'currency' || index > 2 || (typeof cell.value === 'number');
                const isRightAligned = cell.align === 'right' || (!cell.align && isNumeric);
                
                return (
                  <td
                    key={index}
                    className={cn(
                      "px-4 py-4 text-slate-600 first:pl-6 last:pr-6 whitespace-nowrap transition-colors",
                      cell.bold && "font-bold text-slate-900",
                      row.isFooter && "py-5 text-slate-900",
                      isRightAligned ? "text-right tabular-nums" : "text-left",
                    )}
                    style={{ paddingLeft: cell.indent ? `${cell.indent * 1.5 + 1.5}rem` : undefined }}
                  >
                    {cell.type === 'currency' ? (
                      <MoneyDisplay amount={cell.value} className={cn("font-bold", cell.value < 0 && "text-rose-600")} mutedZero />
                    ) : cell.type === 'date' ? (
                      <span className="font-medium text-slate-500">{new Date(cell.value).toLocaleDateString()}</span>
                    ) : (
                      String(cell.value ?? '')
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div className="py-20 text-center bg-white">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-50 text-slate-300 mb-6 border-4 border-white shadow-xl shadow-slate-200/50">
             <Calculator size={36} />
          </div>
          <p className="text-base font-black italic uppercase tracking-tight text-slate-900">No records found</p>
          <p className="text-sm font-medium text-slate-400 mt-1 max-w-xs mx-auto">Try adjusting your filters or selecting a different fiscal period.</p>
        </div>
      )}
    </div>
  );
}
