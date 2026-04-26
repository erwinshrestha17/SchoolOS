import { IsString } from 'class-validator';

export class CreateAccountingPeriodDto {
  @IsString()
  name!: string;

  @IsString()
  startsOn!: string;

  @IsString()
  endsOn!: string;
}
