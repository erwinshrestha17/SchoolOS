import 'package:flutter/material.dart';

import '../../../../app/design_system/app_radius.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../domain/attendance_models.dart';
import 'attendance_status_helpers.dart';

class AttendanceCalendar extends StatelessWidget {
  const AttendanceCalendar({super.key, required this.days});

  final List<AttendanceDay> days;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: days.length,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 7,
            mainAxisSpacing: AppSpacing.sm,
            crossAxisSpacing: AppSpacing.sm,
          ),
          itemBuilder: (context, index) {
            final day = days[index];
            return Container(
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: day.status.color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(AppRadius.md),
                border: Border.all(
                  color: day.status.color.withValues(alpha: 0.32),
                ),
              ),
              child: Text(
                '${day.date.day}',
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: day.status.color,
                  fontWeight: FontWeight.w800,
                ),
              ),
            );
          },
        ),
        const SizedBox(height: AppSpacing.lg),
        Wrap(
          spacing: AppSpacing.md,
          runSpacing: AppSpacing.sm,
          children: AttendanceStatus.values.map((status) {
            return Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    color: status.color,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  status.label,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.slate600,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            );
          }).toList(),
        ),
      ],
    );
  }
}
