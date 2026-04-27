import { IsDateString, IsOptional, IsString } from 'class-validator';

export class ArchiveStudentDto {
  @IsString()
  reason!: string;

  @IsOptional()
  @IsDateString()
  exitedAt?: string;
}
