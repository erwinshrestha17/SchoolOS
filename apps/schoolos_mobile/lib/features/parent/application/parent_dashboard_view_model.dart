/// Presentation mapping for the parent Today dashboard.
///
/// Deliberately free of Flutter imports: everything here is a decision about
/// *what* the parent is told (which status, which wording, which priority),
/// not *how* it is drawn. Icons and colours are chosen by
/// `parent_dashboard_tokens.dart` from the enums below, so the rules stay
/// testable without a widget tree and the widgets stay presentation-only.
library;

import '../../../app/constants/app_routes.dart';
import '../../../shared/utils/money_format.dart';
import '../../../shared/utils/nepali_bs_calendar.dart';
import '../domain/parent_portal_models.dart';

/// Semantic tone of a status. Never inferred from colour alone at the widget
/// layer - every row that carries a tone also carries wording that says the
/// same thing.
enum ParentStatusTone {
  /// Settled, nothing for the parent to do.
  positive,

  /// Needs the parent's attention, but nothing has gone wrong.
  attention,

  /// Something is wrong and the parent should act.
  critical,

  /// A neutral fact (on leave, holiday, not yet recorded).
  informational,

  /// The school has not recorded anything either way. Explicitly *not*
  /// [positive]: "no record" is not good news, and rendering it as reassurance
  /// is how a parent misses an absence.
  neutral,

  /// The module is off, or the data did not load.
  unavailable,
}

/// Which summary row a status belongs to. Drives icon choice only.
enum ParentStatusKind { attendance, homework, fees }

/// The pending things a parent can be asked to deal with, in the order they
/// outrank each other. Declaration order *is* the priority order.
enum ParentPriorityKind { transport, fees, homework, updates }

/// How close a dated item is, in words as well as colour.
enum ParentUpcomingUrgency { overdue, dueToday, dueTomorrow, later }

/// One tappable line in the school-day summary card.
class ParentStatusRow {
  const ParentStatusRow({
    required this.kind,
    required this.tone,
    required this.title,
    required this.subtitle,
    required this.route,
    this.isStale = false,
  });

  final ParentStatusKind kind;
  final ParentStatusTone tone;
  final String title;
  final String? subtitle;
  final String route;

  /// This row is being drawn from an offline snapshot. Only money carries it
  /// today: a fee balance a parent might act on - pay, or chase the school
  /// about - must never look settled on the strength of a saved copy.
  final bool isStale;

  /// What a screen reader announces. Includes the row's subject and its full
  /// status, so the meaning does not depend on seeing the icon's colour.
  String get semanticLabel {
    const names = {
      ParentStatusKind.attendance: 'Attendance',
      ParentStatusKind.homework: 'Homework',
      ParentStatusKind.fees: 'Fees',
    };
    final detail = subtitle == null ? '' : '. ${subtitle!}';
    final saved = isStale ? '. Saved copy, not live' : '';
    return '${names[kind]}: $title$detail$saved';
  }
}

/// A pending action the parent should deal with, most urgent first.
class ParentPriorityAction {
  const ParentPriorityAction({
    required this.kind,
    required this.summary,
    required this.route,
  });

  final ParentPriorityKind kind;

  /// Reads as a complete phrase on its own: "3 homework items due".
  final String summary;
  final String route;
}

/// A dated thing the parent should know is coming, nearest deadline first.
///
/// Only homework carries real dates today. Exams and school events have
/// working endpoints (`students/:id/exam-schedule`, `/events`) but no
/// published records in any tenant seen so far, so they contribute nothing
/// yet; this list is shaped so they slot in without reworking the card.
class ParentUpcomingItem {
  const ParentUpcomingItem({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.dueAt,
    required this.urgency,
    required this.route,
  });

  final String id;
  final String title;

  /// The subject, or whatever else identifies the item's source.
  final String subtitle;
  final DateTime dueAt;
  final ParentUpcomingUrgency urgency;
  final String route;
}

