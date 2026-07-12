import { IsArray, IsOptional, IsString } from 'class-validator';

export class BulkCompleteRegisterDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  studentIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeStudentIds?: string[];
}
