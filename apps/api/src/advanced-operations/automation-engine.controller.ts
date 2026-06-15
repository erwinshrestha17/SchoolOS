import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantActiveGuard } from '../auth/guards/tenant-active.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import type { AuthContext } from '../auth/auth.types';
import { AutomationEngineService } from './automation-engine.service';
import {
  CreateAutomationRuleDto,
  ExecuteAutomationTriggerDto,
} from './dto/automation.dto';

@ApiTags('advanced-automation')
@Controller('advanced/automation')
@UseGuards(JwtAuthGuard, TenantActiveGuard, RolesPermissionsGuard)
export class AutomationEngineController {
  constructor(private readonly service: AutomationEngineService) {}

  @Get('catalog')
  @Permissions('advanced:automation:read')
  getCatalog() {
    return this.service.getInitialRuleCatalog();
  }

  @Get('rules')
  @Permissions('advanced:automation:read')
  listRules(@CurrentAuth() auth: AuthContext) {
    return this.service.listRules(auth);
  }

  @Post('rules')
  @Permissions('advanced:automation:manage')
  createRule(
    @Body() dto: CreateAutomationRuleDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.createRule(dto, auth);
  }

  @Post('execute')
  @Permissions('advanced:automation:execute')
  execute(
    @Body() dto: ExecuteAutomationTriggerDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.executeTrigger(dto, auth);
  }

  @Get('execution-logs')
  @Permissions('advanced:automation:read')
  listLogs(@CurrentAuth() auth: AuthContext) {
    return this.service.listExecutionLogs(auth);
  }
}
