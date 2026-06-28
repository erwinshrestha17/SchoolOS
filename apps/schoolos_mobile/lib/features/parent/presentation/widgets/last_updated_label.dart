import 'package:flutter/material.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../shared/utils/nepali_bs_calendar.dart';

class LastUpdatedLabel extends StatelessWidget {
  const LastUpdatedLabel({
    super.key,
    required this.lastUpdated,
    this.isOffline = false,
  });

  final DateTime? lastUpdated;
  final bool isOffline;

  @override
  Widget build(BuildContext context) {
    final label = lastUpdated == null
        ? 'Not synced yet'
        : 'Last updated ${NepaliBsCalendar.formatNepalTime(lastUpdated!)}';

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          isOffline ? Icons.cloud_off_rounded : Icons.cloud_done_rounded,
          size: 15,
          color: isOffline ? AppColors.warning : AppColors.success,
        ),
        const SizedBox(width: 6),
        Text(
          isOffline ? '$label • offline' : label,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: AppColors.slate500,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}
