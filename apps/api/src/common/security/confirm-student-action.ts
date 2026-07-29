import { BadRequestException } from '@nestjs/common';
import { IsUUID } from 'class-validator';

export const GUARDIAN_CHILD_CONFIRMATION_MISMATCH_CODE =
  'GUARDIAN_CHILD_CONFIRMATION_MISMATCH';

const GUARDIAN_CHILD_CONFIRMATION_MISMATCH_MESSAGE =
  'Confirm the selected child before submitting this action.';

export class ConfirmStudentActionFields {
  @IsUUID()
  confirmStudentId!: string;
}

/**
 * P0-07: reject high-impact parent actions when the confirmed child does not
 * match the route/body student context (stale active-child selection).
 */
export function assertConfirmStudentId(
  pathStudentId: string,
  confirmStudentId: string | undefined,
) {
  if (!confirmStudentId || confirmStudentId !== pathStudentId) {
    throw createConfirmStudentMismatchException(pathStudentId);
  }
}

export function assertConfirmStudentIdAllowed(
  confirmStudentId: string | undefined,
  allowedStudentIds: string[],
) {
  if (!confirmStudentId || !allowedStudentIds.includes(confirmStudentId)) {
    throw createConfirmStudentMismatchException(allowedStudentIds[0] ?? null);
  }
}

function createConfirmStudentMismatchException(
  expectedStudentId: string | null,
) {
  return new BadRequestException({
    statusCode: 400,
    error: 'Bad Request',
    code: GUARDIAN_CHILD_CONFIRMATION_MISMATCH_CODE,
    message: GUARDIAN_CHILD_CONFIRMATION_MISMATCH_MESSAGE,
    ...(expectedStudentId ? { expectedStudentId } : {}),
  });
}
