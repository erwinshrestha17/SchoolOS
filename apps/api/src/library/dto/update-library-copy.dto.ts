import { PartialType } from '@nestjs/mapped-types';
import { CreateLibraryCopyDto } from './create-library-copy.dto';

export class UpdateLibraryCopyDto extends PartialType(CreateLibraryCopyDto) {}
