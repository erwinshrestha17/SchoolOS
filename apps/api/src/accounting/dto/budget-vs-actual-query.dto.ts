import { IsOptional, IsUUID } from 'class-validator';
import { IncomeStatementQueryDto } from './income-statement-query.dto';

export class BudgetVsActualQueryDto extends IncomeStatementQueryDto {
  @IsOptional()
  @IsUUID()
  budgetId?: string;
}
