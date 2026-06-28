import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class MobilePrincipalEscalationQueryDto {
  @IsOptional()
  @IsIn(['open', 'assigned', 'resolved', 'reopened'])
  status?: 'open' | 'assigned' | 'resolved' | 'reopened';
}

export class MobilePrincipalEscalationAssignmentDto {
  @IsUUID()
  assigneeUserId!: string;
}

export class MobilePrincipalEscalationNoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  note!: string;
}

export class MobilePrincipalEscalationResolutionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  resolutionReason!: string;
}

export class MobilePrincipalEscalationReopenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
