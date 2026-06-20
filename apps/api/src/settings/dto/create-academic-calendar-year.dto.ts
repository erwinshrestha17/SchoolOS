import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateAcademicCalendarYearDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startsOnBs!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endsOnBs!: string;

  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;
}
