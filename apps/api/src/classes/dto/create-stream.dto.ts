import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateStreamDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  code!: string;
}
