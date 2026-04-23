import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateSectionDto {
  @IsString()
  classId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;
}
