import 'package:flutter/material.dart';

import '../../../../shared/utils/nepali_bs_calendar.dart';
import '../../application/parent_dashboard_view_model.dart';
import '../../domain/parent_portal_models.dart';
import 'parent_portal_widgets.dart';

/// The single place the parent dashboard turns a semantic enum into pixels.
///
/// Widgets never pick a colour or an icon themselves, so a status can be
/// restyled once here instead of in five cards, and a reviewer can check the
/// whole status palette in one screen. Colours come from
/// [ParentPortalColors], which is already contrast-pinned by
/// `accessibility_audit_test.dart`.
class ParentDashboardTokens {
  const ParentDashboardTokens._();

  /// Foreground colour for a status row.
  ///
  /// A benign status wears its module's accent (the reference design's green
  /// attendance tick and purple homework book); anything the parent should act
  /// on wears the semantic colour instead. Homework keeps the academic purple
  /// even when work is pending, because "some homework is set" is the normal
  /// state of a school week - the attention card above is what escalates it.
  static Color statusColor(ParentStatusKind kind, ParentStatusTone tone) {
    return switch (tone) {
      ParentStatusTone.critical => ParentPortalColors.red,
      ParentStatusTone.neutral => ParentPortalColors.muted,
      ParentStatusTone.unavailable => ParentPortalColors.muted,
      ParentStatusTone.informational => ParentPortalColors.blue,
      ParentStatusTone.attention =>
        kind == ParentStatusKind.homework
            ? ParentPortalColors.purple
            : ParentPortalColors.orange,
      ParentStatusTone.positive =>
        kind == ParentStatusKind.homework
            ? ParentPortalColors.purple
            : ParentPortalColors.green,
    };
  }

  /// The tinted circle behind a status icon.
  static Color statusSurface(ParentStatusKind kind, ParentStatusTone tone) {
    return switch (tone) {
      ParentStatusTone.critical => ParentPortalColors.redSoft,
      ParentStatusTone.neutral ||
      ParentStatusTone.unavailable => ParentPortalColors.surfaceAlt,
      ParentStatusTone.informational => ParentPortalColors.blueSoft,
      ParentStatusTone.attention =>
        kind == ParentStatusKind.homework
            ? ParentPortalColors.purpleSoft
            : ParentPortalColors.orangeSoft,
      ParentStatusTone.positive =>
        kind == ParentStatusKind.homework
            ? ParentPortalColors.purpleSoft
            : ParentPortalColors.greenSoft,
    };
  }

  /// The glyph itself carries meaning too, so the row survives greyscale.
  static IconData statusIcon(ParentStatusKind kind, ParentStatusTone tone) {
    if (tone == ParentStatusTone.unavailable) {
      return Icons.lock_outline_rounded;
    }
    return switch (kind) {
      ParentStatusKind.attendance => switch (tone) {
        ParentStatusTone.positive => Icons.check_circle_outline_rounded,
        ParentStatusTone.critical => Icons.cancel_outlined,
        ParentStatusTone.attention => Icons.schedule_rounded,
        ParentStatusTone.informational => Icons.event_busy_outlined,
        _ => Icons.help_outline_rounded,
      },
      ParentStatusKind.homework => Icons.menu_book_outlined,
      ParentStatusKind.fees => switch (tone) {
        ParentStatusTone.positive => Icons.verified_outlined,
        ParentStatusTone.critical => Icons.error_outline_rounded,
        ParentStatusTone.attention => Icons.account_balance_wallet_outlined,
        _ => Icons.receipt_long_outlined,
      },
    };
  }

  static IconData priorityIcon(ParentPriorityKind kind) {
    return switch (kind) {
      ParentPriorityKind.transport => Icons.directions_bus_outlined,
      ParentPriorityKind.fees => Icons.account_balance_wallet_outlined,
      ParentPriorityKind.homework => Icons.menu_book_outlined,
      ParentPriorityKind.updates => Icons.notifications_none_rounded,
    };
  }

  static IconData updateIcon(ParentUpdateCategory category) {
    return switch (category) {
      ParentUpdateCategory.notice => Icons.campaign_outlined,
      ParentUpdateCategory.message => Icons.forum_outlined,
      ParentUpdateCategory.event => Icons.calendar_month_outlined,
      ParentUpdateCategory.gallery => Icons.photo_library_outlined,
    };
  }

  static Color urgencyColor(ParentUpcomingUrgency urgency) {
    return switch (urgency) {
      ParentUpcomingUrgency.overdue => ParentPortalColors.red,
      ParentUpcomingUrgency.dueToday => ParentPortalColors.orange,
      ParentUpcomingUrgency.dueTomorrow => ParentPortalColors.blue,
      ParentUpcomingUrgency.later => ParentPortalColors.blue,
    };
  }
}

/// The due date exactly as the reference reads it - "Due 26/7" - with the
/// urgent cases spelled out in words so the colour is never the only signal.
///
/// The day and month are read in Asia/Kathmandu through [NepaliBsCalendar],
/// not on the device clock: a guardian who lands abroad must still see the
/// school's date. `intl`'s date formatters are deliberately not used - they
/// format against the device timezone, and `nepali_bs_calendar_test.dart`
/// bans them across `lib/` for exactly that reason.
String formatDueLabel(ParentUpcomingItem item) {
  return switch (item.urgency) {
    ParentUpcomingUrgency.overdue => 'Overdue',
    ParentUpcomingUrgency.dueToday => 'Due today',
    ParentUpcomingUrgency.dueTomorrow => 'Due tomorrow',
    ParentUpcomingUrgency.later => 'Due ${_dayMonthInNepal(item.dueAt)}',
  };
}

String _dayMonthInNepal(DateTime value) {
  final local = NepaliBsCalendar.toNepalLocalDateTime(value);
  return '${local.day}/${local.month}';
}
