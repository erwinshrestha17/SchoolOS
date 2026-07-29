import {
  SchoolServiceRequestCategory,
  SchoolServiceRequestNoteVisibility,
  SchoolServiceRequestPriority,
  SchoolServiceRequestStatus,
  SchoolServiceRequestType,
} from '@prisma/client';
import {
  IsBase64,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ConfirmStudentActionFields } from '../../common/security/confirm-student-action';

export class CreateSchoolServiceRequestDto extends ConfirmStudentActionFields {
  @IsEnum(SchoolServiceRequestType)
  type!: SchoolServiceRequestType;

  @IsEnum(SchoolServiceRequestCategory)
  category!: SchoolServiceRequestCategory;

  @IsOptional()
  @IsEnum(SchoolServiceRequestPriority)
  priority?: SchoolServiceRequestPriority;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(120)
  subject!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(2000)
  description!: string;

  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @IsUUID()
  idempotencyKey!: string;
}

export class ListSchoolServiceRequestsDto {
  @IsOptional()
  @IsEnum(SchoolServiceRequestStatus)
  status?: SchoolServiceRequestStatus;

  @IsOptional()
  @IsEnum(SchoolServiceRequestType)
  type?: SchoolServiceRequestType;

  @IsOptional()
  @IsEnum(SchoolServiceRequestPriority)
  priority?: SchoolServiceRequestPriority;

  @IsOptional()
  @IsUUID()
  assignedToId?: string;

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

export class TriageSchoolServiceRequestDto {
  @IsUUID()
  assignedToUserId!: string;

  @IsEnum(SchoolServiceRequestPriority)
  priority!: SchoolServiceRequestPriority;

  @IsDateString()
  responseDeadline!: string;

  @IsEnum(SchoolServiceRequestStatus)
  @IsIn([
    SchoolServiceRequestStatus.ASSIGNED,
    SchoolServiceRequestStatus.IN_PROGRESS,
  ])
  status!: SchoolServiceRequestStatus;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(500)
  reason!: string;
}

export class AddSchoolServiceRequestNoteDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(1000)
  body!: string;

  @IsEnum(SchoolServiceRequestNoteVisibility)
  visibility!: SchoolServiceRequestNoteVisibility;
}

export class ResolveSchoolServiceRequestDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(2000)
  resolutionSummary!: string;
}

export class ReasonedSchoolServiceRequestDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(500)
  reason!: string;
}

export class UploadSchoolServiceRequestAttachmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  fileName!: string;

  @IsString()
  @IsIn(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
  contentType!: string;

  @IsBase64()
  @MaxLength(7_000_000)
  base64Content!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;
}
