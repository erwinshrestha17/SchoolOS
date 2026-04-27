import { PaymentMethod } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export enum ReconciliationExportFormat {
  JSON = 'json',
  CSV = 'csv',
}

export class ReconciliationQueryDto {
  @IsDateString()
  openedAt!: string;

  @IsDateString()
  closedAt!: string;

  @IsOptional()
  @IsString()
  collectorUserId?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsEnum(ReconciliationExportFormat)
  format?: ReconciliationExportFormat;
}
