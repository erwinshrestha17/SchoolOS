import type {
  AcademicCalendarSettings,
  CreateAcademicCalendarYearPayload,
  SchoolCalendarDaySettings,
  UpsertSchoolCalendarDayPayload,
} from '@schoolos/core';
import { request } from './client';

const basePath = '/settings/workspaces/academic-calendar';

export const academicCalendarSettingsApi = {
  getCalendar: (academicYearId?: string) => request<AcademicCalendarSettings>(
    `${basePath}${academicYearId ? `?academicYearId=${encodeURIComponent(academicYearId)}` : ''}`,
  ),
  createAcademicYear: (body: CreateAcademicCalendarYearPayload) => request(
    `${basePath}/academic-years`,
    { method: 'POST', json: body },
  ),
  upsertCalendarDay: (body: UpsertSchoolCalendarDayPayload) => request<SchoolCalendarDaySettings>(
    `${basePath}/days`,
    { method: 'POST', json: body },
  ),
};
