import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';

export class ListNoticeAcknowledgementsQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;

  @IsIn(['PENDING', 'ACKNOWLEDGED'])
  status: 'PENDING' | 'ACKNOWLEDGED' = 'PENDING';
}

export class NoticeAcknowledgementFollowUpDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  recipientUserIds!: string[];

  @IsString()
  @Length(3, 500)
  reason!: string;

  @IsString()
  @Length(8, 120)
  idempotencyKey!: string;
}
