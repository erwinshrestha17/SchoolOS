import { IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ExamTermStatus } from '@prisma/client';

export class ListExamTermsDto {
  @IsOptional()
  @IsString()
  academicYearId?: string;

  @IsOptional()
  @IsEnum(ExamTermStatus)
  status?: ExamTermStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
