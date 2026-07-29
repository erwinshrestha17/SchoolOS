/// Offline storage for one guardian's Today dashboard, one child at a time.
///
/// Sits between [ParentPortalRepository] and [PrivateReadCache]: the
/// repository asks for "the snapshot for this child" and never learns how it
/// is serialised, and the widget layer never touches storage at all.
///
/// Isolation is enforced twice, on purpose. [PrivateReadCache] already
/// namespaces every record by `[cacheSchemaVersion, tenantId, userId, role]`
/// and refuses to return a record whose namespace does not match the caller's,
/// so a snapshot cannot cross a tenant or a user. On top of that the envelope
/// written here repeats the tenant, guardian, child and its own schema version
/// as *data*, and [ParentDashboardSnapshotStore.load] rejects the record if
/// any of the four disagree. One layer would be enough; two means a bug in
/// either cannot, by itself, show one family another family's child.
library;

import '../../../core/storage/private_read_cache.dart';
import '../domain/parent_portal_models.dart';

/// Bumped whenever the serialised shape below changes.
///
/// A record written by an older build decodes to a different shape, so it is
/// discarded rather than half-read - the parent gets the normal error state
/// and a fresh fetch instead of a dashboard with silently missing fields.
const parentDashboardSnapshotSchemaVersion = 2;

/// Who a snapshot belongs to. Empty values mean "not signed in properly", and
/// the store then refuses to read or write anything.
class ParentDashboardSnapshotIdentity {
  const ParentDashboardSnapshotIdentity({
    required this.tenantId,
    required this.guardianId,
  });

  final String tenantId;
  final String guardianId;

  bool get isValid =>
      tenantId.trim().isNotEmpty && guardianId.trim().isNotEmpty;
}

/// A dashboard as it was when the network last answered.
class ParentDashboardSnapshot {
  const ParentDashboardSnapshot({required this.data, required this.cachedAt});

  /// Already carries `fromCache: true` and `lastUpdated == cachedAt`, so a
  /// caller cannot render it as live by forgetting to set a flag.
  final ParentPortalData data;
  final DateTime cachedAt;
}

class ParentDashboardSnapshotStore {
  const ParentDashboardSnapshotStore({
    required this.cache,
    required this.identity,
  });

  final PrivateReadCache cache;
  final ParentDashboardSnapshotIdentity identity;

  /// Resource keys are restricted to `[a-zA-Z0-9_.:-]` by the cache, and a
  /// child id that does not fit is not encoded around - it simply is not
  /// cached, because a lossy key could collide with another child's.
  static final _safeChildId = RegExp(r'^[a-zA-Z0-9_.:-]{1,80}$');

  static String? resourceKeyFor(String childId) {
    final trimmed = childId.trim();
    if (!_safeChildId.hasMatch(trimmed)) return null;
    return '$_resourceKeyPrefix$trimmed';
  }

  /// Stores [data] under its own active child. Returns false when the snapshot
  /// could not be persisted - over quota, unsafe id, signed out - which is
  /// never an error the parent should see: it only means the next offline
  /// launch falls back to the error state.
  Future<bool> save(ParentPortalData data) async {
    final childId = data.activeChild?.id;
    if (childId == null || !identity.isValid) return false;
    final resourceKey = resourceKeyFor(childId);
    if (resourceKey == null) return false;

    try {
      return await cache.write(resourceKey, {
        'schemaVersion': parentDashboardSnapshotSchemaVersion,
        'tenantId': identity.tenantId.trim(),
        'guardianId': identity.guardianId.trim(),
        'childId': childId,
        'dashboard': _encodeData(_trimForStorage(data, childId)),
      });
    } catch (_) {
      // An interrupted or failing write must never break a load that already
      // succeeded on the network.
      return false;
    }
  }

  /// Forgets the snapshot of every child that is no longer linked.
  ///
  /// A guardian link can be removed by the school at any time. The record
  /// would expire on its own within the freshness window, but "some time in
  /// the next twelve hours" is not an answer for a child this guardian is no
  /// longer entitled to see, so the copy goes as soon as the linked-children
  /// list says so - including copies written before the app last restarted.
  Future<void> pruneUnlinked(Iterable<String> linkedChildIds) async {
    if (!identity.isValid) return;
    final keep = linkedChildIds.map(resourceKeyFor).whereType<String>().toSet();

    try {
      await cache.deleteWhere(
        (resourceKey) =>
            resourceKey.startsWith(_resourceKeyPrefix) &&
            !keep.contains(resourceKey),
      );
    } catch (_) {
      // Pruning is opportunistic; a failure here must not fail the load.
    }
  }

