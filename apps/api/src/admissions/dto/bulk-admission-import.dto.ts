import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class BulkAdmissionImportDto {
  @IsString()
  @MinLength(1)
  csvContent!: string;

  @IsOptional()
  @IsString()
  sourceFileName?: string;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @IsOptional()
  @IsBoolean()
  confirmDuplicates?: boolean;
}
