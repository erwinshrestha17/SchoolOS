import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { AcademicsService } from './academics.service';
import { CreateAssessmentComponentDto } from './dto/create-assessment-component.dto';
import { CreateCasRecordDto } from './dto/create-cas-record.dto';
import { CreateExamTermDto } from './dto/create-exam-term.dto';
import { EnterMarkDto } from './dto/enter-mark.dto';
import { GenerateReportCardDto } from './dto/generate-report-card.dto';
import { PromoteStudentDto } from './dto/promote-student.dto';

@Controller('academics')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class AcademicsController {
  constructor(private readonly academicsService: AcademicsService) {}

  @Get('exams')
  @Permissions('academics:read')
  listExamTerms(@CurrentAuth() auth: AuthContext) {
    return this.academicsService.listExamTerms(auth);
  }

  @Post('exams')
  @Permissions('academics:manage')
  createExamTerm(
    @Body() dto: CreateExamTermDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.academicsService.createExamTerm(dto, auth);
  }

  @Post('exams/components')
  @Permissions('academics:manage')
  createComponent(
    @Body() dto: CreateAssessmentComponentDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.academicsService.createAssessmentComponent(dto, auth);
  }

  @Get('marks')
  @Permissions('academics:read')
  listMarks(@CurrentAuth() auth: AuthContext) {
    return this.academicsService.listMarks(auth);
  }

  @Post('marks')
  @Permissions('academics:enter_marks')
  enterMark(@Body() dto: EnterMarkDto, @CurrentAuth() auth: AuthContext) {
    return this.academicsService.enterMark(dto, auth);
  }

  @Get('cas')
  @Permissions('academics:read')
  listCas(@CurrentAuth() auth: AuthContext) {
    return this.academicsService.listCasRecords(auth);
  }

  @Post('cas')
  @Permissions('academics:enter_marks')
  createCas(@Body() dto: CreateCasRecordDto, @CurrentAuth() auth: AuthContext) {
    return this.academicsService.createCasRecord(dto, auth);
  }

  @Get('report-cards')
  @Permissions('academics:read')
  listReportCards(@CurrentAuth() auth: AuthContext) {
    return this.academicsService.listReportCards(auth);
  }

  @Post('report-cards')
  @Permissions('academics:manage')
  generateReportCard(
    @Body() dto: GenerateReportCardDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.academicsService.generateReportCard(dto, auth);
  }

  @Get('promotions')
  @Permissions('academics:read')
  listPromotions(
    @CurrentAuth() auth: AuthContext,
    @Query('academicYearId') academicYearId?: string,
    @Query('classId') classId?: string,
  ) {
    return this.academicsService.listPromotionReadiness(
      auth,
      academicYearId,
      classId,
    );
  }

  @Post('promotions')
  @Permissions('academics:manage')
  promoteStudent(
    @Body() dto: PromoteStudentDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.academicsService.promoteStudent(dto, auth);
  }
}
