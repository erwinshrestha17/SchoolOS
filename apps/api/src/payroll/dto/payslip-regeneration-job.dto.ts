import { ApiProperty } from '@nestjs/swagger';

export class PayslipRegenerationJobSummaryDto {
  @ApiProperty({
    description:
      'Opaque BullMQ job id scoped to tenant, payroll run, and payslip.',
    example: 'payroll-payslip-tenant-1-run-1-payslip-1',
  })
  jobId!: string;

  @ApiProperty({ example: 'run-1' })
  payrollRunId!: string;

  @ApiProperty({ example: 'payslip-1' })
  payslipId!: string;

  @ApiProperty({ example: 'PS-2026-05-001' })
  payslipNumber!: string;

  @ApiProperty({
    enum: ['QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED'],
    example: 'QUEUED',
  })
  status!: 'QUEUED' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';

  @ApiProperty({ example: '2026-06-27T06:00:00.000Z' })
  requestedAt!: string;

  @ApiProperty({
    nullable: true,
    example: '2026-06-27T06:00:01.000Z',
  })
  startedAt!: string | null;

  @ApiProperty({
    nullable: true,
    example: '2026-06-27T06:00:02.000Z',
  })
  completedAt!: string | null;

  @ApiProperty({ nullable: true, example: 1 })
  generated!: number | null;

  @ApiProperty({ nullable: true, example: 0 })
  skipped!: number | null;

  @ApiProperty({ nullable: true, example: 1 })
  payslipCount!: number | null;
}
