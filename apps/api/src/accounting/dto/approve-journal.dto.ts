import { IsOptional, IsString } from 'class-validator';

export class ApproveJournalDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
