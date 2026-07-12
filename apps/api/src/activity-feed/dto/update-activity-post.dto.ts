import { ActivityPostLanguage } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateActivityPostDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  caption?: string;

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
}
