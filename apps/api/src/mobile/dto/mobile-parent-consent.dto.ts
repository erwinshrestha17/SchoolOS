import { ConsentType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class MobileParentConsentDecisionDto {
  @IsUUID()
  confirmStudentId!: string;
  @IsEnum(ConsentType)
  consentType!: ConsentType;

  @IsString()
  version!: string;

  @IsBoolean()
  granted!: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
