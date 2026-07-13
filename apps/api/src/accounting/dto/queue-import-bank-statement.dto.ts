import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayMaxSize,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { ImportBankStatementLineDto } from './import-bank-statement.dto';

export class QueueImportBankStatementDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(25000)
  @ValidateNested({ each: true })
  @Type(() => ImportBankStatementLineDto)
  lines!: ImportBankStatementLineDto[];
}
