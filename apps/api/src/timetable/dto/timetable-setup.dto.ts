import {
  TeacherAvailabilityType,
  TimetableSubstitutionStatus,
  TimetableVersionStatus,
} from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PaginatedQueryDto {
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

export class CreateTimetablePeriodDto {
  @IsString()
  academicYearId!: string;

  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek?: number;

  @IsString()
  startsAt!: string;

  @IsString()
  endsAt!: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateTimetablePeriodDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek?: number;

  @IsOptional()
  @IsString()
  startsAt?: string;

  @IsOptional()
  @IsString()
  endsAt?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateRoomDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  code?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;
}

export class UpdateRoomDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  code?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class TimetableVersionQueryDto extends PaginatedQueryDto {
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
  @IsEnum(TimetableVersionStatus)
  status?: TimetableVersionStatus;
}

export class CreateTimetableVersionDto {
  @IsString()
  academicYearId!: string;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsString()
  @MaxLength(120)
  versionName!: string;

  @IsISO8601()
  effectiveFrom!: string;

  @IsOptional()
  @IsISO8601()
  effectiveTo?: string;
}

export class CreateVersionSlotDto {
  @IsString()
  classId!: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsString()
  subjectId!: string;

  @IsString()
  staffId!: string;

  @IsOptional()
  @IsString()
  periodId?: string;

  @IsOptional()
  @IsString()
  roomId?: string;

  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek!: number;

  @IsString()
  startsAt!: string;

  @IsString()
  endsAt!: string;
}

export class UpdateVersionSlotDto {
  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  @IsString()
  staffId?: string;

  @IsOptional()
  @IsString()
  periodId?: string;

  @IsOptional()
  @IsString()
  roomId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek?: number;

  @IsOptional()
  @IsString()
  startsAt?: string;

  @IsOptional()
  @IsString()
  endsAt?: string;
}

export class CreateTeacherAvailabilityDto {
  @IsOptional()
  @IsString()
  academicYearId?: string;

  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek!: number;

  @IsString()
  startsAt!: string;

  @IsString()
  endsAt!: string;

  @IsOptional()
  @IsEnum(TeacherAvailabilityType)
  type?: TeacherAvailabilityType;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class UpdateTeacherAvailabilityDto {
  @IsOptional()
  @IsString()
  academicYearId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek?: number;

  @IsOptional()
  @IsString()
  startsAt?: string;

  @IsOptional()
  @IsString()
  endsAt?: string;

  @IsOptional()
  @IsEnum(TeacherAvailabilityType)
  type?: TeacherAvailabilityType;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class TeacherAvailabilityDto extends CreateTeacherAvailabilityDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  maxPeriodsPerDay?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxPeriodsPerWeek?: number;
}

export class ListTeacherAvailabilityQueryDto extends PaginatedQueryDto {
  @IsOptional()
  @IsString()
  staffId?: string;

  @IsOptional()
  @IsString()
  academicYearId?: string;
}

export class UpsertTeacherWorkloadLimitDto {
  @IsOptional()
  @IsString()
  academicYearId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxPeriodsPerDay?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxPeriodsPerWeek?: number;
}

export class ListTeacherWorkloadQueryDto extends PaginatedQueryDto {
  @IsOptional()
  @IsString()
  academicYearId?: string;
}

export class WorkloadQueryDto {
  @IsOptional()
  @IsString()
  academicYearId?: string;

  @IsOptional()
  @IsString()
  versionId?: string;
}

export class SubstitutionQueryDto extends PaginatedQueryDto {
  @IsOptional()
  @IsISO8601()
  date?: string;

  @IsOptional()
  @IsString()
  teacherId?: string;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsOptional()
  @IsEnum(TimetableSubstitutionStatus)
  status?: TimetableSubstitutionStatus;
}

export class CreateSubstitutionDto {
  @IsString()
  timetableSlotId!: string;

  @IsString()
  absentTeacherId!: string;

  @IsOptional()
  @IsString()
  substituteTeacherId?: string;

  @IsISO8601()
  date!: string;

  @IsString()
  @MaxLength(500)
  reason!: string;
}

export class UpdateSubstitutionDto {
  @IsOptional()
  @IsString()
  substituteTeacherId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class AssignSubstitutionDto {
  @IsString()
  substituteTeacherId!: string;
}

export class CreateSubjectWeeklyRequirementDto {
  @IsString()
  academicYearId!: string;

  @IsString()
  classId!: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsString()
  subjectId!: string;

  @IsInt()
  @Min(1)
  requiredPeriodsPerWeek!: number;
}

export class UpdateSubjectWeeklyRequirementDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  requiredPeriodsPerWeek?: number;
}

export class ListSubjectWeeklyRequirementQueryDto extends PaginatedQueryDto {
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
  @IsString()
  subjectId?: string;
}
