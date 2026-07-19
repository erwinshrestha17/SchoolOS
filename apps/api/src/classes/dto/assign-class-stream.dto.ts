import { IsOptional, IsUUID } from 'class-validator';

export class AssignClassStreamDto {
  @IsOptional()
  @IsUUID()
  streamId?: string | null;
}
