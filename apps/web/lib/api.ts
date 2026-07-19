// Barrel export all modular API pieces for backward compatibility
export * from './api/client';
export * from './api/auth';
export * from './api/academics';
export * from './api/students';
export * from './api/attendance';
export * from './api/finance';
export * from './api/accounting';
export * from './api/payroll';
export * from './api/communications';
export * from './api/messaging';
export * from './api/activity';
export * from './api/marketing';
export * from './api/platform';
export * from './api/users';
export * from './api/canteen';
export * from './api/library';
export * from './api/transport';
export * from './api/learning';
export * from './api/operational-summary';
export * from './api/school-settings';
export * from './api/geography';
export * from './api/teacher-workspace';
export * from './api/teacher-students';

import { authApi } from './api/auth';
import {
  academicsApi,
  type HomeworkReminderBatchSummary,
} from './api/academics';
import { studentsApi } from './api/students';
import { attendanceApi } from './api/attendance';
import { financeApi } from './api/finance';
import { accountingApi } from './api/accounting';
import { payrollApi } from './api/payroll';
import { communicationsApi } from './api/communications';
import { messagingApi } from './api/messaging';
import { activityApi } from './api/activity';
import { marketingApi } from './api/marketing';
import { platformApi } from './api/platform';
import { usersApi } from './api/users';
import { canteenApi } from './api/canteen';
import { libraryApi } from './api/library';
import { transportApi } from './api/transport';
import { learningApi } from './api/learning';
import { operationalSummaryApi } from './api/operational-summary';
import { schoolSettingsApi } from './api/school-settings';
import { filesApi } from './api/client';
import { geographyApi } from './api/geography';
import { teacherWorkspaceApi } from './api/teacher-workspace';
import { teacherStudentsApi } from './api/teacher-students';

function normalizeHomeworkReminderBatches(
  result: unknown,
): HomeworkReminderBatchSummary[] {
  if (Array.isArray(result)) {
    return result as HomeworkReminderBatchSummary[];
  }

  if (
    result !== null &&
    typeof result === 'object' &&
    'items' in result &&
    Array.isArray(result.items)
  ) {
    return result.items as HomeworkReminderBatchSummary[];
  }

  throw new Error('Homework reminder batch response is malformed.');
}

export const api = {
  ...authApi,
  ...academicsApi,
  listHomeworkReminderBatches: async (
    ...args: Parameters<typeof academicsApi.listHomeworkReminderBatches>
  ) =>
    normalizeHomeworkReminderBatches(
      await academicsApi.listHomeworkReminderBatches(...args),
    ),
  ...studentsApi,
  ...attendanceApi,
  ...financeApi,
  ...accountingApi,
  ...payrollApi,
  ...communicationsApi,
  ...messagingApi,
  ...activityApi,
  ...marketingApi,
  ...platformApi,
  ...usersApi,
  ...canteenApi,
  ...libraryApi,
  ...transportApi,
  ...learningApi,
  ...operationalSummaryApi,
  ...schoolSettingsApi,
  ...filesApi,
  ...geographyApi,
  ...teacherWorkspaceApi,
  ...teacherStudentsApi,
};