/// The single most recent thing the school told this parent.
class ParentLatestUpdate {
  const ParentLatestUpdate({
    required this.category,
    required this.title,
    required this.body,
    required this.metadata,
    required this.route,
  });

  final ParentUpdateCategory category;
  final String title;
  final String? body;
  final String? metadata;
  final String route;
}

/// The selected child, projected for the dashboard.
class ParentDashboardChild {
  const ParentDashboardChild({
    required this.id,
    required this.name,
    required this.classSection,
    required this.teacher,
    required this.statusRows,
    required this.route,
  });

  final String id;
  final String name;
  final String classSection;

  /// Null when the school has not assigned a class teacher; the card drops the
  /// line rather than printing a placeholder.
  final String? teacher;
  final List<ParentStatusRow> statusRows;
  final String route;

  String get firstName => firstNameOf(name);
}

/// Everything the Today screen draws, derived once per build.
class ParentDashboardViewModel {
  const ParentDashboardViewModel({
    required this.guardianName,
    required this.child,
    required this.linkedChildCount,
    required this.priority,
    required this.otherPriorityCount,
    required this.upcoming,
    required this.latestUpdate,
    required this.unreadUpdateCount,
    required this.lastUpdated,
    required this.isStale,
  });

  /// Null when the account has no usable human name. The header greets
  /// without one rather than printing a login handle at a parent.
  final String? guardianName;

  /// Null when no child is linked to this guardian account.
  final ParentDashboardChild? child;
  final int linkedChildCount;

  /// The single most important pending action, or null when nothing is
  /// waiting on the parent.
  final ParentPriorityAction? priority;

  /// How many further pending actions exist behind [priority].
  final int otherPriorityCount;
  final List<ParentUpcomingItem> upcoming;
  final ParentLatestUpdate? latestUpdate;
  final int unreadUpdateCount;
  final DateTime lastUpdated;

  /// The data came from the offline cache rather than the network.
  final bool isStale;

  bool get hasChild => child != null;

  /// At most this many dated items reach the dashboard; the rest live behind
  /// "View all". A heavy homework week must not push the page's other
  /// sections below the fold.
  static const upcomingLimit = 3;

  factory ParentDashboardViewModel.from(
    ParentPortalData data, {
    required DateTime now,
  }) {
    final child = data.activeChild;
    final actions = child == null
        ? const <ParentPriorityAction>[]
        : priorityActionsFor(child);

    return ParentDashboardViewModel(
      guardianName: guardianDisplayName(data.parentName),
      child: child == null
          ? null
          : _projectChild(child, isStale: data.fromCache),
      linkedChildCount: data.children.length,
      priority: actions.isEmpty ? null : actions.first,
      otherPriorityCount: actions.isEmpty ? 0 : actions.length - 1,
      upcoming: child == null
          ? const []
          : upcomingItemsFor(data, childId: child.id, now: now),
      latestUpdate: child == null
          ? null
          : latestUpdateFor(data, childId: child.id),
      unreadUpdateCount: data.unreadUpdates,
      lastUpdated: data.lastUpdated,
      isStale: data.fromCache,
    );
  }
}

ParentDashboardChild _projectChild(
  ParentPortalChild child, {
  required bool isStale,
}) {
  return ParentDashboardChild(
    id: child.id,
    name: child.name,
    classSection: child.classSection,
    teacher: _teacherOrNull(child.teacher),
    route: AppRoutes.parentChildDetail(child.id),
    statusRows: [
      attendanceRowFor(child),
      homeworkRowFor(child),
      feesRowFor(child, isStale: isStale),
    ],
  );
}

/// The repository sends a sentence when no teacher is on record. That is a
/// placeholder, not a name, so the card omits the line instead.
String? _teacherOrNull(String value) {
  final trimmed = value.trim();
  if (trimmed.isEmpty) return null;
  final lower = trimmed.toLowerCase();
  if (lower.contains('not assigned') || lower.contains('unavailable')) {
    return null;
  }
  return trimmed;
}