  static const _resourceKeyPrefix =
      'parent_dashboard_v$parentDashboardSnapshotSchemaVersion.';

  /// The newest valid snapshot for exactly this child, or null.
  ///
  /// Returns null - never another child's data - when the record is missing,
  /// expired, corrupt, written by another schema version, or stamped with a
  /// different tenant, guardian or child.
  Future<ParentDashboardSnapshot?> load({required String childId}) async {
    if (!identity.isValid) return null;
    final resourceKey = resourceKeyFor(childId);
    if (resourceKey == null) return null;

    try {
      final cached = await cache.read(resourceKey);
      if (cached == null) return null;

      final payload = cached.data;
      if (payload['schemaVersion'] != parentDashboardSnapshotSchemaVersion ||
          payload['tenantId'] != identity.tenantId.trim() ||
          payload['guardianId'] != identity.guardianId.trim() ||
          payload['childId'] != childId.trim()) {
        return null;
      }

      final dashboard = payload['dashboard'];
      if (dashboard is! Map<String, dynamic>) return null;

      final data = _decodeData(
        dashboard,
        cachedAt: cached.savedAt,
        activeChildId: childId.trim(),
      );
      if (data == null || data.activeChild?.id != childId.trim()) {
        // A snapshot that cannot produce the child it claims to describe is
        // useless and possibly wrong; discard it.
        return null;
      }

      return ParentDashboardSnapshot(data: data, cachedAt: cached.savedAt);
    } catch (_) {
      return null;
    }
  }
}

/// The most dated items and updates a snapshot will hold.
///
/// The dashboard renders three upcoming items and one update; these ceilings
/// leave room for a refresh to reorder them without the record growing with
/// the size of the school's homework week.
const _maxStoredHomework = 12;
const _maxStoredUpdates = 12;

/// Everything the dashboard will actually draw for [childId], and nothing
/// else.
///
/// A snapshot is read back for one child, so a sibling's homework is dead
/// weight against the 64KB record quota - an over-quota write is rejected
/// outright and the guardian gets no offline dashboard at all. Trimming here
/// is what keeps a three-child, twenty-assignment account inside the budget.
/// The full [ParentPortalData.children] list is kept: the child switcher
/// needs every name, and names are small.
ParentPortalData _trimForStorage(ParentPortalData data, String childId) {
  final homework =
      data.homework.where((item) => item.childId == childId).toList()
        ..sort((a, b) {
          final left = a.dueAt;
          final right = b.dueAt;
          if (left == null && right == null) return 0;
          // Undated work sorts last; it can never surface under "Coming up".
          if (left == null) return 1;
          if (right == null) return -1;
          return left.compareTo(right);
        });

  final updates = data.updates
      .where((update) => update.childId == null || update.childId == childId)
      .take(_maxStoredUpdates)
      .toList();

  return ParentPortalData(
    parentName: data.parentName,
    schoolName: data.schoolName,
    lastUpdated: data.lastUpdated,
    fromCache: data.fromCache,
    activeChildId: data.activeChildId,
    children: data.children,
    homework: homework.take(_maxStoredHomework).toList(),
    updates: updates,
    totalFeesDue: data.totalFeesDue,
    overdueFeesCount: data.overdueFeesCount,
    unreadUpdates: data.unreadUpdates,
  );
}

// ---------------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------------
//
// Written by hand rather than generated so the field list is visible at
// review time: nothing reaches disk that is not listed here, and there is no
// `toJson()` on the domain models that a future field could ride in on
// unnoticed. Notably absent, and deliberately so: any token, header or
// credential. The dashboard models carry none, and this is the only place
// that could put one on disk.

Map<String, dynamic> _encodeData(ParentPortalData data) => {
  'parentName': data.parentName,
  'schoolName': data.schoolName,
  'activeChildId': data.activeChildId,
  'totalFeesDue': data.totalFeesDue,
  'overdueFeesCount': data.overdueFeesCount,
  'unreadUpdates': data.unreadUpdates,
  'children': data.children.map(_encodeChild).toList(),
  'homework': data.homework.map(_encodeHomework).toList(),
  'updates': data.updates.map(_encodeUpdate).toList(),
};

