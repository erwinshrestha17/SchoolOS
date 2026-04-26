import { ConsentType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CaptureConsentDto {
  @IsString()
  guardianId!: string;

  @IsEnum(ConsentType)
  consentType!: ConsentType;

  @IsOptional()
  @IsBoolean()
  granted?: boolean;

  @IsString()
  version!: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