/// A name a parent would recognise, or null.
///
/// Guardian accounts are frequently provisioned without a first or last name,
/// and [ParentPortalData.parentName] then falls back to the login local part
/// - `guardian.c01a001`. Greeting a parent with their database handle is worse
/// than not naming them at all, so handle-shaped values are rejected here and
/// the header greets without a name.
String? guardianDisplayName(String raw) {
  final trimmed = raw.trim();
  if (trimmed.isEmpty) return null;
  if (trimmed.toLowerCase() == 'parent') return null;
  if (_looksLikeAccountHandle(trimmed)) return null;
  return trimmed;
}

bool _looksLikeAccountHandle(String value) {
  // A real name has a space, or at least no punctuation and no digits.
  // `guardian.c01a001`, `parent_204`, `c01a001@school.edu` fail all three.
  if (value.contains('@')) return true;
  if (value.contains(RegExp(r'\s'))) return false;
  return value.contains(RegExp(r'[._\-/\\]')) || value.contains(RegExp(r'\d'));
}

/// The child's given name, for the section heading. Falls back to the whole
/// value so a single-word name still reads correctly.
String firstNameOf(String value) {
  final parts = value.trim().split(RegExp(r'\s+'));
  return parts.isEmpty || parts.first.isEmpty ? value.trim() : parts.first;
}

// ---------------------------------------------------------------------------
// Status rows
// ---------------------------------------------------------------------------

/// Attendance arrives as a label the school composed, not a status code, so
/// the tone is read back out of the wording.
///
/// Anything unrecognised lands on [ParentStatusTone.neutral], never
/// [ParentStatusTone.positive]: the dashboard must not invent a full day's
/// attendance out of a phrase it does not understand.
ParentStatusTone attendanceToneFromLabel(String label) {
  final value = label.trim().toLowerCase();
  if (value.isEmpty) return ParentStatusTone.unavailable;
  if (value.contains('locked') ||
      value.contains('no attendance summary') ||
      value.contains('not synced') ||
      value.contains('unavailable')) {
    return ParentStatusTone.unavailable;
  }
  if (value.contains('not marked') ||
      value.contains('not recorded') ||
      value.contains('no record')) {
    return ParentStatusTone.neutral;
  }
  if (value.contains('absent')) return ParentStatusTone.critical;
  if (value.contains('late') ||
      value.contains('half day') ||
      value.contains('half-day')) {
    return ParentStatusTone.attention;
  }
  if (value.contains('leave') ||
      value.contains('excused') ||
      value.contains('holiday') ||
      value.contains('festival')) {
    return ParentStatusTone.informational;
  }
  if (value.contains('present')) return ParentStatusTone.positive;
  return ParentStatusTone.neutral;
}

ParentStatusRow attendanceRowFor(ParentPortalChild child) {
  final label = child.attendance.trim();
  return ParentStatusRow(
    kind: ParentStatusKind.attendance,
    // Read the tone from what the school actually sent, not from the
    // stand-in wording below - an empty field means "unknown", and the
    // stand-in must not be re-parsed into something softer.
    tone: attendanceToneFromLabel(label),
    title: label.isEmpty ? 'Attendance not available' : label,
    subtitle: child.attendanceTime.trim().isEmpty
        ? null
        : child.attendanceTime.trim(),
    route: AppRoutes.parentChildAttendanceDetail(child.id),
  );
}

ParentStatusRow homeworkRowFor(ParentPortalChild child) {
  final locked = child.homework.toLowerCase().contains('locked');
  final title = child.homework.trim().isEmpty
      ? 'Homework not available'
      : child.homework.trim();
  return ParentStatusRow(
    kind: ParentStatusKind.homework,
    tone: locked
        ? ParentStatusTone.unavailable
        : child.homeworkPending > 0
        ? ParentStatusTone.attention
        : ParentStatusTone.positive,
    title: title,
    subtitle: child.updates.trim().isEmpty ? null : child.updates.trim(),
    route: Uri(
      path: AppRoutes.parentHomework,
      queryParameters: {'child': child.id},
    ).toString(),
  );
}

