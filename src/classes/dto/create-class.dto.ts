import { IsInt, IsString, Min } from 'class-validator';

export class CreateClassDto {
  @IsString()
  name!: string;

  @IsInt()
  @Min(0)
  level!: number;
}
