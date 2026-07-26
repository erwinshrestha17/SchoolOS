class ParentActionCentre {
  const ParentActionCentre({
    required this.generatedAt,
    required this.dataState,
    required this.selectedStudentId,
    required this.children,
    required this.summary,
    required this.items,
    required this.sources,
    required this.truncated,
  });

  final DateTime generatedAt;
  final String dataState;
  final String? selectedStudentId;
  final List<ParentActionChild> children;
  final ParentActionSummary summary;
  final List<ParentActionItem> items;
  final Map<String, ParentActionSourceState> sources;
  final bool truncated;

  bool get isLive => dataState == 'LIVE';

  factory ParentActionCentre.fromJson(Map<String, dynamic> json) {
    final scope = _map(json['scope']);
    return ParentActionCentre(
      generatedAt: _date(json['generatedAt']),
      dataState: _string(json['dataState'], fallback: 'UNAVAILABLE'),
      selectedStudentId: _nullableString(scope?['selectedStudentId']),
      children: _list(scope?['children'])
          .whereType<Map<String, dynamic>>()
          .map(ParentActionChild.fromJson)
          .toList(),
      summary: ParentActionSummary.fromJson(_map(json['summary']) ?? const {}),
      items: _list(json['items'])
          .whereType<Map<String, dynamic>>()
          .map(ParentActionItem.fromJson)
          .toList(),
      sources:
          _map(json['sources'])?.map(
            (key, value) => MapEntry(
              key,
              ParentActionSourceState.fromJson(_map(value) ?? const {}),
            ),
          ) ??
          const {},
      truncated: json['truncated'] == true,
    );
  }
}

class ParentActionSummary {
  const ParentActionSummary({
    required this.visibleActionCount,
    required this.urgentCount,
    required this.returnedCount,
    required this.isPartial,
  });

  final int visibleActionCount;
  final int urgentCount;
  final int returnedCount;
  final bool isPartial;

  factory ParentActionSummary.fromJson(Map<String, dynamic> json) {
    return ParentActionSummary(
      visibleActionCount: _integer(json['visibleActionCount']),
      urgentCount: _integer(json['urgentCount']),
      returnedCount: _integer(json['returnedCount']),
      isPartial: json['isPartial'] == true,
    );
  }
}

class ParentActionChild {
  const ParentActionChild({
    required this.id,
    required this.name,
    required this.classSection,
  });

  final String id;
  final String name;
  final String classSection;

  factory ParentActionChild.fromJson(Map<String, dynamic> json) {
    return ParentActionChild(
      id: _string(json['id']),
      name: _string(json['name'], fallback: 'Linked child'),
      classSection: _string(json['classSection']),
    );
  }
}

class ParentActionSourceState {
  const ParentActionSourceState({required this.status, this.reason});

  final String status;
  final String? reason;

  bool get isAvailable => status == 'available';

  factory ParentActionSourceState.fromJson(Map<String, dynamic> json) {
    final status = _string(json['status'], fallback: 'unavailable');
    return ParentActionSourceState(
      status:
          const {
            'available',
            'partial',
            'locked',
            'unavailable',
          }.contains(status)
          ? status
          : 'unavailable',
      reason: _nullableString(json['reason']),
    );
  }
}

class ParentActionItem {
  const ParentActionItem({
    required this.id,
    required this.source,
    required this.type,
    required this.priority,
    required this.title,
    required this.description,
    required this.isOverdue,
    required this.actionLabel,
    this.child,
    this.dueAt,
    this.route,
  });

  final String id;
  final String source;
  final String type;
  final String priority;
  final String title;
  final String description;
  final ParentActionChild? child;
  final DateTime? dueAt;
  final bool isOverdue;
  final String actionLabel;

  /// A validated, app-local parent route. Unsafe or unknown backend routes are
  /// deliberately reduced to null so the UI can show a non-actionable state.
  final String? route;

  bool get isUrgent => priority == 'URGENT';

  factory ParentActionItem.fromJson(Map<String, dynamic> json) {
    final action = _map(json['action']);
    final child = _map(json['child']);
    final parsedChild = child == null
        ? null
        : ParentActionChild.fromJson(child);
    return ParentActionItem(
      id: _string(json['id']),
      source: _string(json['source'], fallback: 'unknown'),
      type: _string(json['type'], fallback: 'UNKNOWN'),
      priority: _priority(json['priority']),
      title: _string(json['title'], fallback: 'School action'),
      description: _string(
        json['description'],
        fallback: 'Open this action for details.',
      ),
      child: parsedChild,
      dueAt: _nullableDate(json['dueAt']),
      isOverdue: json['isOverdue'] == true,
      actionLabel: _string(action?['label'], fallback: 'Review'),
      route: safeParentActionRoute(
        action?['route'],
        expectedChildId: parsedChild?.id,
      ),
    );
  }
}

/// Allows only the parent task destinations that the action-centre contract
/// currently owns. This is intentionally narrower than the app's full route
/// table and rejects absolute URLs, fragments, unexpected query parameters,
/// and child-scope mismatches.
String? safeParentActionRoute(Object? value, {String? expectedChildId}) {
  final raw = value is String ? value.trim() : '';
  if (raw.isEmpty) return null;

  final uri = Uri.tryParse(raw);
  if (uri == null ||
      uri.hasScheme ||
      uri.hasAuthority ||
      uri.fragment.isNotEmpty ||
      !uri.path.startsWith('/')) {
    return null;
  }

  final segments = uri.pathSegments;
  final isNotice =
      segments.length == 2 &&
      segments.first == 'notices' &&
      segments.last.isNotEmpty;
  final isHomework =
      segments.length == 3 &&
      segments[0] == 'parent' &&
      segments[1] == 'homework' &&
      segments[2].isNotEmpty;
  final isScopedDestination = const {
    '/parent/fees',
    '/parent/attendance',
    '/parent/more/help-requests',
    '/parent/more/calendar',
  }.contains(uri.path);

  if (!isNotice && !isHomework && !isScopedDestination) return null;
  if (!isScopedDestination && uri.queryParameters.isNotEmpty) return null;
  if (isScopedDestination &&
      uri.queryParameters.keys.any((key) => key != 'child')) {
    return null;
  }

  final routeChildId = _nullableString(uri.queryParameters['child']);
  if (routeChildId != null &&
      expectedChildId != null &&
      routeChildId != expectedChildId) {
    return null;
  }

  return uri.toString();
}

Map<String, dynamic>? _map(Object? value) =>
    value is Map<String, dynamic> ? value : null;

List<dynamic> _list(Object? value) => value is List<dynamic> ? value : const [];

String _string(Object? value, {String fallback = ''}) {
  final text = value is String ? value.trim() : '';
  return text.isEmpty ? fallback : text;
}

String? _nullableString(Object? value) {
  final text = _string(value);
  return text.isEmpty ? null : text;
}

int _integer(Object? value) {
  if (value is num) return value.toInt();
  return int.tryParse('$value') ?? 0;
}

String _priority(Object? value) {
  final priority = _string(value, fallback: 'NORMAL');
  return const {'URGENT', 'HIGH', 'NORMAL'}.contains(priority)
      ? priority
      : 'NORMAL';
}

DateTime _date(Object? value) =>
    _nullableDate(value) ?? DateTime.fromMillisecondsSinceEpoch(0, isUtc: true);

DateTime? _nullableDate(Object? value) =>
    DateTime.tryParse(value is String ? value : '');
