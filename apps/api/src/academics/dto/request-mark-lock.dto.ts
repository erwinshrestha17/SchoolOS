import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class RequestMarkLockDto {
  @IsUUID()
  examTermId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
