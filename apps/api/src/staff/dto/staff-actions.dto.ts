import { StaffDocumentKind } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class AddStaffDocumentDto {
  @IsEnum(StaffDocumentKind)
  kind!: StaffDocumentKind;

  @IsUUID()
  fileId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class VerifyStaffDocumentDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class TerminateStaffDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsOptional()
  @IsString()
  effectiveDate?: string;
}

export class ContractExpiryReminderQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(180)
  days?: number;
}
