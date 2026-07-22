import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export const MAX_ADMISSION_IMPORT_CHARACTERS = 1_000_000;
export const MAX_ADMISSION_IMPORT_ROWS = 500;

export class BulkAdmissionImportDto {
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_ADMISSION_IMPORT_CHARACTERS)
  csvContent!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  sourceFileName?: string;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @IsOptional()
  @IsBoolean()
  confirmDuplicates?: boolean;

  @IsOptional()
  @IsUUID()
  validationBatchId?: string;
}
