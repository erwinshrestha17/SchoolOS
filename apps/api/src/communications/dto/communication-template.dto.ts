import {
  CommunicationTemplateCategory,
  CommunicationTemplateChannel,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ListCommunicationTemplatesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class CreateCommunicationTemplateDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[a-z0-9][a-z0-9-_]*[a-z0-9]$/)
  key!: string;

  @IsEnum(CommunicationTemplateCategory)
  category!: CommunicationTemplateCategory;

  @IsEnum(CommunicationTemplateChannel)
  channel!: CommunicationTemplateChannel;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^[a-z]{2}(-[A-Z]{2})?$/)
  language?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(5000)
  body!: string;
}

export class UpdateCommunicationTemplateDto {
  @IsOptional()
  @IsEnum(CommunicationTemplateCategory)
  category?: CommunicationTemplateCategory;

  @IsOptional()
  @IsEnum(CommunicationTemplateChannel)
  channel?: CommunicationTemplateChannel;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^[a-z]{2}(-[A-Z]{2})?$/)
  language?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(5000)
  body?: string;
}
