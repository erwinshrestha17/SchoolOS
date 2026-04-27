import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { CreateLibraryBookDto } from './dto/create-library-book.dto';
import { CreateLibraryCopyDto } from './dto/create-library-copy.dto';
import { IssueLibraryCopyDto } from './dto/issue-library-copy.dto';
import { ReturnLibraryCopyDto } from './dto/return-library-copy.dto';
import { LibraryService } from './library.service';

@Controller('library')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class LibraryController {
  constructor(private readonly libraryService: LibraryService) {}

  @Get('books')
  @Permissions('library:read')
  listBooks(@CurrentAuth() auth: AuthContext, @Query('q') query?: string) {
    return this.libraryService.listBooks(auth, query);
  }

  @Post('books')
  @Permissions('library:manage')
  createBook(
    @Body() dto: CreateLibraryBookDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.libraryService.createBook(dto, auth);
  }

  @Get('copies')
  @Permissions('library:read')
  listCopies(
    @CurrentAuth() auth: AuthContext,
    @Query('bookId') bookId?: string,
  ) {
    return this.libraryService.listCopies(auth, bookId);
  }

  @Post('copies')
  @Permissions('library:manage')
  createCopy(
    @Body() dto: CreateLibraryCopyDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.libraryService.createCopy(dto, auth);
  }

  @Get('issues')
  @Permissions('library:read')
  listIssues(
    @CurrentAuth() auth: AuthContext,
    @Query('status') status?: string,
  ) {
    return this.libraryService.listIssues(auth, status);
  }

  @Post('issues')
  @Permissions('library:manage')
  issueCopy(
    @Body() dto: IssueLibraryCopyDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.libraryService.issueCopy(dto, auth);
  }

  @Patch('issues/:id/return')
  @Permissions('library:manage')
  returnCopy(
    @Param('id') issueId: string,
    @Body() dto: ReturnLibraryCopyDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.libraryService.returnCopy(issueId, dto, auth);
  }

  @Get('overdue')
  @Permissions('library:read')
  listOverdue(@CurrentAuth() auth: AuthContext) {
    return this.libraryService.listOverdue(auth);
  }

  @Post('overdue/reminders')
  @Permissions('library:manage')
  sendOverdueReminders(@CurrentAuth() auth: AuthContext) {
    return this.libraryService.sendOverdueReminders(auth);
  }
}
