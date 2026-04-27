import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateFeeDueScheduleDto {
  @IsString()
  academicYearId!: string;

  @IsOptional()
  @IsString()
  feePlanId?: string;

  @IsString()
  name!: string;

  @IsString()
  scheduleType!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  runMonth?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  runYear?: number;

  @IsDateString()
  dueDate!: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(0, { each: true })
  reminderDays?: number[];

  @IsOptional()
  @IsBoolean()
  stopOnPaid?: boolean;
}