/// Fees, told apart properly.
///
/// The backend reports nothing outstanding both for a settled account and for
/// a child the school has never invoiced. Only the first is "paid"; the second
/// is an absence of information and says so.
ParentStatusRow feesRowFor(ParentPortalChild child, {bool isStale = false}) {
  final status = child.feesStatus.trim().toUpperCase();
  final (tone, title, subtitle) = switch (child) {
    _ when status == 'LOCKED' => (
      ParentStatusTone.unavailable,
      'Fee status not available',
      null,
    ),
    _ when child.hasFeesDue && status == 'OVERDUE' => (
      ParentStatusTone.critical,
      'Fees overdue ${formatMoney(child.feesDue)}',
      _nextDueSubtitle(child),
    ),
    _ when child.hasFeesDue && child.feesPaidAmount > 0 => (
      ParentStatusTone.attention,
      'Partly paid, ${formatMoney(child.feesDue)} left',
      _nextDueSubtitle(child),
    ),
    _ when child.hasFeesDue => (
      ParentStatusTone.attention,
      'Fees due ${formatMoney(child.feesDue)}',
      _nextDueSubtitle(child),
    ),
    _ when child.hasNoFeeInvoices => (
      ParentStatusTone.neutral,
      'No fee invoice issued',
      'Nothing to pay yet',
    ),
    _ => (ParentStatusTone.positive, 'Fees paid', 'School fee status'),
  };

  return ParentStatusRow(
    kind: ParentStatusKind.fees,
    tone: tone,
    title: title,
    subtitle: subtitle,
    route: AppRoutes.parentFees,
    isStale: isStale,
  );
}

String? _nextDueSubtitle(ParentPortalChild child) {
  final date = DateTime.tryParse(child.nextFeeDueDate ?? '');
  if (date == null) return 'School fee status';
  return 'Next due ${date.year}-${_two(date.month)}-${_two(date.day)}';
}

String _two(int value) => value.toString().padLeft(2, '0');

// ---------------------------------------------------------------------------
// Priority
// ---------------------------------------------------------------------------

/// Everything currently waiting on the parent, most important first.
///
/// The order is the existing portal rule and is deliberately not "newest
/// first": a stalled bus outranks money, money outranks homework, and an
/// unread notice is the weakest signal of the four.
List<ParentPriorityAction> priorityActionsFor(ParentPortalChild child) {
  final actions = <ParentPriorityAction>[];
  final transport = '${child.transport} ${child.transportDetail ?? ''}'
      .toLowerCase();

  if (transport.contains('stale') || transport.contains('delayed')) {
    actions.add(
      const ParentPriorityAction(
        kind: ParentPriorityKind.transport,
        summary: 'Transport update needs review',
        route: AppRoutes.parentTransport,
      ),
    );
  }
  if (child.feesDue > 0) {
    actions.add(
      ParentPriorityAction(
        kind: ParentPriorityKind.fees,
        summary: '${formatMoney(child.feesDue)} fees due',
        route: AppRoutes.parentFees,
      ),
    );
  }
  if (child.homeworkPending > 0) {
    actions.add(
      ParentPriorityAction(
        kind: ParentPriorityKind.homework,
        summary:
            '${child.homeworkPending} homework item${child.homeworkPending == 1 ? '' : 's'} due',
        route: Uri(
          path: AppRoutes.parentHomework,
          queryParameters: {'child': child.id},
        ).toString(),
      ),
    );
  }
  if (child.unreadUpdates > 0) {
    actions.add(
      ParentPriorityAction(
        kind: ParentPriorityKind.updates,
        summary:
            '${child.unreadUpdates} unread update${child.unreadUpdates == 1 ? '' : 's'}',
        route: AppRoutes.parentUpdates,
      ),
    );
  }

  return actions;
}

// ---------------------------------------------------------------------------
// Coming up
// ---------------------------------------------------------------------------

