import { ConflictException } from '@nestjs/common';
import type { AuthContext } from '../../auth/auth.types';
import {
  hasDomainPermission,
  requireDomainPermission,
  requireIndependentActor,
} from './domain-permission';

export type PayrollDuty =
  | 'VALIDATE'
  | 'SUBMIT_REVIEW'
  | 'REVIEW'
  | 'APPROVE'
  | 'FINALIZE'
  | 'POST';
export interface PayrollDutyRecord {
  generatedById?: string | null;
  reviewedById?: string | null;
  approvedById?: string | null;
}
const dutyPermissions: Record<PayrollDuty, string> = {
  VALIDATE: 'payroll:run:validate',
  SUBMIT_REVIEW: 'payroll:run:create',
  REVIEW: 'payroll:run:review',
  APPROVE: 'payroll:run:approve',
  FINALIZE: 'payroll:run:finalize',
  POST: 'payroll:run:post',
};

export function payrollDutyPermission(duty: PayrollDuty): string {
  return dutyPermissions[duty];
}

export function requirePayrollDuty(
  actor: AuthContext,
  duty: PayrollDuty,
  run: PayrollDutyRecord,
): void {
  requireDomainPermission(actor, dutyPermissions[duty]);
  if (!run.generatedById)
    throw new ConflictException('Payroll preparer evidence is required');
  if (
    (duty === 'FINALIZE' || duty === 'POST') &&
    (!run.approvedById ||
      !run.reviewedById ||
      run.approvedById === run.generatedById ||
      run.approvedById === run.reviewedById ||
      run.reviewedById === run.generatedById)
  )
    throw new ConflictException(
      'Independent payroll review and approval evidence is required',
    );
  if (duty === 'REVIEW' || duty === 'APPROVE' || duty === 'FINALIZE')
    requireIndependentActor(actor, [run.generatedById]);
  if (duty === 'APPROVE') requireIndependentActor(actor, [run.reviewedById]);
  if (duty === 'POST')
    requireIndependentActor(actor, [run.generatedById, run.approvedById]);
}

export function payrollDutyAvailable(
  actor: AuthContext | undefined,
  duty: PayrollDuty,
  run: PayrollDutyRecord,
): boolean {
  if (!actor || !hasDomainPermission(actor, dutyPermissions[duty]))
    return false;
  try {
    requirePayrollDuty(actor, duty, run);
    return true;
  } catch {
    return false;
  }
}
