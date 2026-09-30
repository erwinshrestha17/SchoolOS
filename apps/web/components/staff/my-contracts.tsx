'use client';

import { Surface } from '@/components/schoolos';
import { formatBsDate } from '@schoolos/core';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/primitives/table';
import { FileText } from 'lucide-react';

interface MyContractsProps {
  contracts: any[];
}

export function MyContracts({ contracts = [] }: MyContractsProps) {
  if (contracts.length === 0)
    return (
      <Surface>
        <div className="p-8 text-center text-muted-foreground">
          No contract history found.
        </div>
      </Surface>
    );

  return (
    <Surface
      title={
        <>
          <span className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Employment Contracts
          </span>
        </>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Contract No</TableHead>
            <TableHead>Position</TableHead>
            <TableHead>Start Date</TableHead>
            <TableHead>End Date</TableHead>
            <TableHead>Base Salary</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contracts.map((contract) => (
            <TableRow key={contract.id}>
              <TableCell className="font-medium">
                {contract.contractNumber}
              </TableCell>
              <TableCell>{contract.position}</TableCell>
              <TableCell>{formatBsDate(contract.startDate)}</TableCell>
              <TableCell>
                {contract.endDate ? formatBsDate(contract.endDate) : 'Ongoing'}
              </TableCell>
              <TableCell>
                Rs {Number(contract.baseSalary).toLocaleString()}
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    !contract.endDate || new Date(contract.endDate) > new Date()
                      ? ('success' as any)
                      : 'secondary'
                  }
                >
                  {!contract.endDate || new Date(contract.endDate) > new Date()
                    ? 'Active'
                    : 'Expired'}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Surface>
  );
}
