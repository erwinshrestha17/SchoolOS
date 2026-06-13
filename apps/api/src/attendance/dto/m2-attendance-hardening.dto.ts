import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateM2AttendancePolicyDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  @Type(() => Number)
  lockOverrideMinReasonLength?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  @Type(() => Number)
  correctionReviewMinReasonLength?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  repeatedAbsenceThreshold?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  @Type(() => Number)
  lateFollowUpThreshold?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  @Type(() => Number)
  cutoffHour?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(59)
  @Type(() => Number)
  cutoffMinute?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  parentNotificationChannels?: string[];

  @IsOptional()
  @IsBoolean()
  notifyParentsForLate?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyParentsForAbsence?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  absenceMessageTemplate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  lateMessageTemplate?: string;
}

export class M2AttendanceWindowDto {
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  sectionId?: string;
}

export class RunAttendanceCutoffDto {
  @IsOptional()
  @IsDateString()
  attendanceDate?: string;

  @IsOptional()
  @IsString()
  academicYearId?: string;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export class RepeatedAbsenceFollowUpDto extends M2AttendanceWindowDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  @Type(() => Number)
  threshold?: number;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export class UpsertM2CalendarPolicyDayDto {
  @IsDateString()
  calendarDate!: string;

  @IsOptional()
  @IsBoolean()
  isWorkingDay?: boolean;

  @IsOptional()
  @IsBoolean()
  isExamDay?: boolean;

  @IsOptional()
  @IsBoolean()
  isSchoolEvent?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  holidayType?: string;

  @IsOptional()
  @IsObject()
  policyMetadata?: Record<string, unknown>;
}

export class OfflineSyncConflictRulesDto extends M2AttendanceWindowDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 50;
}