/// Returns null when the payload is not shaped the way this version writes it.
ParentPortalData? _decodeData(
  Map<String, dynamic> json, {
  required DateTime cachedAt,
  required String activeChildId,
}) {
  final children = _decodeList(json['children'], _decodeChild);
  if (children == null || children.isEmpty) return null;
  final homework = _decodeList(json['homework'], _decodeHomework);
  final updates = _decodeList(json['updates'], _decodeUpdate);
  if (homework == null || updates == null) return null;

  return ParentPortalData(
    parentName: _string(json['parentName']) ?? '',
    schoolName: _string(json['schoolName']) ?? '',
    // The stamp the cache recorded, not one the payload could lie about.
    lastUpdated: cachedAt,
    fromCache: true,
    activeChildId: activeChildId,
    children: children,
    homework: homework,
    updates: updates,
    totalFeesDue: _num(json['totalFeesDue']) ?? 0,
    overdueFeesCount: _int(json['overdueFeesCount']) ?? 0,
    unreadUpdates: _int(json['unreadUpdates']) ?? 0,
  );
}

Map<String, dynamic> _encodeChild(ParentPortalChild child) => {
  'id': child.id,
  'name': child.name,
  'classSection': child.classSection,
  'teacher': child.teacher,
  'attendance': child.attendance,
  'attendanceTime': child.attendanceTime,
  'transport': child.transport,
  'homework': child.homework,
  'updates': child.updates,
  'rollNumber': child.rollNumber,
  'homeworkPending': child.homeworkPending,
  'homeworkDetail': child.homeworkDetail,
  'unreadUpdates': child.unreadUpdates,
  'feesDue': child.feesDue,
  'feesStatus': child.feesStatus,
  'feesPaidAmount': child.feesPaidAmount,
  'feesTotalAmount': child.feesTotalAmount,
  'nextFeeDueDate': child.nextFeeDueDate,
  'nextHomeworkDueAt': child.nextHomeworkDueAt,
  'transportDetail': child.transportDetail,
  'transportAssigned': child.transportAssigned,
  'transportHasActiveTrip': child.transportHasActiveTrip,
  'transportLatestLocationAt': child.transportLatestLocationAt,
  'transportLocationConfidence': child.transportLocationConfidence,
  'guardianRelationship': child.guardianRelationship,
  'isPrimaryGuardian': child.isPrimaryGuardian,
  'latestActivity': child.latestActivity,
  'latestActivityTitle': child.latestActivityTitle,
  'academicYearStartsOn': child.academicYearStartsOn,
  'academicYearEndsOn': child.academicYearEndsOn,
  'academicYear': child.academicYear,
  'attendanceEnabled': child.attendanceEnabled,
  'homeworkEnabled': child.homeworkEnabled,
  'feesEnabled': child.feesEnabled,
  'transportEnabled': child.transportEnabled,
  'capabilities': child.capabilities.toList()..sort(),
};

ParentPortalChild? _decodeChild(Map<String, dynamic> json) {
  final id = _string(json['id']);
  if (id == null || id.isEmpty) return null;
  return ParentPortalChild(
    id: id,
    name: _string(json['name']) ?? '',
    classSection: _string(json['classSection']) ?? '',
    teacher: _string(json['teacher']) ?? '',
    attendance: _string(json['attendance']) ?? '',
    attendanceTime: _string(json['attendanceTime']) ?? '',
    transport: _string(json['transport']) ?? '',
    homework: _string(json['homework']) ?? '',
    updates: _string(json['updates']) ?? '',
    rollNumber: _string(json['rollNumber']) ?? '',
    homeworkPending: _int(json['homeworkPending']) ?? 0,
    homeworkDetail: _string(json['homeworkDetail']),
    unreadUpdates: _int(json['unreadUpdates']) ?? 0,
    feesDue: _num(json['feesDue']) ?? 0,
    feesStatus: _string(json['feesStatus']) ?? 'DUE',
    feesPaidAmount: _num(json['feesPaidAmount']) ?? 0,
    feesTotalAmount: _num(json['feesTotalAmount']) ?? 0,
    nextFeeDueDate: _string(json['nextFeeDueDate']),
    nextHomeworkDueAt: _string(json['nextHomeworkDueAt']),
    transportDetail: _string(json['transportDetail']),
    transportAssigned: json['transportAssigned'] == true,
    transportHasActiveTrip: json['transportHasActiveTrip'] == true,
    transportLatestLocationAt: _string(json['transportLatestLocationAt']),
    transportLocationConfidence:
        _string(json['transportLocationConfidence']) ?? 'missing',
    guardianRelationship: _string(json['guardianRelationship']) ?? 'Guardian',
    isPrimaryGuardian: json['isPrimaryGuardian'] == true,
    latestActivity: _string(json['latestActivity']),
    latestActivityTitle: _string(json['latestActivityTitle']),
    academicYearStartsOn: _string(json['academicYearStartsOn']),
    academicYearEndsOn: _string(json['academicYearEndsOn']),
    academicYear: _string(json['academicYear']) ?? '',
    attendanceEnabled: json['attendanceEnabled'] != false,
    homeworkEnabled: json['homeworkEnabled'] != false,
    feesEnabled: json['feesEnabled'] != false,
    transportEnabled: json['transportEnabled'] != false,
    capabilities: (json['capabilities'] as List<dynamic>? ?? const [])
        .whereType<String>()
        .toSet(),
  );
}

