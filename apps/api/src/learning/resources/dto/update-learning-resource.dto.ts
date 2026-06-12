import { PartialType } from '@nestjs/swagger';
import { CreateLearningResourceDto } from './create-learning-resource.dto';

export class UpdateLearningResourceDto extends PartialType(
  CreateLearningResourceDto,
) {}
