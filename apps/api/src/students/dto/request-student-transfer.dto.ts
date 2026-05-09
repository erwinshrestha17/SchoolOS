import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class RequestStudentTransferDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  destinationSchool?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  conductRemark?: string;

  @IsOptional()
  @IsDateString()
  exitedAt?: string;

  @IsOptional()
  @IsBoolean()
  waiveFeeClearance?: boolean;
}
