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

class MarkEntryItem {
  @IsString()
  studentId!: string;

  @IsNumber()
  @Min(0)
  marksObtained!: number;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class BatchEnterMarksDto {
  @IsString()
  examTermId!: string;

  @IsString()
  assessmentComponentId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MarkEntryItem)
  @ArrayMinSize(1)
  entries!: MarkEntryItem[];
}
