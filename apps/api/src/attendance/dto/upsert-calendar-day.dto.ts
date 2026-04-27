import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class UpsertCalendarDayDto {
  @IsDateString()
  calendarDate!: string;

  @IsBoolean()
  isWorkingDay!: boolean;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  holidayType?: string;
}
