import { IsEnum, IsOptional, IsString } from 'class-validator';
import { StudentDocumentKind } from '@prisma/client';

export class UploadStudentDocumentDto {
  @IsEnum(StudentDocumentKind)
  kind!: StudentDocumentKind;

  @IsString()
  title!: string;

  @IsString()
  fileName!: string;

  @IsString()
  base64Content!: string;

  @IsOptional()
  @IsString()
  contentType?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
