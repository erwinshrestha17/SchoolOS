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

class CreateFeePlanItemDto {
  @IsString()
  feeHeadId!: string;

  @IsNumber()
  @Min(0)
  amount!: number;
}

export class CreateFeePlanDto {
  @IsString()
  academicYearId!: string;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateFeePlanItemDto)
  items!: CreateFeePlanItemDto[];
}
