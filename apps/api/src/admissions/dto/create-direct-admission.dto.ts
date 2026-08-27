import { IsString, MaxLength, MinLength } from 'class-validator';
import { CreateAdmissionDto } from './create-admission.dto';

export class CreateDirectAdmissionDto extends CreateAdmissionDto {
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  clientOperationId!: string;
}
