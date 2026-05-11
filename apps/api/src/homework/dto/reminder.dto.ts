import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum HomeworkReminderType {
  HOMEWORK_PUBLISHED = 'HOMEWORK_PUBLISHED',
  HOMEWORK_DUE_SOON = 'HOMEWORK_DUE_SOON',
  HOMEWORK_OVERDUE = 'HOMEWORK_OVERDUE',
  HOMEWORK_RETURNED_FOR_CORRECTION = 'HOMEWORK_RETURNED_FOR_CORRECTION',
  HOMEWORK_REVIEWED = 'HOMEWORK_REVIEWED',
}

export class SendHomeworkReminderDto {
  @IsEnum(HomeworkReminderType)
  reminderType!: HomeworkReminderType;

  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}

export class HomeworkReminderQueryDto {
  @IsOptional()
  @IsString()
  homeworkId?: string;

  @IsOptional()
  @IsString()
  reminderType?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsISO8601()
  fromDate?: string;

  @IsOptional()
  @IsISO8601()
  toDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
