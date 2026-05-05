'use client';

import { useQuery } from '@tanstack/react-query';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Loader2, FileText } from 'lucide-react';
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-600" />
            Journal Entry {entry?.entryNumber}
          </DialogTitle>
          <DialogDescription>
            Recorded on {entry ? new Date(entry.entryDate).toLocaleDateString() : '...'}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : entry ? (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-xl text-sm">
              <p><span className="text-muted-foreground">Narration:</span> {entry.narration}</p>
              <p><span className="text-muted-foreground">Source:</span> {entry.sourceType} ({entry.sourceId || 'N/A'})</p>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entry.lines.map((line: any) => (
                  <TableRow key={line.id}>
                    <TableCell>
                      <p className="font-medium">{line.chartAccount.name}</p>
                      <p className="text-[10px] text-muted-foreground">{line.chartAccount.code}</p>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {line.side === 'DEBIT' ? Number(line.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {line.side === 'CREDIT' ? Number(line.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="p-8 text-center text-muted-foreground">
            Failed to load journal entry details.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
