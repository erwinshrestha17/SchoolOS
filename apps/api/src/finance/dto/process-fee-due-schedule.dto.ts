import { IsOptional, IsString } from 'class-validator';

export class ProcessFeeDueScheduleDto {
  @IsOptional()
  @IsString()
  message?: string;
}
