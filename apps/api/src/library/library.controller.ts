import {
  Body,
  Controller,
  Get,
  Header,
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
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { ArchiveLibraryBookDto } from './dto/archive-library-book.dto';
import { CreateLibraryBookDto } from './dto/create-library-book.dto';
import { CreateLibraryCopyDto } from './dto/create-library-copy.dto';
import { IssueLibraryCopyDto } from './dto/issue-library-copy.dto';
import { MarkLibraryCopyStatusDto } from './dto/mark-library-copy-status.dto';
import { ReturnLibraryCopyDto } from './dto/return-library-copy.dto';
import { UpdateLibraryBookDto } from './dto/update-library-book.dto';
import { UpdateLibraryCopyDto } from './dto/update-library-copy.dto';
import {
  CreateLibraryFineDto,
  PostLibraryFineToFeesDto,
  UpdateLibraryFineDto,
} from './dto/library-fine.dto';
import { UpdateLibrarySettingDto } from './dto/update-library-setting.dto';
import { LibraryHardeningService } from './library-hardening.service';
import { LibraryService } from './library.service';

@Controller('library')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.library')
export class LibraryController {
  constructor(
    private readonly libraryService: LibraryService,
    private readonly libraryHardeningService: LibraryHardeningService,
  ) {}

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

  @Post('books/:id/archive')
  @Permissions('library:books:update')
  archiveBook(
    @Param('id') bookId: string,
    @Body() dto: ArchiveLibraryBookDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.libraryHardeningService.archiveBook(bookId, dto, auth);
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

  @Post('copies/:id/archive')
  @Permissions('library:copies:update')
  archiveCopy(
    @Param('id') copyId: string,
    @Body() dto: ArchiveLibraryBookDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.libraryService.archiveCopy(copyId, dto.reason, auth);
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
  listOverdue(
    @CurrentAuth() auth: AuthContext,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.libraryService.listOverdue(auth, { page, limit });
  }

  @Post('overdue/reminders')
  @Permissions('library:reports:read')
  sendOverdueReminders(@CurrentAuth() auth: AuthContext) {
    return this.libraryHardeningService.sendOverdueRemindersIdempotent(auth);
  }

  @Get('reports/issued')
  @Permissions('library:reports:read')
  getIssuedBooksReport(
    @CurrentAuth() auth: AuthContext,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.libraryHardeningService.getIssuedBooksReport(auth, {
      page,
      limit,
    });
  }

  @Get('reports/overdue')
  @Permissions('library:reports:read')
  getOverdueBooksReport(@CurrentAuth() auth: AuthContext) {
    return this.libraryHardeningService.getOverdueBooksReport(auth);
  }

  @Get('reports/lost-damaged')
  @Permissions('library:reports:read')
  getLostDamagedReport(@CurrentAuth() auth: AuthContext) {
    return this.libraryHardeningService.getLostDamagedReport(auth);
  }

  @Get('reports/fines')
  @Permissions('library:reports:read')
  getFineSummary(@CurrentAuth() auth: AuthContext) {
    return this.libraryHardeningService.getFineSummary(auth);
  }

  @Get('reports/borrower-history')
  @Permissions('library:reports:read')
  getBorrowerHistory(
    @CurrentAuth() auth: AuthContext,
    @Query('studentId') studentId?: string,
    @Query('staffId') staffId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.libraryHardeningService.getBorrowerHistory(auth, {
      studentId,
      staffId,
      page,
      limit,
    });
  }

  @Get('reports/issued.csv')
  @Header('Content-Type', 'text/csv')
  @Header(
    'Content-Disposition',
    'attachment; filename="library-issued-books.csv"',
  )
  @Permissions('library:reports:read')
  exportIssuedBooksCsv(@CurrentAuth() auth: AuthContext) {
    return this.libraryHardeningService.exportIssuedBooksCsv(auth);
  }

  @Get('borrowed-students')
  @Permissions('library:issues:read')
  getBorrowedStudents(
    @CurrentAuth() auth: AuthContext,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.libraryService.getBorrowedStudents(auth, { page, limit });
  }

  @Get('fines')
  @Permissions('library:reports:read')
  listFines(
    @CurrentAuth() auth: AuthContext,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.libraryService.listFines(auth, { page, limit });
  }

  @Post('fines')
  @Permissions('library:fines:create')
  createFine(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: CreateLibraryFineDto,
  ) {
    return this.libraryService.createFine(auth, dto);
  }

  @Patch('fines/:id')
  @Permissions('library:fines:update')
  updateFine(
    @CurrentAuth() auth: AuthContext,
    @Param('id') fineId: string,
    @Body() dto: UpdateLibraryFineDto,
  ) {
    return this.libraryService.updateFine(auth, fineId, dto);
  }

  @Post('fines/:id/post-to-fees')
  @Permissions('library:fines:post')
  postFineToFees(
    @CurrentAuth() auth: AuthContext,
    @Param('id') fineId: string,
    @Body() dto: PostLibraryFineToFeesDto,
  ) {
    return this.libraryService.postFineToFees(auth, fineId, dto.reason);
  }

  @Get('reports/popular')
  @Permissions('library:reports:read')
  getPopularBooksReport(
    @CurrentAuth() auth: AuthContext,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.libraryService.getPopularBooksReport(auth, { page, limit });
  }

  @Get('books/:id/history')
  @Permissions('library:books:read')
  getBookHistory(
    @CurrentAuth() auth: AuthContext,
    @Param('id') bookId: string,
  ) {
    return this.libraryService.getBookHistory(auth, bookId);
  }

  @Get('copies/:id/history')
  @Permissions('library:copies:read')
  getCopyHistory(
    @CurrentAuth() auth: AuthContext,
    @Param('id') copyId: string,
  ) {
    return this.libraryService.getCopyHistory(auth, copyId);
  }

  @Get('settings')
  @Permissions('library:books:read')
  getSettings(@CurrentAuth() auth: AuthContext) {
    return this.libraryService.getLibrarySettings(auth);
  }

  @Patch('settings')
  @Permissions('library:books:update')
  updateSettings(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: UpdateLibrarySettingDto,
  ) {
    return this.libraryService.updateLibrarySettings(auth, dto);
  }

  @Post('qr-lookup')
  @Permissions('library:issues:create')
  resolveQrBorrower(
    @CurrentAuth() auth: AuthContext,
    @Body('token') token: string,
  ) {
    return this.libraryService.resolveQrBorrower(auth, token);
  }
}
