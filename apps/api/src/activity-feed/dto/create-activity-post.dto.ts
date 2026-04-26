import { ActivityCategory, AudienceType } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ActivityAttachmentInputDto {
  @IsString()
  fileName!: string;

  @IsString()
  contentType!: string;

  @IsString()
  @MinLength(1)
  base64Content!: string;
}

export class CreateActivityPostDto {
  @IsString()
  classId!: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsString()
  title!: string;

  @IsString()
  caption!: string;

  @IsOptional()
  @IsEnum(ActivityCategory)
  category?: ActivityCategory;

  @IsOptional()
  @IsEnum(AudienceType)
  audienceType?: AudienceType;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  studentIds?: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => ActivityAttachmentInputDto)
  attachments!: ActivityAttachmentInputDto[];
}
