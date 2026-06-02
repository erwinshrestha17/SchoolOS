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
export * from './api/platform';

import { authApi } from './api/auth';
import { academicsApi } from './api/academics';
import { studentsApi } from './api/students';
import { attendanceApi } from './api/attendance';
import { financeApi } from './api/finance';
import { accountingApi } from './api/accounting';
import { payrollApi } from './api/payroll';
import { communicationsApi } from './api/communications';
import { messagingApi } from './api/messaging';
import { activityApi } from './api/activity';
import { platformApi } from './api/platform';
import { filesApi } from './api/client';

export const api = {
  ...authApi,
  ...academicsApi,
  ...studentsApi,
  ...attendanceApi,
  ...financeApi,
  ...accountingApi,
  ...payrollApi,
  ...communicationsApi,
  ...messagingApi,
  ...activityApi,
  ...platformApi,
  ...filesApi,
};
