import { IsOptional, IsString, IsUUID, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class DuesQueryDto {
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsUUID()
  classId?: string;

  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @IsOptional()
  @IsUUID()
  feeHeadId?: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  year?: number;
}
