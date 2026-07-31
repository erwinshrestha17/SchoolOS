import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export class FinanceReportQueryDto {
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsString()
  academicYearId?: string;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsString()
  feeHeadId?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  fiscalYear?: string;

  @IsOptional()
  @IsIn(['REFUND', 'REVERSAL'])
  recordType?: 'REFUND' | 'REVERSAL';
}
