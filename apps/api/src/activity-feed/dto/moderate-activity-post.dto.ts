import { ActivityPostStatus } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ModerateActivityPostDto {
  @IsEnum(ActivityPostStatus)
  status!: ActivityPostStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class DeleteActivityPostDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
