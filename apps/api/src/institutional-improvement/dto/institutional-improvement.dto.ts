import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  SchoolImprovementActionStatus,
  SchoolImprovementPlanStatus,
  TeacherDevelopmentGoalStatus,
  TeacherObservationStatus,
  TeacherTrainingStatus,
} from '@prisma/client';

export class InstitutionalPageDto {
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

export class TeacherDevelopmentQueryDto extends InstitutionalPageDto {
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsUUID()
  teacherStaffId?: string;
}

export class ListTeacherObservationsDto extends TeacherDevelopmentQueryDto {
  @IsOptional()
  @IsEnum(TeacherObservationStatus)
  status?: TeacherObservationStatus;
}

export class CreateTeacherObservationDto {
  @IsUUID()
  teacherStaffId!: string;

  @IsUUID()
  academicYearId!: string;

  @IsOptional()
  @IsUUID()
  classId?: string;

  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsOptional()
  @IsUUID()
  timetableSlotId?: string;

  @IsDateString()
  observedOn!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(2000)
  strengths!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(2000)
  developmentFocus!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  agreedAction?: string;

  @IsOptional()
  @IsDateString()
  followUpOn?: string;

  @IsUUID()
  clientRequestId!: string;
}

export class UpdateTeacherObservationDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsEnum(TeacherObservationStatus)
  status!: TeacherObservationStatus;

  @IsString()
  @MinLength(4)
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  agreedAction?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  teacherResponse?: string;

  @IsOptional()
  @IsDateString()
  followUpOn?: string;
}

export class ListTeacherGoalsDto extends TeacherDevelopmentQueryDto {
  @IsOptional()
  @IsEnum(TeacherDevelopmentGoalStatus)
  status?: TeacherDevelopmentGoalStatus;
}

export class CreateTeacherGoalDto {
  @IsUUID()
  teacherStaffId!: string;

  @IsOptional()
  @IsUUID()
  mentorStaffId?: string;

  @IsUUID()
  academicYearId!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(180)
  title!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(2000)
  baseline!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(2000)
  target!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(3000)
  actionPlan!: string;

  @IsDateString()
  startsOn!: string;

  @IsDateString()
  dueOn!: string;

  @IsUUID()
  clientRequestId!: string;
}

export class UpdateTeacherGoalDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsEnum(TeacherDevelopmentGoalStatus)
  status!: TeacherDevelopmentGoalStatus;

  @IsString()
  @MinLength(4)
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsUUID()
  mentorStaffId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  progressNote?: string;
}

export class ListTeacherTrainingDto extends TeacherDevelopmentQueryDto {
  @IsOptional()
  @IsEnum(TeacherTrainingStatus)
  status?: TeacherTrainingStatus;
}

export class CreateTeacherTrainingDto {
  @IsUUID()
  teacherStaffId!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(180)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  providerName?: string;

  @IsDateString()
  startsOn!: string;

  @IsOptional()
  @IsDateString()
  endsOn?: string;

  @IsEnum(TeacherTrainingStatus)
  status!: TeacherTrainingStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  learningSummary?: string;

  @IsOptional()
  @IsUUID()
  certificateFileAssetId?: string;

  @IsUUID()
  clientRequestId!: string;
}

export class ListSchoolImprovementPlansDto extends InstitutionalPageDto {
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsEnum(SchoolImprovementPlanStatus)
  status?: SchoolImprovementPlanStatus;
}

export class CreateSchoolImprovementKpiDto {
  @IsUUID()
  ownerUserId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  unit!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  baselineValue!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  targetValue!: number;

  @IsDateString()
  dueOn!: string;
}

export class CreateSchoolImprovementActionDto {
  @IsUUID()
  ownerUserId!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(180)
  title!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(2500)
  details!: string;

  @IsDateString()
  dueOn!: string;
}

export class CreateSchoolImprovementPlanDto {
  @IsUUID()
  academicYearId!: string;

  @IsUUID()
  ownerUserId!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(180)
  title!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(3000)
  baselineSummary!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(3000)
  targetSummary!: string;

  @IsDateString()
  startsOn!: string;

  @IsDateString()
  endsOn!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CreateSchoolImprovementKpiDto)
  kpis!: CreateSchoolImprovementKpiDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateSchoolImprovementActionDto)
  actions!: CreateSchoolImprovementActionDto[];

  @IsUUID()
  clientRequestId!: string;
}

export class UpdateSchoolImprovementPlanDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsEnum(SchoolImprovementPlanStatus)
  status!: SchoolImprovementPlanStatus;

  @IsString()
  @MinLength(4)
  @MaxLength(500)
  reason!: string;
}

export class UpdateSchoolImprovementActionDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsEnum(SchoolImprovementActionStatus)
  status!: SchoolImprovementActionStatus;

  @IsString()
  @MinLength(4)
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  progressNote?: string;

  @IsOptional()
  @IsUUID()
  evidenceFileAssetId?: string;
}

export class SchoolImprovementKpiSnapshotDto {
  @IsUUID()
  kpiId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  value!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class AddSchoolImprovementReviewDto {
  @IsDateString()
  reviewedOn!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(3000)
  summary!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(3000)
  nextActions!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SchoolImprovementKpiSnapshotDto)
  kpiSnapshot!: SchoolImprovementKpiSnapshotDto[];

  @IsUUID()
  clientRequestId!: string;
}

export class BoardExamReadinessQueryDto {
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsIn(['GRADE_8', 'SEE', 'GRADE_12'])
  track!: 'GRADE_8' | 'SEE' | 'GRADE_12';
}

export class PrincipalInstitutionalDashboardQueryDto {
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsObject()
  filters?: Record<string, never>;
}
