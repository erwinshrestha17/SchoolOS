interface PushRouteInput {
  notificationId: string;
  sourceType: string;
  sourceId: string;
  studentId: string | null;
  roles: string[];
}

export interface MobilePushDeepLink {
  route: string;
  childId: string | null;
}

export function resolveMobilePushDeepLink(
  input: PushRouteInput,
): MobilePushDeepLink | null {
  const roles = new Set(input.roles.map(normalizeRole));
  const source = input.sourceType.trim().toLowerCase();

  if (hasAnyRole(roles, ['admin', 'principal', 'head_teacher'])) {
    return {
      route: principalRoute(source),
      childId: null,
    };
  }

  if (hasAnyRole(roles, ['teacher', 'class_teacher', 'subject_teacher'])) {
    return {
      route: teacherRoute(source),
      childId: null,
    };
  }

  if (hasAnyRole(roles, ['parent', 'guardian'])) {
    return parentRoute(input, source);
  }

  if (hasAnyRole(roles, ['driver', 'transport'])) {
    return {
      route:
        source.includes('transport') || source.includes('trip')
          ? '/driver/route'
          : '/driver/home',
      childId: null,
    };
  }

  if (
    hasAnyRole(roles, [
      'staff',
      'accountant',
      'librarian',
      'receptionist',
      'support_staff',
      'hr',
      'hr_manager',
      'finance',
      'finance_officer',
    ])
  ) {
    return {
      route: staffRoute(source),
      childId: null,
    };
  }

  return null;
}

function parentRoute(
  input: PushRouteInput,
  source: string,
): MobilePushDeepLink {
  if (source.includes('notice')) {
    return {
      route: `/notices/${encodeURIComponent(input.notificationId)}`,
      childId: input.studentId,
    };
  }

  if (source.includes('message')) {
    return {
      route: '/parent/chat',
      childId: input.studentId,
    };
  }

  if (source.includes('homework')) {
    return {
      route: '/parent/homework',
      childId: input.studentId,
    };
  }

  if (
    source.includes('exam') ||
    source.includes('result') ||
    source.includes('report_card') ||
    source.includes('report-card') ||
    source.includes('marks')
  ) {
    return {
      route: '/parent/more/report-cards',
      childId: input.studentId,
    };
  }

  if (source.includes('attendance') && input.studentId) {
    return {
      route: `/parent/children/${encodeURIComponent(
        input.studentId,
      )}/attendance`,
      childId: input.studentId,
    };
  }

  if (
    source.includes('fee') ||
    source.includes('invoice') ||
    source.includes('payment')
  ) {
    return {
      route: '/parent/more/fees-receipts',
      childId: input.studentId,
    };
  }

  if (source.includes('transport') || source.includes('trip')) {
    return {
      route: '/parent/more/transport',
      childId: input.studentId,
    };
  }

  if (source.includes('activity') || source.includes('gallery')) {
    return {
      route: '/parent/activity',
      childId: input.studentId,
    };
  }

  return {
    route: '/parent/updates',
    childId: input.studentId,
  };
}

function principalRoute(source: string) {
  if (source.includes('approval')) return '/principal/approvals';
  if (source.includes('attendance')) return '/principal/attendance-risk';
  if (
    source.includes('fee') ||
    source.includes('invoice') ||
    source.includes('payment')
  ) {
    return '/principal/fees-snapshot';
  }
  if (source.includes('transport') || source.includes('trip')) {
    return '/principal/transport-alerts';
  }
  if (
    source.includes('exam') ||
    source.includes('result') ||
    source.includes('report_card') ||
    source.includes('report-card') ||
    source.includes('marks')
  ) {
    return '/principal/academics-readiness';
  }
  if (source.includes('notice')) return '/principal/notices';
  return '/principal/attention';
}

function teacherRoute(source: string) {
  if (source.includes('homework')) return '/teacher/homework';
  if (source.includes('timetable') || source.includes('substitution')) {
    return '/teacher/timetable';
  }
  if (source.includes('message') || source.includes('chat')) {
    return '/teacher/messages';
  }
  if (source.includes('attendance')) return '/teacher/attendance';
  return '/teacher/home';
}

function staffRoute(source: string) {
  if (source.includes('payslip') || source.includes('payroll')) {
    return '/staff/payslips';
  }
  if (source.includes('leave')) return '/staff/leave';
  if (source.includes('attendance')) return '/staff/attendance';
  return '/staff/home';
}

function normalizeRole(value: string) {
  return value.trim().toLowerCase().replaceAll('-', '_');
}

function hasAnyRole(roles: Set<string>, expected: string[]) {
  return expected.some((role) => roles.has(role));
}
