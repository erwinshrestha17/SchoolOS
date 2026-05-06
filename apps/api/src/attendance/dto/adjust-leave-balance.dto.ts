import { IsInt, IsNumber, IsString, Min } from 'class-validator';

export class AdjustLeaveBalanceDto {
  @IsString()
  staffId!: string;

  @IsString()
  leaveType!: string;

  @IsInt()
  @Min(2000)
  year!: number;

  @IsNumber()
  adjustment!: number;

  @IsString()
  reason!: string;
}
