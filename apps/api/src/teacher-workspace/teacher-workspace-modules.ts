import { Injectable } from '@nestjs/common';
import { EntitlementsService } from '../plans/entitlements.service';

export type TeacherWorkspaceModuleKey =
  | 'attendance'
  | 'homework'
  | 'timetable'
  | 'exams';

@Injectable()
export class TeacherWorkspaceModuleResolver {
  constructor(private readonly entitlementsService: EntitlementsService) {}

  async getEnabledModules(tenantId: string): Promise<Set<string>> {
    const entitlements =
      await this.entitlementsService.getEntitlements(tenantId);
    return new Set(entitlements.modules);
  }

  async isModuleEnabled(
    tenantId: string,
    module: TeacherWorkspaceModuleKey,
  ): Promise<boolean> {
    const enabled = await this.getEnabledModules(tenantId);
    return enabled.has(module);
  }

  unavailableModules(
    enabledModules: Set<string>,
    required: TeacherWorkspaceModuleKey[],
  ): string[] {
    return required.filter((module) => !enabledModules.has(module));
  }
}
