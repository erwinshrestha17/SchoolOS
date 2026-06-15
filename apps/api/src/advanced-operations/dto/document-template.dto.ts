import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { DocumentTemplateKind } from '@prisma/client';

export class CreateDocumentTemplateDto {
  @IsEnum(DocumentTemplateKind)
  kind!: DocumentTemplateKind;

  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  locale?: string;

  @IsString()
  @IsNotEmpty()
  body!: string;

  @IsArray()
  @IsString({ each: true })
  mergeFields!: string[];

  @IsOptional()
  @IsObject()
  headerConfig?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  footerConfig?: Record<string, unknown>;
}

export class GenerateDocumentDto {
  @IsString()
  @IsNotEmpty()
  subjectType!: string;

  @IsString()
  @IsNotEmpty()
  subjectId!: string;

  @IsObject()
  mergeData!: Record<string, unknown>;
}
