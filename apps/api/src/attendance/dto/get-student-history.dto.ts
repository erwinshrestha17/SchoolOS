import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class GetStudentHistoryDto {
  @ApiProperty()
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty()
  @IsDateString()
  @IsOptional()
  endDate?: string;
}
