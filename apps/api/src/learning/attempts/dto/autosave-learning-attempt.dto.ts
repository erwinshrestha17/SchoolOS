import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { LearningAnswerDto } from './learning-answer.dto';

export class AutosaveLearningAttemptDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LearningAnswerDto)
  answers?: LearningAnswerDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(24 * 60 * 60)
  timeSpentSeconds?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  hintsUsed?: number;
}
