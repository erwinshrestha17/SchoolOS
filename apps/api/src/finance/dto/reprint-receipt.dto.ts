import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReprintReceiptDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  reason!: string;
}
