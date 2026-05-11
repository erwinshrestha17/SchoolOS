import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class RequestMarkLockDto {
  @IsUUID()
  examTermId!: string;

  @IsOptional()
  @IsUUID()
  classId?: string;

  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsOptional()
  @IsUUID()
  assessmentComponentId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
