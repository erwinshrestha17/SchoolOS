import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateLibraryBookDto {
  @IsString()
  title!: string;

  @IsString()
  author!: string;

  @IsOptional()
  @IsString()
  isbn?: string;

  @IsOptional()
  @IsString()
  publisher?: string;

  @IsOptional()
  @IsInt()
  @Min(1000)
  publishedYear?: number;

  @IsOptional()
  @IsString()
  subjectCategory?: string;

  @IsOptional()
  @IsString()
  classLevel?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  purchasePrice?: number;
}
