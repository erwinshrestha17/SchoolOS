import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  CurriculumProgressStatus,
  FormativeAssessmentKind,
  LearningMasteryStatus,
  LearningOutcomeDomain,
  ParentLearningGuidanceStatus,
  RemedialGroupStatus,
  StudentInterventionEntryType,
  StudentInterventionPriority,
  StudentInterventionStatus,
} from '@prisma/client';

export class LearningImprovementPageDto {
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

export class LearningScopeQueryDto extends LearningImprovementPageDto {
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

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
  studentId?: string;
}

export class ListLearningOutcomesDto extends LearningScopeQueryDto {
  @IsOptional()
  @IsEnum(LearningOutcomeDomain)
  domain?: LearningOutcomeDomain;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}

export class CreateLearningOutcomeDto {
  @IsUUID()
  academicYearId!: string;

  @IsUUID()
  classId!: string;

  @IsUUID()
  subjectId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  code!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsEnum(LearningOutcomeDomain)
  domain!: LearningOutcomeDomain;
}

export class SetLearningOutcomeStateDto {
  @IsBoolean()
  isActive!: boolean;
}

export class ListFormativeAssessmentsDto extends LearningScopeQueryDto {
  @IsOptional()
  @IsUUID()
  outcomeId?: string;

  @IsOptional()
  @IsEnum(LearningMasteryStatus)
  masteryStatus?: LearningMasteryStatus;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class CreateFormativeAssessmentDto {
  @IsUUID()
  outcomeId!: string;

  @IsUUID()
  studentId!: string;

  @IsUUID()
  academicYearId!: string;

  @IsUUID()
  classId!: string;

  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @IsUUID()
  subjectId!: string;

  @IsEnum(FormativeAssessmentKind)
  kind!: FormativeAssessmentKind;

  @IsEnum(LearningMasteryStatus)
  masteryStatus!: LearningMasteryStatus;

  @ValidateIf(
    (value: CreateFormativeAssessmentDto) => value.score !== undefined,
  )
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  score?: number;

  @ValidateIf(
    (value: CreateFormativeAssessmentDto) => value.maxScore !== undefined,
  )
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  maxScore?: number;

  @IsDateString()
  assessedOn!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @IsObject()
  observationChecklist?: Record<string, boolean>;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  parentSummary?: string;

  @IsOptional()
  @IsUUID()
  reassessmentOfId?: string;

  @IsUUID()
  clientSubmissionId!: string;
}

export class EarlyWarningQueryDto extends LearningScopeQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(StudentInterventionStatus)
  interventionStatus?: StudentInterventionStatus;
}

export class ListStudentInterventionsDto extends LearningScopeQueryDto {
  @IsOptional()
  @IsEnum(StudentInterventionStatus)
  status?: StudentInterventionStatus;

  @IsOptional()
  @IsEnum(StudentInterventionPriority)
  priority?: StudentInterventionPriority;

  @IsOptional()
  @IsUUID()
  ownerStaffId?: string;
}

export class CreateStudentInterventionDto {
  @IsUUID()
  studentId!: string;

  @IsUUID()
  academicYearId!: string;

  @IsOptional()
  @IsUUID()
  ownerStaffId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  sourceSignalKey?: string;

  @IsEnum(StudentInterventionPriority)
  priority!: StudentInterventionPriority;

  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(1200)
  concernSummary!: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  parentVisibleSummary?: string;

  @IsOptional()
  @IsDateString()
  nextFollowUpOn?: string;

  @IsUUID()
  clientRequestId!: string;
}

export class AddStudentInterventionEntryDto {
  @IsEnum(StudentInterventionEntryType)
  entryType!: StudentInterventionEntryType;

  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  body!: string;

  @IsBoolean()
  parentVisible!: boolean;

  @IsOptional()
  @IsDateString()
  contactedAt?: string;

  @IsOptional()
  @IsDateString()
  nextFollowUpOn?: string;

  @IsUUID()
  clientRequestId!: string;
}

export class UpdateStudentInterventionDto {
  @IsEnum(StudentInterventionStatus)
  status!: StudentInterventionStatus;

  @IsOptional()
  @IsUUID()
  ownerStaffId?: string;

  @IsOptional()
  @IsEnum(StudentInterventionPriority)
  priority?: StudentInterventionPriority;

  @IsOptional()
  @IsDateString()
  nextFollowUpOn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  parentVisibleSummary?: string;

