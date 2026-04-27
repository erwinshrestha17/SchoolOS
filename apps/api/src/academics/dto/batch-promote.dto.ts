import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class BatchPromotionMapping {
  @IsString()
  fromClassId!: string;

  @IsString()
  toClassId!: string;

  @IsOptional()
  @IsString()
  toSectionId?: string;
}

export class BatchPromoteDto {
  @IsString()
  academicYearId!: string;

  @IsString()
  targetAcademicYearId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchPromotionMapping)
  classMappings!: BatchPromotionMapping[];

  @IsOptional()
  @IsString()
  remarks?: string;
}
