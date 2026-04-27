import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class RequestStudentTransferDto {
  @IsString()
  reason!: string;

  @IsOptional()
  @IsString()
  destinationSchool?: string;

  @IsOptional()
  @IsString()
  conductRemark?: string;

  @IsOptional()
  @IsDateString()
  exitedAt?: string;

  @IsOptional()
  @IsBoolean()
  waiveFeeClearance?: boolean;
}
