import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import type { AuthContext } from '../auth/auth.types';
import { StudentSearchQueryDto } from './dto/student-search-query.dto';
import { StudentSearchService } from './student-search.service';

@Controller('students/search')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class StudentSearchController {
  constructor(private readonly studentSearchService: StudentSearchService) {}

  @Get()
  @Permissions('students:read')
  searchStudents(
    @Query() query: StudentSearchQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentSearchService.searchStudents(query.q, auth);
  }
}
