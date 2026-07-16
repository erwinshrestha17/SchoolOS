import * as React from "react"

export const Table = ({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) => (
  <div className="relative w-full overflow-auto">
    <table className={`w-full caption-bottom text-sm ${className}`} {...props} />
  </div>
)

export const TableHeader = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead className={`[&_tr]:border-b ${className}`} {...props} />
)

export const TableBody = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody className={`[&_tr:last-child]:border-0 ${className}`} {...props} />
)

export const TableFooter = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tfoot className={`border-t bg-gray-100/50 font-medium [&_tr]:last-child:border-0 ${className}`} {...props} />
)

export const TableRow = ({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr className={`border-b transition-colors hover:bg-[var(--hover-subtle)] data-[state=selected]:bg-[var(--mod-soft,var(--primary-soft))] ${className}`} {...props} />
)

export const TableHead = ({ className, ...props }: React.HTMLAttributes<HTMLTableCellElement>) => (
  <th className={`h-12 px-4 text-left align-middle font-medium text-gray-500 [&:has([role=checkbox])]:pr-0 ${className}`} {...props} />
)

export const TableCell = ({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={`p-4 align-middle [&:has([role=checkbox])]:pr-0 ${className}`} {...props} />
)
