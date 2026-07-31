import {
  IsDateString,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ConfirmStudentActionFields } from '../../common/security/confirm-student-action';

export class MobileParentStudentLeaveRequestDto extends ConfirmStudentActionFields {
  @IsString()
  @IsNotEmpty()
  leaveType!: string;

  @IsDateString()
  startsOn!: string;

  @IsDateString()
  endsOn!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(500)
  reason!: string;
}
