class StaffProfile {
  const StaffProfile({
    required this.id,
    required this.employeeId,
    required this.name,
    this.email,
    this.department,
    this.designation,
    this.status,
    this.joiningDate,
  });

  final String id;
  final String employeeId;
  final String name;
  final String? email;
  final String? department;
  final String? designation;
  final String? status;
  final DateTime? joiningDate;

  factory StaffProfile.fromJson(Map<String, dynamic> json) {
    final user = _asMap(json['user']);
    final firstName = json['firstName'] as String? ?? '';
    final lastName = json['lastName'] as String? ?? '';
    final name = [
      firstName,
      lastName,
    ].where((part) => part.trim().isNotEmpty).join(' ').trim();

    return StaffProfile(
      id: json['id'] as String? ?? '',
      employeeId:
          json['employeeId'] as String? ?? json['staffCode'] as String? ?? '',
      name: name.isNotEmpty ? name : 'Staff Member',
      email: json['email'] as String? ?? user?['email'] as String?,
      department: json['department'] as String?,
      designation: json['designation'] as String?,
      status: json['status'] as String?,
      joiningDate: _date(json['joiningDate']),
    );
  }
}

class StaffAttendanceRecord {
  const StaffAttendanceRecord({
    required this.id,
    required this.date,
    required this.status,
    this.checkInAt,
    this.leaveType,
    this.note,
  });

  final String id;
  final DateTime date;
  final String status;
  final DateTime? checkInAt;
  final String? leaveType;
  final String? note;

  factory StaffAttendanceRecord.fromJson(Map<String, dynamic> json) {
    return StaffAttendanceRecord(
      id: json['id'] as String? ?? '',
      date: _date(json['attendanceDate']) ?? DateTime.now(),
      status: json['status'] as String? ?? 'PRESENT',
      checkInAt: _date(json['checkInAt']),
      leaveType: json['leaveType'] as String?,
      note: json['note'] as String?,
    );
  }
}

class StaffLeaveRequest {
  const StaffLeaveRequest({
    required this.id,
    required this.leaveType,
    required this.startsOn,
    required this.endsOn,
    required this.days,
    required this.reason,
    required this.status,
  });

  final String id;
  final String leaveType;
  final DateTime startsOn;
  final DateTime endsOn;
  final double days;
  final String reason;
  final String status;

  factory StaffLeaveRequest.fromJson(Map<String, dynamic> json) {
    return StaffLeaveRequest(
      id: json['id'] as String? ?? '',
      leaveType: json['leaveType'] as String? ?? 'Leave',
      startsOn: _date(json['startsOn']) ?? DateTime.now(),
      endsOn: _date(json['endsOn']) ?? DateTime.now(),
      days: _double(json['days']),
      reason: json['reason'] as String? ?? '',
      status: json['status'] as String? ?? 'PENDING',
    );
  }
}

class StaffPayslip {
  const StaffPayslip({
    required this.id,
    required this.payslipNumber,
    required this.periodLabel,
    required this.status,
    required this.paymentStatus,
    required this.grossSalary,
    required this.deductionAmount,
    required this.netSalary,
    this.issuedAt,
  });

  final String id;
  final String payslipNumber;
  final String periodLabel;
  final String status;
  final String paymentStatus;
  final double grossSalary;
  final double deductionAmount;
  final double netSalary;
  final DateTime? issuedAt;

  factory StaffPayslip.fromJson(Map<String, dynamic> json) {
    final payrollRun = _asMap(json['payrollRun']);
    final month = _int(payrollRun?['periodMonth']);
    final year = _int(payrollRun?['periodYear']);

    return StaffPayslip(
      id: json['id'] as String? ?? '',
      payslipNumber: json['payslipNumber'] as String? ?? '',
      periodLabel: month > 0 && year > 0
          ? '${_monthName(month)} $year'
          : 'Payroll period',
      status: json['status'] as String? ?? 'DRAFT',
      paymentStatus: json['paymentStatus'] as String? ?? 'UNPAID',
      grossSalary: _double(json['grossSalary']),
      deductionAmount: _double(json['deductionAmount']),
      netSalary: _double(json['netSalary']),
      issuedAt: _date(json['issuedAt']) ?? _date(json['generatedAt']),
    );
  }
}

class StaffPayslipPdfDownload {
  const StaffPayslipPdfDownload({
    required this.fileName,
    required this.filePath,
    required this.payslip,
  });

  final String fileName;
  final String filePath;
  final StaffPayslip payslip;
}

Map<String, dynamic>? _asMap(Object? value) {
  return value is Map<String, dynamic> ? value : null;
}

DateTime? _date(Object? value) {
  if (value is DateTime) {
    return value;
  }
  if (value is String && value.isNotEmpty) {
    return DateTime.tryParse(value);
  }
  return null;
}

double _double(Object? value) {
  if (value is num) {
    return value.toDouble();
  }
  if (value is String) {
    return double.tryParse(value) ?? 0;
  }
  return 0;
}

int _int(Object? value) {
  if (value is num) {
    return value.toInt();
  }
  if (value is String) {
    return int.tryParse(value) ?? 0;
  }
  return 0;
}

String _monthName(int month) {
  const names = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  if (month < 1 || month > 12) {
    return 'Month';
  }
  return names[month - 1];
}
