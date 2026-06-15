import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateDataExportJobDto {
  @IsString()
  @IsNotEmpty()
  exportKey!: string;

  @IsString()
  @IsNotEmpty()
  format!: string;

  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
