import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export enum PlanKey {
  FREE = 'free',
  BASIC = 'basic',
  STANDARD = 'standard',
  PREMIUM = 'premium',
}

export interface PlanRules {
  maxStudents: number;
  maxStaff: number;
  maxUsers: number;
  storageLimitBytes: number;
  enabledModules: string[];
  enabledFeatures: string[];
}

const PLAN_CONFIGS: Record<PlanKey, PlanRules> = {
  [PlanKey.FREE]: {
    maxStudents: 50,
    maxStaff: 10,
    maxUsers: 5,
    storageLimitBytes: 100 * 1024 * 1024, // 100MB
    enabledModules: ['students', 'staff', 'attendance'],
    enabledFeatures: ['basic_reports'],
  },
  [PlanKey.BASIC]: {
    maxStudents: 300,
    maxStaff: 50,
    maxUsers: 20,
    storageLimitBytes: 1024 * 1024 * 1024, // 1GB
    enabledModules: ['students', 'staff', 'attendance', 'academics', 'finance'],
    enabledFeatures: ['basic_reports', 'fee_management'],
  },
  [PlanKey.STANDARD]: {
    maxStudents: 1000,
    maxStaff: 150,
    maxUsers: 100,
    storageLimitBytes: 10 * 1024 * 1024 * 1024, // 10GB
    enabledModules: [
      'students',
      'staff',
      'attendance',
      'academics',
      'finance',
      'payroll',
      'library',
      'transport',
    ],
    enabledFeatures: [
      'basic_reports',
      'fee_management',
      'payroll_management',
      'exam_management',
    ],
  },
  [PlanKey.PREMIUM]: {
    maxStudents: 10000,
    maxStaff: 1000,
    maxUsers: 500,
    storageLimitBytes: 100 * 1024 * 1024 * 1024, // 100GB
    enabledModules: ['*'], // All modules
    enabledFeatures: ['*'], // All features
  },
};

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async getTenantPlan(tenantId: string): Promise<PlanKey> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true },
    });

    if (!tenant) return PlanKey.FREE;
    return (tenant.plan as PlanKey) || PlanKey.FREE;
  }

  async getPlanRules(plan: PlanKey): Promise<PlanRules> {
    return PLAN_CONFIGS[plan] || PLAN_CONFIGS[PlanKey.FREE];
  }

  async checkFeatureEnabled(
    tenantId: string,
    feature: string,
  ): Promise<boolean> {
    const plan = await this.getTenantPlan(tenantId);
    const rules = await this.getPlanRules(plan);

    if (rules.enabledFeatures.includes('*')) return true;
    return rules.enabledFeatures.includes(feature);
  }

  async checkModuleEnabled(
    tenantId: string,
    moduleName: string,
  ): Promise<boolean> {
    const plan = await this.getTenantPlan(tenantId);
    const rules = await this.getPlanRules(plan);

    if (rules.enabledModules.includes('*')) return true;
    return rules.enabledModules.includes(moduleName);
  }

  async validateLimit(
    tenantId: string,
    limitKey: keyof PlanRules,
    currentCount: number,
  ) {
    const plan = await this.getTenantPlan(tenantId);
    const rules = await this.getPlanRules(plan);

    const limit = rules[limitKey];
    if (typeof limit === 'number' && currentCount >= limit) {
      throw new ForbiddenException(
        `Plan limit reached for ${limitKey}. Current: ${currentCount}, Limit: ${limit}. Please upgrade your plan.`,
      );
    }
  }
}
