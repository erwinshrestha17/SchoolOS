import { IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator';
import { CashierCloseWindowDto } from './cashier-close-window.dto';

export class CreateCashierCloseDto extends CashierCloseWindowDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  actualCashAmount?: number;

  @IsOptional()
  @IsString()
  varianceReason?: string;

  @IsOptional()
  @IsObject()
  denominationBreakdown?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  notes?: string;
}
