import {
  SchoolServiceRequestPriority,
  SchoolServiceRequestStatus,
} from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class MobilePrincipalServiceRequestTriageDto {
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
