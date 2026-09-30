// GENERATED MIRROR of packages/core/src/status-tone.ts — keep in sync.
// apps/web/test/status-tone-parity.test.mjs fails if the two drift.

import 'package:flutter/material.dart';
import '../../app/theme/app_colors.dart';

/// Semantic status tones shared with the Web `StatusBadge`.
enum StatusTone {
  active,
  inactive,
  pending,
  approved,
  rejected,
  draft,
  published,
  locked,
  paid,
  partial,
  unpaid,
  overdue,
  waived,
  refunded,
  conflict,
  info,
}

const Map<String, StatusTone> statusToneMap = {
  'ACTIVE': StatusTone.active,
  'OPEN': StatusTone.active,
  'RESOLVED': StatusTone.approved,
  'INACTIVE': StatusTone.inactive,
  'CLOSED': StatusTone.locked,
  'CANCELLED': StatusTone.inactive,
  'PENDING': StatusTone.pending,
  'QUEUED': StatusTone.pending,
  'PENDING_CONFIRMATION': StatusTone.pending,
  'RETRYING': StatusTone.pending,
  'RETRIED': StatusTone.pending,
  'SUBMITTED': StatusTone.pending,
  'PROCESSING': StatusTone.pending,
  'DISPATCHING': StatusTone.pending,
  'SCHEDULED': StatusTone.pending,
  'APPROVAL_PENDING': StatusTone.pending,
  'SUCCEEDED': StatusTone.approved,
  'APPROVED': StatusTone.approved,
  'REVIEWED': StatusTone.approved,
  'ACTION_TAKEN': StatusTone.approved,
  'REJECTED': StatusTone.rejected,
  'ACCESS_DENIED': StatusTone.rejected,
  'ACCESS_REVOKED': StatusTone.rejected,
  'LOCAL_DRAFT_UNAVAILABLE': StatusTone.rejected,
  'NEEDS_CORRECTION': StatusTone.partial,
  'PARTIALLY_SUCCEEDED': StatusTone.partial,
  'PARTIALLY_DELIVERED': StatusTone.partial,
  'DISMISSED': StatusTone.rejected,
  'FAILED': StatusTone.rejected,
  'EXPIRED': StatusTone.rejected,
  'SKIPPED': StatusTone.inactive,
  'ARCHIVED': StatusTone.inactive,
  'DRAFT': StatusTone.draft,
  'SENT': StatusTone.published,
  'DELIVERED': StatusTone.published,
  'PUBLISHED': StatusTone.published,
  'READ': StatusTone.approved,
  'LOCKED': StatusTone.locked,
  'POSTED': StatusTone.locked,
  'FINALIZED': StatusTone.locked,
  'REVERSED': StatusTone.refunded,
  'RETURNED': StatusTone.partial,
  'RESUBMITTED': StatusTone.pending,
  'CORRECTED': StatusTone.info,
  'CORRECTION_REQUESTED': StatusTone.partial,
  'CONFLICTED': StatusTone.conflict,
  'PAID': StatusTone.paid,
  'PARTIAL': StatusTone.partial,
  'UNPAID': StatusTone.unpaid,
  'OVERDUE': StatusTone.overdue,
  'WAIVED': StatusTone.waived,
  'REFUNDED': StatusTone.refunded,
  'CONFLICT': StatusTone.conflict,
  'ESCALATED': StatusTone.conflict,
  'TRANSFERRED': StatusTone.pending,
  'ALUMNI': StatusTone.published,
  'GRADUATED': StatusTone.published,
  'DEACTIVATED': StatusTone.inactive,
  'WITHDRAWN': StatusTone.inactive,
  'PRESENT': StatusTone.approved,
  'ABSENT': StatusTone.rejected,
  'LATE': StatusTone.partial,
  'SICK_LEAVE': StatusTone.info,
  'EXCUSED_LEAVE': StatusTone.info,
  'UNEXCUSED_LEAVE': StatusTone.partial,
  'DUE': StatusTone.pending,
  'NOT_RECORDED': StatusTone.draft,
  'SYNCING': StatusTone.pending,
  'SYNCED': StatusTone.approved,
  'UNAVAILABLE': StatusTone.inactive,
};

/// Tone for a backend status string; unknown statuses read as neutral info.
StatusTone resolveStatusTone(String status) =>
    statusToneMap[status.trim().toUpperCase()] ?? StatusTone.info;

/// (background, foreground) for a tone, matching the Web tone classes.
(Color, Color) statusToneColors(StatusTone tone, {required bool isDark}) {
  Color bg(Color light) => light.withValues(alpha: isDark ? 0.15 : 0.8);
  switch (tone) {
    case StatusTone.active:
    case StatusTone.approved:
    case StatusTone.paid:
      return (
        bg(AppColors.successLight),
        isDark ? AppColors.success : AppColors.successDark,
      );
    case StatusTone.pending:
    case StatusTone.partial:
      return (
        bg(AppColors.warningLight),
        isDark ? AppColors.warning : AppColors.warningDark,
      );
    case StatusTone.rejected:
    case StatusTone.unpaid:
    case StatusTone.overdue:
    case StatusTone.conflict:
      return (
        bg(AppColors.dangerLight),
        isDark ? AppColors.danger : AppColors.dangerDark,
      );
    case StatusTone.published:
      return (
        bg(AppColors.primaryLight),
        isDark ? AppColors.primary : AppColors.primaryDark,
      );
    case StatusTone.waived:
    case StatusTone.info:
      return (
        bg(AppColors.infoLight),
        isDark ? AppColors.info : AppColors.infoDark,
      );
    case StatusTone.locked:
      return (
        isDark ? AppColors.slate700 : AppColors.slate200,
        isDark ? AppColors.slate200 : AppColors.slate700,
      );
    case StatusTone.inactive:
    case StatusTone.draft:
    case StatusTone.refunded:
      return (
        isDark ? AppColors.slate800 : AppColors.slate100,
        isDark ? AppColors.slate300 : AppColors.slate600,
      );
  }
}
