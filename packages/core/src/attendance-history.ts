export type StudentAttendanceHistoryRow = {
  id: string;
  sessionId: string;
  date: string;
  status: string;
  remarks: string | null;
  className: string;
  sectionName: string | null;
  markedByUserId: string | null;
  markedByName: string | null;
  submittedAt: string | null;
};

export type StudentAttendanceHistorySummary = {
  presentCount: number;
  absentCount: number;
  lateCount: number;
  leaveCount: number;
  sickLeaveCount: number;
  excusedLeaveCount: number;
  unexcusedLeaveCount: number;
  totalRecords: number;
  attendancePercentage: number;
};

export type StudentAttendanceHistory = {
  student: {
    id: string;
    studentSystemId: string;
    fullNameEn: string;
    className: string;
    sectionName: string | null;
  };
  summary: StudentAttendanceHistorySummary;
  records: StudentAttendanceHistoryRow[];
};

export type StudentAttendanceHistoryFilters = {
  fromDate?: string;
  toDate?: string;
  academicYearId?: string;
  status?: string;
};