  @ValidateIf(
    (value: UpdateStudentInterventionDto) =>
      value.status === StudentInterventionStatus.RESOLVED ||
      value.status === StudentInterventionStatus.CLOSED,
  )
  @IsString()
  @MinLength(8)
  @MaxLength(1200)
  resolutionSummary?: string;

  @IsString()
  @MinLength(4)
  @MaxLength(600)
  reason!: string;

  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class ListRemedialGroupsDto extends LearningScopeQueryDto {
  @IsOptional()
  @IsEnum(RemedialGroupStatus)
  status?: RemedialGroupStatus;
}

export class CreateRemedialGroupDto {
  @IsUUID()
  academicYearId!: string;

  @IsUUID()
  classId!: string;

  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @IsUUID()
  subjectId!: string;

  @IsOptional()
  @IsUUID()
  outcomeId?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(1000)
  purpose!: string;

  @IsDateString()
  startsOn!: string;

  @IsOptional()
  @IsDateString()
  endsOn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  scheduleNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  parentSummary?: string;

  @IsUUID()
  clientRequestId!: string;
}

export class AddRemedialGroupMembersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID(undefined, { each: true })
  studentIds!: string[];
}

export class UpdateRemedialGroupStatusDto {
  @IsEnum(RemedialGroupStatus)
  status!: RemedialGroupStatus;

  @IsString()
  @MinLength(4)
  @MaxLength(600)
  reason!: string;
}

export class ListCurriculumProgressDto extends LearningScopeQueryDto {
  @IsOptional()
  @IsEnum(CurriculumProgressStatus)
  status?: CurriculumProgressStatus;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class CreateCurriculumProgressDto {
  @IsUUID()
  academicYearId!: string;

  @IsUUID()
  classId!: string;

  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @IsUUID()
  subjectId!: string;

  @IsOptional()
  @IsUUID()
  outcomeId?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(180)
  title!: string;

  @IsEnum(CurriculumProgressStatus)
  status!: CurriculumProgressStatus;

  @IsDateString()
  plannedOn!: string;

  @ValidateIf(
    (value: CreateCurriculumProgressDto) =>
      value.status === CurriculumProgressStatus.COMPLETED,
  )
  @IsDateString()
  completedOn?: string;

  @ValidateIf(
    (value: CreateCurriculumProgressDto) =>
      value.status === CurriculumProgressStatus.MISSED ||
      value.status === CurriculumProgressStatus.RETEACH_REQUIRED,
  )
  @IsString()
  @MinLength(4)
  @MaxLength(600)
  missedReason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  reteachPlan?: string;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(500)
  resourceUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsUUID()
  clientRequestId!: string;
}

export class UpdateCurriculumProgressDto {
  @IsEnum(CurriculumProgressStatus)
  status!: CurriculumProgressStatus;

  @ValidateIf(
    (value: UpdateCurriculumProgressDto) =>
      value.status === CurriculumProgressStatus.COMPLETED,
  )
  @IsDateString()
  completedOn?: string;

  @ValidateIf(
    (value: UpdateCurriculumProgressDto) =>
      value.status === CurriculumProgressStatus.MISSED ||
      value.status === CurriculumProgressStatus.RETEACH_REQUIRED,
  )
  @IsString()
  @MinLength(4)
  @MaxLength(600)
  missedReason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  reteachPlan?: string;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(500)
  resourceUrl?: string;

  @IsString()
  @MinLength(4)
  @MaxLength(600)
  reason!: string;
}

export class ListParentLearningGuidanceDto extends LearningScopeQueryDto {
  @IsOptional()
  @IsEnum(ParentLearningGuidanceStatus)
  status?: ParentLearningGuidanceStatus;
}

export class CreateParentLearningGuidanceDto {
  @IsUUID()
  studentId!: string;

  @IsUUID()
  academicYearId!: string;

  @IsUUID()
  subjectId!: string;

  @IsOptional()
  @IsUUID()
  outcomeId?: string;

  @IsOptional()
  @IsUUID()
  remedialGroupId?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(1000)
  skillExplanation!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(1000)
  homeActivity!: string;

  @IsOptional()
  @IsDateString()
  visibleFrom?: string;

  @IsOptional()
  @IsDateString()
  visibleUntil?: string;

  @IsUUID()
  clientRequestId!: string;
}

export class UpdateParentLearningGuidanceStatusDto {
  @IsEnum(ParentLearningGuidanceStatus)
  status!: ParentLearningGuidanceStatus;

  @IsString()
  @MinLength(4)
  @MaxLength(600)
  reason!: string;
}
