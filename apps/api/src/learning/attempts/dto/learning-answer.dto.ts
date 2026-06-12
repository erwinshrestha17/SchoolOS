import { IsOptional, IsString } from 'class-validator';

export class LearningAnswerDto {
  @IsString()
  questionId!: string;

  @IsOptional()
  answer?: unknown;
}
