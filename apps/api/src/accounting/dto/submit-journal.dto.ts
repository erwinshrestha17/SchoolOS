import { IsOptional, IsString } from 'class-validator';

export class SubmitJournalDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
