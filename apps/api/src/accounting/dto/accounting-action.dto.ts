import { IsOptional, IsString } from 'class-validator';

export class AccountingActionDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
