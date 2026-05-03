import { IsOptional, IsString, MaxLength } from 'class-validator';

export class StudentSearchQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;
}
