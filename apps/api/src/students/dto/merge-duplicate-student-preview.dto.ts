import { IsNotEmpty, IsString } from 'class-validator';

export class MergeDuplicateStudentPreviewDto {
  @IsString()
  @IsNotEmpty()
  sourceStudentId!: string;

  @IsString()
  @IsNotEmpty()
  targetStudentId!: string;
}
