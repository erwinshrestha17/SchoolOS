import { IsString } from 'class-validator';

export class MergeDuplicateStudentDto {
  @IsString()
  sourceStudentId!: string;

  @IsString()
  targetStudentId!: string;

  @IsString()
  reason!: string;
}
