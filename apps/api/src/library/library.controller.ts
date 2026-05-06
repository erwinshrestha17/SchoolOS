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
import { MarkLibraryCopyStatusDto } from './dto/mark-library-copy-status.dto';
import { ReturnLibraryCopyDto } from './dto/return-library-copy.dto';
import { UpdateLibraryBookDto } from './dto/update-library-book.dto';
import { UpdateLibraryCopyDto } from './dto/update-library-copy.dto';
import { LibraryService } from './library.service';

@Controller('library')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class LibraryController {
  constructor(private readonly libraryService: LibraryService) {}

  @Get('books')
  @Permissions('library:books:read')
  listBooks(
    @CurrentAuth() auth: AuthContext,
    @Query('q') query?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.libraryService.listBooks(auth, { query, page, limit });
  }

  @Post('books')
  @Permissions('library:books:create')
  createBook(
    @Body() dto: CreateLibraryBookDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.libraryService.createBook(dto, auth);
  }

  @Patch('books/:id')
  @Permissions('library:books:update')
  updateBook(
    @Param('id') bookId: string,
    @Body() dto: UpdateLibraryBookDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.libraryService.updateBook(bookId, dto, auth);
  }

  @Get('copies')
  @Permissions('library:copies:read')
  listCopies(
    @CurrentAuth() auth: AuthContext,
    @Query('bookId') bookId?: string,
    @Query('status') status?: string,
    @Query('barcode') barcode?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.libraryService.listCopies(auth, {
      bookId,
      status,
      barcode,
      page,
      limit,
    });
  }

  @Post('copies')
  @Permissions('library:copies:create')
  createCopy(
    @Body() dto: CreateLibraryCopyDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.libraryService.createCopy(dto, auth);
  }

  @Patch('copies/:id')
  @Permissions('library:copies:update')
  updateCopy(
    @Param('id') copyId: string,
    @Body() dto: UpdateLibraryCopyDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.libraryService.updateCopy(copyId, dto, auth);
  }

  @Patch('copies/:id/status')
  @Permissions('library:copies:update')
  markCopyStatus(
    @Param('id') copyId: string,
    @Body() dto: MarkLibraryCopyStatusDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.libraryService.markCopyStatus(copyId, dto, auth);
  }

  @Get('issues')
  @Permissions('library:issues:read')
  listIssues(
    @CurrentAuth() auth: AuthContext,
    @Query('status') status?: string,
    @Query('studentId') studentId?: string,
    @Query('staffId') staffId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.libraryService.listIssues(auth, {
      status,
      studentId,
      staffId,
      page,
      limit,
    });
  }

  @Post('issues')
  @Permissions('library:issues:create')
  issueCopy(
    @Body() dto: IssueLibraryCopyDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.libraryService.issueCopy(dto, auth);
  }

  @Patch('issues/:id/return')
  @Permissions('library:issues:return')
  returnCopy(
    @Param('id') issueId: string,
    @Body() dto: ReturnLibraryCopyDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.libraryService.returnCopy(issueId, dto, auth);
  }

  @Get('overdue')
  @Permissions('library:reports:read')
  listOverdue(@CurrentAuth() auth: AuthContext) {
    return this.libraryService.listOverdue(auth);
  }

  @Post('overdue/reminders')
  @Permissions('library:reports:read')
  sendOverdueReminders(@CurrentAuth() auth: AuthContext) {
    return this.libraryService.sendOverdueReminders(auth);
  }
}
