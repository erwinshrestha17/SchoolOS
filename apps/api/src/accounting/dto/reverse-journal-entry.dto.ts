import { IsDateString, IsOptional, IsString } from 'class-validator';

export class ReverseJournalEntryDto {
  @IsOptional()
  @IsDateString()
  reversalDate?: string;

  @IsOptional()
  @IsString()
  narration?: string;

  @IsString()
  reason!: string;
}
