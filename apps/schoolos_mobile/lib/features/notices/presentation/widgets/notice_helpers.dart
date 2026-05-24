import 'package:flutter/material.dart';

import '../../../../app/theme/app_colors.dart';
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
