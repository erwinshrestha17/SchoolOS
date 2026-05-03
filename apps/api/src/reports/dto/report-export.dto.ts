import { IsString, IsEnum, IsObject, IsOptional } from 'class-validator';
import type { ReportFormat } from '@schoolos/core';

export class ReportExportDto {
  @IsEnum(['csv', 'pdf', 'json'])
  format!: ReportFormat;

  @IsObject()
  @IsOptional()
  filters: Record<string, any> = {};
}
