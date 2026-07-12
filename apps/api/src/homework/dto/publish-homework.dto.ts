import { IsIn, IsOptional } from 'class-validator';

export type HomeworkPublishNotifyChoice =
  | 'NOTIFY_NOW'
  | 'DO_NOT_SEND'
  | 'IN_APP_ONLY';

export class PublishHomeworkDto {
  @IsOptional()
  @IsIn(['NOTIFY_NOW', 'DO_NOT_SEND', 'IN_APP_ONLY'])
  notify?: HomeworkPublishNotifyChoice;
}
