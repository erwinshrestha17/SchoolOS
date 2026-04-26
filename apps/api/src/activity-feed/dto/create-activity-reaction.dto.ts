import { ActivityReactionType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateActivityReactionDto {
  @IsEnum(ActivityReactionType)
  reaction!: ActivityReactionType;

  @IsOptional()
  @IsString()
  guardianId?: string;

  @IsOptional()
  @IsString()
  studentId?: string;
}
