import { IsArray, IsString } from 'class-validator';

export class UnpublishResultsDto {
  @IsArray()
  @IsString({ each: true })
  reportCardIds!: string[];

  @IsString()
  reason!: string;
}
