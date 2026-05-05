import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UnlockExamTermDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
