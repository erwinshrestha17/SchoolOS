import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class MergeDuplicateStudentDto {
  @IsString()
  @IsNotEmpty()
  sourceStudentId!: string;

  @IsString()
  @IsNotEmpty()
  targetStudentId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
