import {
  ArrayMinSize,
  IsArray,
  IsDecimal,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class CreateFeePlanItemDto {
  @IsString()
  feeHeadId!: string;

  @IsDecimal({ decimal_digits: '1,2', force_decimal: false })
  amount!: string;
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
