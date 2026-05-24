import '../domain/parent_models.dart';

class ParentRepository {
  const ParentRepository();

  Future<List<GuardianChild>> getGuardianChildren() async {
    await Future<void>.delayed(const Duration(milliseconds: 260));
    return _children;
  }

  Future<ChildProfile> getChildProfile(String childId) async {
    await Future<void>.delayed(const Duration(milliseconds: 240));
    final child = _children.firstWhere(
      (item) => item.id == childId,
      orElse: () => _children.first,
    );

    return ChildProfile(
      child: child,
      classTeacher: child.id == 'child-aarav' ? 'Mrs. Sharma' : 'Ms. Lama',
      guardianSummary: 'Primary guardian linked. Emergency contact verified.',
      canViewGuardianSummary: true,
      attendanceSummary: child.id == 'child-aarav'
          ? 'Present today, 94% this month'
          : 'Present today, 97% this month',
      homeworkSummary: child.id == 'child-aarav'
          ? '2 tasks pending'
          : 'No homework due today',
      feesSummary: child.id == 'child-aarav'
          ? 'NPR 4,200 due'
          : 'All dues cleared',
      qrLabel:
          'School identity QR will be shown after QR permissions are enabled.',
      healthWarning: null,
      canViewHealthWarning: false,
    );
  }

  Future<ParentDashboardSummary> getParentDashboardSummary(
    String childId,
  ) async {
    await Future<void>.delayed(const Duration(milliseconds: 260));
    final child = _children.firstWhere(
      (item) => item.id == childId,
      orElse: () => _children.first,
    );

    final isFirstChild = child.id == 'child-aarav';
    return ParentDashboardSummary(
      child: child,
      attendanceToday: 'Present at 09:12 AM',
      homeworkPending: isFirstChild ? 2 : 0,
      feesDue: isFirstChild ? 4200 : 0,
      unreadNotices: isFirstChild ? 3 : 1,
      transportStatus: 'Bus on route',
      canteenBalance: isFirstChild ? 1250 : 860,
      latestActivity: isFirstChild
          ? 'Science project reminder posted by class teacher.'
          : 'Reading activity completed in class.',
      lastUpdated: DateTime.now().subtract(const Duration(minutes: 8)),
    );
  }
}

const _children = [
  GuardianChild(
    id: 'child-aarav',
    name: 'Aarav S.',
    classSection: 'Grade 4 - Lotus',
    rollNumber: '12',
    academicYear: '2082 BS',
    relationship: 'Son',
  ),
  GuardianChild(
    id: 'child-anika',
    name: 'Anika S.',
    classSection: 'Grade 1 - Jasmine',
    rollNumber: '04',
    academicYear: '2082 BS',
    relationship: 'Daughter',
  ),
];
