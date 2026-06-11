import { StudentDocumentKind } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UploadStudentDocumentDto {
  @IsOptional()
  @IsString()
  studentId?: string;

  @IsEnum(StudentDocumentKind)
  kind!: StudentDocumentKind;

  @IsOptional()
  @IsString()
  title?: string;

  @IsString()
  fileName!: string;

  @IsString()
  contentType!: string;

  @IsString()
  @MinLength(1)
  base64Content!: string;
  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
