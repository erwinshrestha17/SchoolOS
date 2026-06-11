import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RequestReportCardCorrectionDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class ApplyReportCardCorrectionDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsOptional()
  @IsString()
  reviewNote?: string;

  @IsOptional()
  @IsBoolean()
  republish?: boolean;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class ReviewReportCardCorrectionDto {
  @IsString()
  @IsNotEmpty()
  status!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  reviewNote?: string;
}
