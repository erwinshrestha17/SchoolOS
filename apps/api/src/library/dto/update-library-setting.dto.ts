import { IsNumber, IsOptional, Min } from 'class-validator';

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
  @IsNumber()
  @Min(0)
  gracePeriodDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  lostBookChargeMultiplier?: number;
}
