import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class TransferStudentDto {
  @IsDateString()
  @IsNotEmpty()
  transferDate!: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsBoolean()
  @IsOptional()
  waiveFeeCheck?: boolean;

  @IsString()
  @IsOptional()
  destinationSchool?: string;
}
