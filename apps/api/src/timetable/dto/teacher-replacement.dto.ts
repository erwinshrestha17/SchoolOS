import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

const REPLACEMENT_STATUSES = [
  'SCHEDULED',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
] as const;

const PENDING_WORK_KINDS = [
  'HOMEWORK_DRAFT',
  'MARK_SUBMISSION',
  'CORRECTION_REQUEST',
] as const;

const PENDING_WORK_DISPOSITIONS = ['TRANSFER', 'RETURN', 'CANCEL'] as const;

export class CreateTeacherReplacementDto {
  @IsUUID()
  sourceAssignmentId!: string;

  @IsUUID()
  replacementStaffId!: string;

  @IsDateString()
  effectiveFrom!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PendingWorkSeedDto)
  pendingWork?: PendingWorkSeedDto[];
}

export class PendingWorkSeedDto {
  @IsIn(PENDING_WORK_KINDS)
  kind!: (typeof PENDING_WORK_KINDS)[number];

  @IsUUID()
  resourceId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  resourceLabel?: string;
}

export class DisposePendingWorkDto {
  @IsIn(PENDING_WORK_DISPOSITIONS)
  disposition!: (typeof PENDING_WORK_DISPOSITIONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  dispositionNote?: string;
}

export class CancelTeacherReplacementDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class CreateReplacementHandoverNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;
}

export class CreateCoverageNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;
}

export class TeacherReplacementQueryDto {
  @IsOptional()
  @IsIn(REPLACEMENT_STATUSES)
  status?: (typeof REPLACEMENT_STATUSES)[number];

  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  limit?: number;
}
