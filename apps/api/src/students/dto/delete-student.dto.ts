import { IsDateString, IsOptional, IsString } from 'class-validator';

export class DeleteStudentDto {
  @IsString()
  reason!: string;

  @IsOptional()
  @IsDateString()
  deletedAt?: string;
}
