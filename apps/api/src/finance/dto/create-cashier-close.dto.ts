import { IsOptional, IsString } from 'class-validator';
import { CashierCloseWindowDto } from './cashier-close-window.dto';

export class CreateCashierCloseDto extends CashierCloseWindowDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
