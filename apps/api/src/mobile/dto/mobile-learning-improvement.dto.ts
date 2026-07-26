import { OmitType } from '@nestjs/swagger';
import {
  CreateFormativeAssessmentDto,
  CreateStudentInterventionDto,
} from '../../learning-improvement/dto/learning-improvement.dto';

export class MobileTeacherFormativeAssessmentDto extends OmitType(
  CreateFormativeAssessmentDto,
  ['studentId'] as const,
) {}

export class MobileTeacherInterventionDto extends OmitType(
  CreateStudentInterventionDto,
  ['studentId'] as const,
) {}
