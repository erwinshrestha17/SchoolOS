import '../../../core/errors/app_exception.dart';

class AttendanceCorrectionDetail {
  const AttendanceCorrectionDetail({
    required this.id,
    required this.studentName,
    required this.date,
    required this.status,
    required this.currentStatus,
    required this.requestedStatus,
    required this.reason,
    required this.requestedById,
    required this.markedById,
  });

  final String id,
      studentName,
      date,
      status,
      currentStatus,
      requestedStatus,
      reason;
  final String requestedById, markedById;

  factory AttendanceCorrectionDetail.fromJson(
    dynamic value,
    String expectedId,
  ) {
    const statuses = {
      'PRESENT',
      'ABSENT',
      'LATE',
      'HALF_DAY',
      'LEAVE',
      'ON_LEAVE',
      'HOLIDAY',
      'SICK_LEAVE',
      'EXCUSED_LEAVE',
      'UNEXCUSED_LEAVE',
      'EARLY_AUTHORIZED_DEPARTURE',
      'UNAUTHORIZED_DEPARTURE',
      'PERIOD_ABSENT',
    };
    if (value is! Map ||
        value['id'] != expectedId ||
        value['student'] is! Map ||
        value['record'] is! Map ||
        value['session'] is! Map ||
        value['session']['submittedBy'] is! Map ||
        value['requestedById'] is! String ||
        value['session']['submittedBy']['id'] is! String ||
        value['attendanceDate'] is! String ||
        DateTime.tryParse(value['attendanceDate'] as String) == null ||
        !{
          'PENDING',
          'APPROVED',
          'REJECTED',
          'CANCELLED',
        }.contains(value['status']) ||
        !statuses.contains(value['record']['status']) ||
        !statuses.contains(value['requestedStatus'])) {
      throw const ServerException(
        message:
            'Correction details could not be verified. Refresh before reviewing.',
      );
    }
    final student = value['student'] as Map;
    final name = [
      student['firstNameEn'],
      student['lastNameEn'],
    ].whereType<String>().join(' ').trim();
    if (name.isEmpty) {
      throw const ServerException(message: 'Student identity is unavailable.');
    }
    return AttendanceCorrectionDetail(
      id: expectedId,
      studentName: name,
      date: (value['attendanceDate'] as String).split('T').first,
      status: value['status'] as String,
      currentStatus: value['record']['status'] as String,
      requestedStatus: value['requestedStatus'] as String,
      reason: value['reason'] is String ? value['reason'] as String : '',
      requestedById: value['requestedById'] as String,
      markedById: value['session']['submittedBy']['id'] as String,
    );
  }
}
