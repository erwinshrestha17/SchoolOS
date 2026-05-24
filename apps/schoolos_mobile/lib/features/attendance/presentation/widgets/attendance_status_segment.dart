import 'package:flutter/material.dart';

import '../../../../app/design_system/app_radius.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../domain/attendance_models.dart';
import 'attendance_status_helpers.dart';

class AttendanceStatusSegment extends StatelessWidget {
  const AttendanceStatusSegment({
    super.key,
    required this.value,
    required this.onChanged,
  });

  final AttendanceStatus value;
  final ValueChanged<AttendanceStatus> onChanged;

  @override
  Widget build(BuildContext context) {
    const statuses = [
      AttendanceStatus.present,
      AttendanceStatus.absent,
      AttendanceStatus.late,
      AttendanceStatus.leave,
    ];

    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: statuses.map((status) {
        final selected = value == status;
        return InkWell(
          borderRadius: BorderRadius.circular(AppRadius.max),
          onTap: () => onChanged(status),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 160),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
            decoration: BoxDecoration(
              color: selected
                  ? status.color.withValues(alpha: 0.14)
                  : Colors.transparent,
              borderRadius: BorderRadius.circular(AppRadius.max),
              border: Border.all(
                color: selected
                    ? status.color
                    : status.color.withValues(alpha: 0.28),
              ),
            ),
            child: Text(
              status.label,
              style: TextStyle(
                color: status.color,
                fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                fontSize: 12,
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}
