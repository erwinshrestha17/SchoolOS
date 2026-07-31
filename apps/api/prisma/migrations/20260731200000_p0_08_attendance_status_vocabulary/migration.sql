-- P0-08: Expand attendance status vocabulary for departure and period absence.

ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'EARLY_AUTHORIZED_DEPARTURE';
ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'UNAUTHORIZED_DEPARTURE';
ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'PERIOD_ABSENT';
