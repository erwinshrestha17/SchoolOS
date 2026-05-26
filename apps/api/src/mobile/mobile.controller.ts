import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthContext } from '../auth/auth.types';
import { MobileService } from './mobile.service';

@Controller('mobile')
@UseGuards(JwtAuthGuard)
export class MobileController {
  constructor(private readonly mobileService: MobileService) {}

  @Get('me/students')
  listMyStudents(@CurrentAuth() auth: AuthContext) {
    return this.mobileService.listMyStudents(auth);
  }

  @Get('students/:id/attendance-summary')
  getStudentAttendanceSummary(
    @Param('id') studentId: string,
    @CurrentAuth() auth: AuthContext,
    @Query('month') month?: number,
    @Query('year') year?: number,
  ) {
    return this.mobileService.getStudentAttendanceSummary(studentId, auth, {
      month: month ? Number(month) : undefined,
      year: year ? Number(year) : undefined,
    });
  }
}
