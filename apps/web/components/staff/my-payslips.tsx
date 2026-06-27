'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { ChevronLeft, ChevronRight, Download, Loader2 } from 'lucide-react';
import { ApiRequestError, api } from '../../lib/api';
import { Toast } from '@/components/ui/toast';

export function MyPayslips() {
  const [page, setPage] = useState(1);
  const limit = 10;
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadingPayslip, setDownloadingPayslip] = useState<string | null>(null);

  const payslipQuery = useQuery({
    queryKey: ['my-payslips', page, limit],
    queryFn: () => api.listMyPayslipsPage({ page, limit }),
  });
  const payslips = payslipQuery.data?.items ?? [];
  const totalItems = payslipQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));

  const downloadPdf = async (payslipNumber: string) => {
    setDownloadingPayslip(payslipNumber);
    setDownloadError(null);

    try {
      await api.openMyPayslipPdf(payslipNumber);
    } catch (error) {
      if (error instanceof ApiRequestError && error.statusCode === 409) {
        setDownloadError(
          'This payslip file is unavailable. Ask your payroll administrator to regenerate it.',
        );
      } else if (
        error instanceof ApiRequestError &&
        error.statusCode === 403
      ) {
        setDownloadError('You do not have access to this payslip.');
      } else {
        setDownloadError('Could not download this payslip. Try again later.');
      }
    } finally {
      setDownloadingPayslip(null);
    }
  };

  if (payslipQuery.isLoading) return (
    <div className="flex justify-center p-8">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (payslipQuery.isError) return (
    <Card>
      <CardContent className="p-8 text-center text-muted-foreground">
        Payslips could not be loaded. Check your staff access and try again.
      </CardContent>
    </Card>
  );

  if (payslips.length === 0) return (
    <Card>
      <CardContent className="p-8 text-center text-muted-foreground">
        No payslips found.
      </CardContent>
    </Card>
  );

  return (
    <Card>
      {downloadError ? (
        <Toast
          title="Could not download payslip"
          description={downloadError}
          tone="danger"
          onDismiss={() => setDownloadError(null)}
          className="m-4"
        />
      ) : null}
      <CardHeader>
        <CardTitle className="text-lg">My Payslips</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead>Payslip No</TableHead>
              <TableHead>Gross</TableHead>
              <TableHead>Deductions</TableHead>
              <TableHead>Net Pay</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payslips.map((slip) => (
              <TableRow key={slip.id}>
                <TableCell className="font-medium">
                  {slip.payrollRun
                    ? `${slip.payrollRun.periodMonth}/${slip.payrollRun.periodYear}`
                    : `${slip.periodMonth ?? 'Period'}/${slip.periodYear ?? 'Unavailable'}`}
                </TableCell>
                <TableCell>{slip.payslipNumber}</TableCell>
                <TableCell>Rs {Number(slip.grossSalary).toLocaleString()}</TableCell>
                <TableCell>Rs {Number(slip.deductionAmount).toLocaleString()}</TableCell>
                <TableCell className="font-bold text-green-600">
                  Rs {Number(slip.netSalary).toLocaleString()}
                </TableCell>
                <TableCell>
                  <Badge variant={slip.status === 'PAID' ? 'success' as any : 'secondary'}>
                    {slip.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    disabled={downloadingPayslip === slip.payslipNumber}
                    onClick={() => downloadPdf(slip.payslipNumber)}
                  >
                    {downloadingPayslip === slip.payslipNumber ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    Download PDF
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {totalItems > 0 ? (
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-500">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, totalItems)} of {totalItems} payslips
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
