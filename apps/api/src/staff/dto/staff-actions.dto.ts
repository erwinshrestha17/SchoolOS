import { StaffDocumentKind } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
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
