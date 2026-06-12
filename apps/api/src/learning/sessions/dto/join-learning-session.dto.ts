import { IsOptional, IsString, MaxLength } from 'class-validator';

export class JoinLearningSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(24)
  sessionCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  qrToken?: string;
}