Map<String, dynamic> _encodeHomework(ParentPortalHomework item) => {
  'id': item.id,
  'childId': item.childId,
  'childName': item.childName,
  'classSection': item.classSection,
  'subject': item.subject,
  'title': item.title,
  'dueLabel': item.dueLabel,
  'dueAt': item.dueAt?.toIso8601String(),
  'assignedAt': item.assignedAt?.toIso8601String(),
  'rawStatus': item.rawStatus,
  'attachmentCount': item.attachmentCount,
  'teacher': item.teacher,
  'submittedAt': item.submittedAt?.toIso8601String(),
  'score': item.score,
  'maxScore': item.maxScore,
  'feedback': item.feedback,
};

ParentPortalHomework? _decodeHomework(Map<String, dynamic> json) {
  final id = _string(json['id']);
  final childId = _string(json['childId']);
  if (id == null || childId == null) return null;
  return ParentPortalHomework(
    id: id,
    childId: childId,
    childName: _string(json['childName']) ?? '',
    classSection: _string(json['classSection']) ?? '',
    subject: _string(json['subject']) ?? '',
    title: _string(json['title']) ?? '',
    dueLabel: _string(json['dueLabel']) ?? '',
    dueAt: _dateTime(json['dueAt']),
    assignedAt: _dateTime(json['assignedAt']),
    rawStatus: _string(json['rawStatus']) ?? '',
    attachmentCount: _int(json['attachmentCount']) ?? 0,
    teacher: _string(json['teacher']) ?? '',
    submittedAt: _dateTime(json['submittedAt']),
    score: _num(json['score']),
    maxScore: _num(json['maxScore']),
    feedback: _string(json['feedback']),
  );
}

Map<String, dynamic> _encodeUpdate(ParentPortalUpdate update) => {
  'id': update.id,
  'childId': update.childId,
  'category': update.category.name,
  'title': update.title,
  'body': update.body,
  'metadata': update.metadata,
  'createdAt': update.createdAt?.toIso8601String(),
  'childName': update.childName,
  'classSection': update.classSection,
  'isPinned': update.isPinned,
  'isImportant': update.isImportant,
  'isEmergency': update.isEmergency,
  'requiresAcknowledgement': update.requiresAcknowledgement,
  'hasAttachment': update.hasAttachment,
  'unreadCount': update.unreadCount,
  'route': update.route,
  'audience': update.audience,
};

ParentPortalUpdate? _decodeUpdate(Map<String, dynamic> json) {
  final id = _string(json['id']);
  if (id == null) return null;
  final categoryName = _string(json['category']);
  return ParentPortalUpdate(
    id: id,
    childId: _string(json['childId']),
    category: ParentUpdateCategory.values.firstWhere(
      (value) => value.name == categoryName,
      orElse: () => ParentUpdateCategory.notice,
    ),
    title: _string(json['title']) ?? '',
    body: _string(json['body']) ?? '',
    metadata: _string(json['metadata']) ?? '',
    createdAt: _dateTime(json['createdAt']),
    childName: _string(json['childName']),
    classSection: _string(json['classSection']),
    isPinned: json['isPinned'] == true,
    isImportant: json['isImportant'] == true,
    isEmergency: json['isEmergency'] == true,
    requiresAcknowledgement: json['requiresAcknowledgement'] == true,
    hasAttachment: json['hasAttachment'] == true,
    unreadCount: _int(json['unreadCount']) ?? 0,
    route: _string(json['route']),
    audience: _string(json['audience']) ?? 'Whole school',
  );
}

/// Decodes a homogeneous list, or returns null if any element is unusable.
/// All-or-nothing on purpose: a snapshot missing half its homework would look
/// like a quiet week rather than a damaged record.
List<T>? _decodeList<T>(Object? raw, T? Function(Map<String, dynamic>) decode) {
  if (raw is! List) return null;
  final result = <T>[];
  for (final entry in raw) {
    if (entry is! Map<String, dynamic>) return null;
    final decoded = decode(entry);
    if (decoded == null) return null;
    result.add(decoded);
  }
  return result;
}

String? _string(Object? value) => value is String ? value : null;
int? _int(Object? value) => value is int ? value : null;
num? _num(Object? value) => value is num ? value : null;
DateTime? _dateTime(Object? value) =>
    value is String ? DateTime.tryParse(value) : null;
