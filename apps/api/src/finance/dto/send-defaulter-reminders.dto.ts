import { NotificationChannel } from '@prisma/client';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export class SendDefaulterRemindersDto {
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  invoiceIds?: string[];

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  feeHeadId?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(NotificationChannel, { each: true })
  channels?: NotificationChannel[];

  @IsOptional()
  @IsString()
  message?: string;
}
