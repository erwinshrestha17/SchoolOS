import { ConsentType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class MobileParentConsentDecisionDto {
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
