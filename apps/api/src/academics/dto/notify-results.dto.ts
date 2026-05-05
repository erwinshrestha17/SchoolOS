import { IsArray, IsString } from 'class-validator';

export class NotifyResultsDto {
  @IsArray()
  @IsString({ each: true })
  reportCardIds!: string[];
}
