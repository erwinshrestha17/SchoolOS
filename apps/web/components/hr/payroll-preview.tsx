'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { InfoIcon, Loader2, AlertTriangle, Calculator, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function PayrollPreview() {
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const [workingDays, setWorkingDays] = useState(30);

  const { data: preview, isLoading, error, refetch } = useQuery({
    queryKey: ['payroll-preview', year, month, workingDays],
    queryFn: () => api.getPayrollPreview({ year, month, workingDays }),
  });

  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end gap-4 bg-muted/50 p-4 rounded-lg border">
        <div className="grid gap-2">
          <Label htmlFor="year">Year</Label>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger id="year" className="w-[120px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="month">Month</Label>
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger id="month" className="w-[180px]">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m.value} value={String(m.value)}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="workingDays">Working Days</Label>
          <Input
            id="workingDays"
            type="number"
            min={1}
            max={31}
            value={workingDays}
            onChange={(e) => setWorkingDays(Number(e.target.value))}
            className="w-[120px]"
          />
        </div>

        <Button onClick={() => refetch()} disabled={isLoading} variant="secondary">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
          Recalculate
        </Button>
      </div>

      <Alert variant="warning" className="bg-amber-50 border-amber-200 text-amber-900">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertTitle className="font-semibold">Preview Only</AlertTitle>
        <AlertDescription>
          This is a draft payroll calculation for informational purposes. No accounting entries, salary slips, 
          or payroll runs are created from this screen. To process payroll, go to the <strong>Payroll Approval</strong> workflow (Phase 2D).
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Payroll Breakdown</CardTitle>
            <CardDescription>
              Calculations based on staff contracts, attendance, and approved leave for {months.find(m => m.value === month)?.label} {year}.
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs uppercase tracking-wider">
            Draft Preview
          </Badge>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-4" />
              <p>Calculating payroll preview...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-destructive">
              <AlertTriangle className="h-8 w-8 mb-4" />
              <p>Failed to load payroll preview. Please try again.</p>
            </div>
          ) : !preview || preview.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-center">
              <FileText className="h-12 w-12 mb-4 opacity-20" />
              <p className="text-lg font-medium">No staff data available</p>
              <p className="text-sm">Ensure staff members have active contracts and attendance records.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[200px]">Staff Member</TableHead>
                    <TableHead className="text-right">Base Salary</TableHead>
                    <TableHead className="text-right">Allowances</TableHead>
                    <TableHead className="text-right">Gross Pay</TableHead>
                    <TableHead className="text-center">Days (P+L/W)</TableHead>
                    <TableHead className="text-right">Deductions</TableHead>
                    <TableHead className="text-right font-bold text-foreground">Net Pay</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((row) => (
                    <TableRow key={row.staffId} className="group">
                      <TableCell>
                        <div className="font-medium">{row.fullName}</div>
                        <div className="text-xs text-muted-foreground">{row.employeeId}</div>
                        {row.warnings.length > 0 && (
                          <div className="mt-1 flex flex-col gap-1">
                            {row.warnings.map((w, i) => (
                              <div key={i} className="text-[10px] text-amber-600 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                {w}
                              </div>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {row.baseSalary.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {row.allowances.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {row.grossPay.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-sm">
                            {row.presentDays + row.approvedPaidLeaveDays}/{row.workingDays}
                          </span>
                          <div className="flex gap-1 mt-1">
                            <Badge variant="secondary" className="text-[9px] px-1 h-4">
                              {row.presentDays}P
                            </Badge>
                            {row.approvedPaidLeaveDays > 0 && (
                              <Badge variant="outline" className="text-[9px] px-1 h-4 text-blue-600 border-blue-200 bg-blue-50">
                                {row.approvedPaidLeaveDays}L
                              </Badge>
                            )}
                            {row.unpaidLeaveDays > 0 && (
                              <Badge variant="destructive" className="text-[9px] px-1 h-4">
                                {row.unpaidLeaveDays}U
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-destructive/80">
                        -{row.deductions.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary">
                        {row.netPay.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <InfoIcon className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
