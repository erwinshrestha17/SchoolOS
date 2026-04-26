import { StudentDocumentKind } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class UploadStudentDocumentDto {
  @IsString()
  studentId!: string;

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
}
