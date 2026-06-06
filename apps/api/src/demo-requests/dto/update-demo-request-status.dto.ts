import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { DEMO_REQUEST_STATUSES } from '../demo-requests.constants';

export class UpdateDemoRequestStatusDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(DEMO_REQUEST_STATUSES)
  status!: (typeof DEMO_REQUEST_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  internalNotes?: string;
}
