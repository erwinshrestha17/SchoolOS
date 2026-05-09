import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateActivityPostDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  caption?: string;
}
