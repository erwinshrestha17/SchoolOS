import 'package:flutter/material.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../shared/utils/nepali_bs_calendar.dart';
import '../../application/notices_providers.dart';
import '../../domain/notice_models.dart';

extension NoticeCategoryUi on NoticeCategory {
  String get label {
    switch (this) {
      case NoticeCategory.general:
        return 'General';
      case NoticeCategory.important:
        return 'Important';
      case NoticeCategory.emergency:
        return 'Emergency';
      case NoticeCategory.academic:
        return 'Academic';
      case NoticeCategory.fee:
        return 'Fee';
      case NoticeCategory.transport:
        return 'Transport';
      case NoticeCategory.homework:
        return 'Homework';
      case NoticeCategory.approval:
        return 'Approval';
    }
  }

  IconData get icon {
    switch (this) {
      case NoticeCategory.emergency:
        return Icons.warning_amber_rounded;
      case NoticeCategory.fee:
        return Icons.account_balance_wallet_rounded;
      case NoticeCategory.transport:
        return Icons.directions_bus_rounded;
      case NoticeCategory.homework:
        return Icons.menu_book_rounded;
      case NoticeCategory.academic:
        return Icons.school_rounded;
      case NoticeCategory.approval:
        return Icons.task_alt_rounded;
      case NoticeCategory.important:
        return Icons.priority_high_rounded;
      case NoticeCategory.general:
        return Icons.campaign_rounded;
    }
  }

  Color get color {
    switch (this) {
      case NoticeCategory.emergency:
        return AppColors.danger;
      case NoticeCategory.important:
        return AppColors.warning;
      case NoticeCategory.fee:
        return AppColors.success;
      case NoticeCategory.transport:
        return AppColors.driverAccent;
      case NoticeCategory.homework:
      case NoticeCategory.academic:
        return AppColors.primary;
      case NoticeCategory.approval:
        return AppColors.adminAccent;
      case NoticeCategory.general:
        return AppColors.info;
    }
  }
}

extension NoticeFilterUi on NoticeFilter {
  String get label {
    switch (this) {
      case NoticeFilter.all:
        return 'All';
      case NoticeFilter.unread:
        return 'Unread';
      case NoticeFilter.important:
        return 'Important';
      case NoticeFilter.emergency:
        return 'Emergency';
    }
  }
}

String parentCommunicationTimestamp(DateTime value, {DateTime? now}) {
  final reference = now ?? DateTime.now();
  final time = NepaliBsCalendar.formatNepalTime(
    value,
  ).replaceFirst(' NPT', '').replaceFirst(RegExp(r'^0'), '');

  if (NepaliBsCalendar.isSameNepalSchoolDay(value, reference)) {
    return 'Today · $time';
  }

  final yesterday = NepaliBsCalendar.startOfNepalSchoolDayUtc(
    reference,
  ).subtract(const Duration(days: 1));
  if (NepaliBsCalendar.isSameNepalSchoolDay(value, yesterday)) {
    return 'Yesterday · $time';
  }

  final date = NepaliBsCalendar.formatBsDate(value);
  return '$date · $time';
}

String parentCommunicationTimeGroup(DateTime value, {DateTime? now}) {
  final reference = now ?? DateTime.now();
  if (NepaliBsCalendar.isSameNepalSchoolDay(value, reference)) {
    return 'Today';
  }

  final startOfToday = NepaliBsCalendar.startOfNepalSchoolDayUtc(reference);
  final yesterday = startOfToday.subtract(const Duration(days: 1));
  if (NepaliBsCalendar.isSameNepalSchoolDay(value, yesterday)) {
    return 'Yesterday';
  }

  final local = NepaliBsCalendar.toNepalLocalDateTime(reference);
  final weekday = DateTime.utc(local.year, local.month, local.day).weekday;
  final startOfWeek = startOfToday.subtract(Duration(days: weekday % 7));
  if (!value.toUtc().isBefore(startOfWeek)) {
    return 'This week';
  }
  return 'Earlier';
}
