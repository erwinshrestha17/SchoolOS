import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
} from 'class-validator';

export class CreateFinanceRequestDto {
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}
