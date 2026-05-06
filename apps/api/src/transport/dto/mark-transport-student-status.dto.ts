import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class MarkTransportStudentStatusDto {
  @IsString()
  studentId!: string;

  @IsOptional()
  @IsBoolean()
  absent?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
