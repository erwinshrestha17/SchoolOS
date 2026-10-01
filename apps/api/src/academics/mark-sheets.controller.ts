import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthContext } from '../auth/auth.types';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import {
  ListMarkSheetsDto,
  ReviewMarkSheetDto,
  SubmitMarkSheetDto,
  UnlockMarkSheetDto,
} from './dto/mark-sheet.dto';
import { MarkReadinessService } from './mark-readiness.service';
import { MarkSheetService } from './mark-sheet.service';

/**
 * Phase 6G marks lifecycle. Each lifecycle duty has its own route so the
 * guard enforces exactly one permission per duty:
 *   submit/resubmit -> academics:enter_marks (+ teacher scope/eligibility)
 *   return/review/lock -> marks:review_lock (+ separation of duties)
 *   unlock -> exam-terms:unlock (reason required)
 */
@Controller('academics/mark-sheets')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.exams')
export class MarkSheetsController {
  constructor(
    private readonly markSheetService: MarkSheetService,
    private readonly markReadinessService: MarkReadinessService,
  ) {}

  @Get()
  @Permissions('marks:read', 'academics:read', 'academics:enter_marks')
  list(@Query() query: ListMarkSheetsDto, @CurrentAuth() auth: AuthContext) {
    return this.markSheetService.list(query, auth);
  }

  /**
   * 6E readiness matrix: component x section lifecycle state for a term.
   * Coordinator/leadership view (marks:review_lock); counts are exact.
   */
  @Get('readiness')
  @Permissions('marks:review_lock')
  readiness(
    @Query('examTermId') examTermId: string,
    @Query('classId') classId: string | undefined,
    @CurrentAuth() auth: AuthContext,
  ) {
    if (!examTermId) {
      throw new BadRequestException('examTermId is required');
    }
    return this.markReadinessService.getTermReadiness(examTermId, auth, {
      classId: classId || undefined,
    });
  }

  @Get(':id')
  @Permissions('marks:read', 'academics:read', 'academics:enter_marks')
  get(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.markSheetService.get(id, auth);
  }

  @Get(':id/history')
  @Permissions('marks:read', 'academics:read', 'academics:enter_marks')
  history(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.markSheetService.history(id, auth);
  }

  @Post(':id/submit')
  @Permissions('academics:enter_marks')
  submit(
    @Param('id') id: string,
    @Body() dto: SubmitMarkSheetDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.markSheetService.submit(id, dto, auth);
  }

  @Post(':id/review')
  @Permissions('marks:review_lock')
  review(
    @Param('id') id: string,
    @Body() dto: ReviewMarkSheetDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.markSheetService.review(id, dto, auth);
  }

  @Post(':id/unlock')
  @Permissions('exam-terms:unlock')
  unlock(
    @Param('id') id: string,
    @Body() dto: UnlockMarkSheetDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.markSheetService.unlock(id, dto, auth);
  }
}
