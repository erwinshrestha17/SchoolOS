import { z } from 'zod';

export const attendanceExceptionSchema = z.object({
  studentId: z.string().min(1),
  status: z.enum([
    'P',
    'A',
    'L',
    'LS',
    'LE',
    'LU',
    'PRESENT',
    'ABSENT',
    'LATE',
    'LEAVE',
    'SICK_LEAVE',
    'EXCUSED_LEAVE',
    'UNEXCUSED_LEAVE'
  ]),
  remark: z.string().optional().nullable(),
  lateAt: z.string().optional().nullable()
});

export const attendanceSubmissionSchema = z.object({
  academicYearId: z.string().min(1),
  classId: z.string().min(1),
  sectionId: z.string().optional().nullable(),
  attendanceDate: z.string().min(1),
  exceptions: z.array(attendanceExceptionSchema).default([])
});

export const attendanceSyncSchema = attendanceSubmissionSchema.extend({
  clientSubmissionId: z.string().min(1).max(128),
  deviceTimestamp: z.string().min(1),
  deviceId: z.string().max(128).optional().nullable(),
  deviceLabel: z.string().max(120).optional().nullable(),
  sessionFingerprint: z.string().max(128).optional().nullable()
});

export const attendanceConflictReviewSchema = z.object({
  decision: z
    .enum(['REVIEWED_WITHOUT_CHANGE', 'REJECTED_RESUBMISSION'])
    .default('REVIEWED_WITHOUT_CHANGE'),
  resolutionNote: z.string().optional().nullable()
});

export type AttendanceSubmissionInput = z.input<typeof attendanceSubmissionSchema>;

export type AttendanceSyncInput = z.input<typeof attendanceSyncSchema>;

export type AttendanceConflictReviewInput = z.input<typeof attendanceConflictReviewSchema>;
