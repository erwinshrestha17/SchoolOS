import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpsertSchoolCalendarDaySettingsDto {
  @IsUUID()
  academicYearId!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  calendarDateBs!: string;

  @IsBoolean()
  isWorkingDay!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  holidayType?: string | null;
}
