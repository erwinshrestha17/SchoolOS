import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CancelTransportTripDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
