import { PartialType } from '@nestjs/swagger';
import { CreateLearningActivityDto } from './create-learning-activity.dto';

export class UpdateLearningActivityDto extends PartialType(
  CreateLearningActivityDto,
) {}
