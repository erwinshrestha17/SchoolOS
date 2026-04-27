import { IsString } from 'class-validator';

export class RequestMarkLockDto {
  @IsString()
  examTermId!: string;

  @IsString()
  reason!: string;
}
