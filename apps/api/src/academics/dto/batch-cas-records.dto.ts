import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class BatchCasRecordItem {
  @IsString()
  studentId!: string;

  @IsNumber()
  @Min(0)
  score!: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class BatchCasRecordsDto {
  @IsString()
  academicYearId!: string;

  @IsString()
  subjectId!: string;

  @IsString()
  classId!: string;

  @IsOptional()
  @IsString()
  sectionId?: string | null;

  @IsString()
  category!: string;

  @IsNumber()
  @Min(1)
  maxScore!: number;

  @IsString()
  observedOn!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchCasRecordItem)
  @ArrayMinSize(1)
  entries!: BatchCasRecordItem[];
}
