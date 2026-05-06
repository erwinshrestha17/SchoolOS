import { PartialType } from '@nestjs/swagger';
import { CreateSalaryStructureDto } from './create-salary-structure.dto';

export class UpdateSalaryStructureDto extends PartialType(
  CreateSalaryStructureDto,
) {}
