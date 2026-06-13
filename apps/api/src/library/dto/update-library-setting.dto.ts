import { IsBoolean, IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateLibrarySettingDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  finePerDay?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxFineAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  gracePeriodDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  lostBookChargeMultiplier?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxBooksPerStudent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxBooksPerStaff?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  studentLoanDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  staffLoanDays?: number;

  @IsOptional()
  @IsBoolean()
  includeHolidaysInFine?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  reservationHoldDays?: number;
}
