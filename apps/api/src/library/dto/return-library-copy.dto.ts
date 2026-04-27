import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class ReturnLibraryCopyDto {
  @IsOptional()
  @IsString()
  returnCondition?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fineAmount?: number;

  @IsOptional()
  @IsBoolean()
  markLost?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
