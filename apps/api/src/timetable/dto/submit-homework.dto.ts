import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class SubmitHomeworkDto {
  @IsString()
  @IsNotEmpty()
  submissionId!: string;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  content?: string;
}
