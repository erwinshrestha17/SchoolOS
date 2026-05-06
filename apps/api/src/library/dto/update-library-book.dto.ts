import { PartialType } from '@nestjs/mapped-types';
import { CreateLibraryBookDto } from './create-library-book.dto';

export class UpdateLibraryBookDto extends PartialType(CreateLibraryBookDto) {}
