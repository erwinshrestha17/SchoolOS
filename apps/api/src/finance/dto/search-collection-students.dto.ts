import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SearchCollectionStudentsDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;
}
