import 'package:flutter/material.dart';

import '../../../../app/theme/app_colors.dart';
import '../../domain/attendance_models.dart';

extension AttendanceStatusUi on AttendanceStatus {
  String get label {
    switch (this) {
      case AttendanceStatus.present:
        return 'Present';
      case AttendanceStatus.absent:
        return 'Absent';
      case AttendanceStatus.late:
        return 'Late';
      case AttendanceStatus.leave:
        return 'Leave';
      case AttendanceStatus.festival:
        return 'Festival';
      case AttendanceStatus.holiday:
        return 'Holiday';
    }
  }

  Color get color {
    switch (this) {
      case AttendanceStatus.present:
        return AppColors.success;
      case AttendanceStatus.absent:
        return AppColors.danger;
      case AttendanceStatus.late:
        return AppColors.warning;
      case AttendanceStatus.leave:
        return AppColors.info;
      case AttendanceStatus.festival:
        return AppColors.teacherAccent;
      case AttendanceStatus.holiday:
        return AppColors.slate400;
    }
  }
}
