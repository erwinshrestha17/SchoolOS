import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class EnrollTransportStudentDto {
  @IsString()
  studentId!: string;

  @IsString()
  routeId!: string;

  @IsString()
  stopId!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  feeAmount?: number;

  @IsOptional()
  @IsDateString()
  startedAt?: string;
}
