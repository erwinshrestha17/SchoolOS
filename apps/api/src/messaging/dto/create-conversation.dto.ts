import { ConversationType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateConversationDto {
  @IsEnum(ConversationType)
  type!: ConversationType;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsString()
  guardianId?: string;
}
