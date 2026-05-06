import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PayrollRunStatus } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { buildSimplePdf } from '../common/pdf/simple-pdf';
import { PrismaService } from '../prisma/prisma.service';

export interface SalarySlipPdfInput {
  schoolName: string;
  staffName: string;
  employeeId: string;
  periodMonth: number;
  periodYear: number;
  grossSalary: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  attendanceDays: number;
  workingDays: number;
  approvedAt: Date | null;
  status: string;
}

@Injectable()
export class PayrollSalarySlipService {
  constructor(private readonly prisma: PrismaService) {}

  async getApprovedSalarySlipPdf(
    runId: string,
    lineId: string,
    actor: AuthContext,
  ) {
    const line = await this.prisma.payrollLine.findFirst({
      where: {
        id: lineId,
        payrollRunId: runId,
        tenantId: actor.tenantId,
      },
      include: {
        staff: true,
        payrollRun: {
          include: {
            tenant: true,
          },
        },
      },
    });

    if (!line) {
      throw new NotFoundException('Payroll line not found in this tenant');
    }

    if (!canGenerateSalarySlipForRunStatus(line.payrollRun.status)) {
      throw new ConflictException(
        'Salary slips can only be generated for approved payroll runs',
      );
    }

    return buildApprovedSalarySlipPdf({
      schoolName: line.payrollRun.tenant.name,
      staffName: `${line.staff.firstName} ${line.staff.lastName}`,
      employeeId: line.staff.employeeId,
      periodMonth: line.payrollRun.periodMonth,
      periodYear: line.payrollRun.periodYear,
      grossSalary: Number(line.grossSalary),
      allowances: Number(line.allowances),
      deductions: Number(line.deductions),
      netSalary: Number(line.netSalary),
      attendanceDays: line.attendanceDays,
      workingDays: line.workingDays,
      approvedAt: line.payrollRun.approvedAt,
      status: 'Payroll Approved',
    });
  }
}

export function canGenerateSalarySlipForRunStatus(status: string) {
  return [
    PayrollRunStatus.APPROVED,
    PayrollRunStatus.POSTED,
    PayrollRunStatus.PAID,
  ].some((allowedStatus) => allowedStatus === status);
}

export function buildApprovedSalarySlipPdf(input: SalarySlipPdfInput) {
  return buildSimplePdf(buildApprovedSalarySlipLines(input));
}

export function buildApprovedSalarySlipLines(input: SalarySlipPdfInput) {
  return [
    input.schoolName,
    'Salary Slip',
    `Status: ${input.status}`,
    `Employee: ${input.staffName}`,
    `Employee ID: ${input.employeeId}`,
    `Payroll Period: ${input.periodMonth}/${input.periodYear}`,
    `Gross Salary: Rs ${input.grossSalary.toFixed(2)}`,
    `Allowances: Rs ${input.allowances.toFixed(2)}`,
    `Deductions: Rs ${input.deductions.toFixed(2)}`,
    `Net Salary: Rs ${input.netSalary.toFixed(2)}`,
    `Attendance Days: ${input.attendanceDays}/${input.workingDays}`,
    `Approved Date: ${
      input.approvedAt ? input.approvedAt.toISOString().slice(0, 10) : 'N/A'
    }`,
    'Note: This salary slip is generated from an approved payroll run only.',
    'No M9 accounting journal entry or salary disbursement is created by this PDF.',
  ];
}
