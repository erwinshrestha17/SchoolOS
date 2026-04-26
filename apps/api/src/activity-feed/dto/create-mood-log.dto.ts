import { MoodValue } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateMoodLogDto {
  @IsString()
  classId!: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsOptional()
  @IsString()
  studentId?: string;

  @IsEnum(MoodValue)
  mood!: MoodValue;

  @IsOptional()
  @IsString()
  note?: string;

  @IsDateString()
  logDate!: string;
}
