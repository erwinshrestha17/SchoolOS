'use client';

import { cn } from '../../lib/utils';
import { MoneyDisplay } from '../ui/money-display';

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
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm border-separate border-spacing-0">
        <thead>
          <tr className="bg-slate-50">
            {headers.map((header, index) => (
              <th
                key={header}
                className={cn(
                  "border-b border-slate-200 px-4 py-3 text-[0.65rem] font-bold uppercase tracking-wider text-slate-400 first:pl-6 last:pr-6",
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
                    "px-4 py-4 text-slate-600 first:pl-6 last:pr-6",
                    cell.bold && "font-bold text-slate-900",
                    cell.align === 'right' || (index > 2 && !cell.align) ? "text-right" : "text-left",
                  )}
                  style={{ paddingLeft: cell.indent ? `${cell.indent * 1.5 + 1.5}rem` : undefined }}
                >
                  {cell.type === 'currency' ? (
                    <MoneyDisplay amount={cell.value} />
                  ) : cell.type === 'date' ? (
                    new Date(cell.value).toLocaleDateString()
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
        <div className="py-12 text-center text-sm text-slate-400 font-medium">
          No data available for the selected filters.
        </div>
      )}
    </div>
  );
}
