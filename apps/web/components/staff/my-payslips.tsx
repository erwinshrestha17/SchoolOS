'use client';

import { useState, useEffect } from 'react';
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
import { Download, FileText, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import { Toast } from '@/components/ui/toast';

export function MyPayslips() {
  const [payslips, setPayslips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    api.listMyPayslips()
      .then(data => {
        setPayslips(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch payslips', err);
        setLoading(false);
      });
  }, []);

  const downloadPdf = async (payslipNumber: string) => {
    try {
      await api.openMyPayslipPdf(payslipNumber);
    } catch (error) {
      console.error('Download failed', error);
      setDownloadError('Failed to download payslip. Please try again.');
    }
  };

  if (loading) return (
    <div className="flex justify-center p-8">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
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
                  {slip.payrollRun.periodMonth}/{slip.payrollRun.periodYear}
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
                    onClick={() => downloadPdf(slip.payslipNumber)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    PDF
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
