import {
  ActivityCategory,
  ActivityPostLanguage,
  AudienceType,
} from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ActivityAttachmentInputDto {
  @IsString()
  @MinLength(2)
  fileName!: string;

  @IsString()
  @MinLength(3)
  contentType!: string;

  @IsString()
  @MinLength(1)
  base64Content!: string;
}

export class CreateActivityPostDto {
  @IsOptional()
  @IsUUID()
  clientSubmissionId?: string;

  @IsString()
  @MinLength(1)
  classId!: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsString()
  @MinLength(2)
  caption!: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  askAtHome?: string;

  @IsOptional()
  @IsDateString()
  activityDate?: string;

  @IsOptional()
  @IsBoolean()
  parentVisible?: boolean;

  @IsOptional()
  @IsEnum(ActivityPostLanguage)
  language?: ActivityPostLanguage;

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