/// Pending, dated work for the selected child only.
///
/// Completed work is excluded - it is not "coming up" - and the list is capped
/// so the card cannot grow without bound on a heavy homework week.
List<ParentUpcomingItem> upcomingItemsFor(
  ParentPortalData data, {
  required String childId,
  required DateTime now,
}) {
  final items =
      data.homework
          .where(
            (item) =>
                item.childId == childId &&
                !item.isCompleted &&
                item.dueAt != null,
          )
          .map(
            (item) => ParentUpcomingItem(
              id: item.id,
              title: item.title,
              subtitle: item.subject,
              dueAt: item.dueAt!,
              urgency: urgencyFor(item.dueAt!, now),
              route: AppRoutes.parentHomeworkDetail(item.id),
            ),
          )
          .toList()
        // Nearest deadline first; ties break on title so the order is stable
        // across refreshes rather than following the API's arrival order.
        ..sort((a, b) {
          final byDate = a.dueAt.compareTo(b.dueAt);
          return byDate != 0 ? byDate : a.title.compareTo(b.title);
        });

  return List.unmodifiable(items.take(ParentDashboardViewModel.upcomingLimit));
}

/// How urgent a deadline is *on the school's calendar*.
///
/// Both instants are collapsed to the start of their Asia/Kathmandu day before
/// they are compared, so a guardian travelling in another timezone is told
/// what the school would say, not what their handset's midnight implies.
ParentUpcomingUrgency urgencyFor(DateTime dueAt, DateTime now) {
  final due = NepaliBsCalendar.startOfNepalSchoolDayUtc(dueAt);
  final today = NepaliBsCalendar.startOfNepalSchoolDayUtc(now);
  final days = due.difference(today).inDays;
  if (days < 0) return ParentUpcomingUrgency.overdue;
  if (days == 0) return ParentUpcomingUrgency.dueToday;
  if (days == 1) return ParentUpcomingUrgency.dueTomorrow;
  return ParentUpcomingUrgency.later;
}

// ---------------------------------------------------------------------------
// Latest update
// ---------------------------------------------------------------------------

/// The newest school update this parent may see, or null.
///
/// School-wide updates (`childId == null`) count for every child; a
/// sibling-scoped one does not leak onto the selected child's dashboard.
ParentLatestUpdate? latestUpdateFor(
  ParentPortalData data, {
  required String childId,
}) {
  final visible = data.updates
      .where((update) => update.childId == null || update.childId == childId)
      .toList();
  if (visible.isEmpty) return null;

  for (final update in visible) {
    final title = displayUpdateTitle(update.title);
    if (title == null) continue;
    return ParentLatestUpdate(
      category: update.category,
      title: title,
      body: update.body.trim().isEmpty ? null : update.body.trim(),
      metadata: update.metadata.trim().isEmpty ? null : update.metadata.trim(),
      route: update.route ?? AppRoutes.parentUpdates,
    );
  }
  return null;
}

/// A notice title as a parent should read it, or null when nothing readable
/// is left.
///
/// School-authored titles pass through untouched. What is stripped is the
/// machine identifier that automated fixtures append - a bare run of twelve or
/// more digits, which is an epoch millisecond stamp or a database key and
/// means nothing to a guardian. A title that is *only* an identifier is
/// rejected outright so the card falls through to the next update rather than
/// showing a number.
///
/// Twelve, not ten: a Nepali mobile number is ten digits, and a school notice
/// that says "call 9841234567" must keep it. Epoch milliseconds have been
/// thirteen digits since 2001 and stay thirteen until 2286, so the two ranges
/// cannot collide.
///
/// This is a last line of defence, not the fix. The identifiers reaching
/// production data come from E2E specs writing into the shared dev tenant;
/// see the notes in `apps/web/e2e/m12-m15-notice-workflows.spec.ts`.
String? displayUpdateTitle(String raw) {
  final stripped = raw
      .replaceAll(RegExp(r'\b\d{12,}\b'), ' ')
      .replaceAll(RegExp(r'\s+'), ' ')
      .trim()
      // A trailing separator left behind by the removal ("Notice -").
      .replaceAll(RegExp(r'[\s\-–—:#]+$'), '')
      .trim();
  return stripped.isEmpty ? null : stripped;
}
