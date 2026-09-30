import 'package:flutter_test/flutter_test.dart';
import 'package:schoolos_mobile/core/auth/mobile_role.dart';
import 'package:schoolos_mobile/features/parent/application/parent_providers.dart';
import 'package:schoolos_mobile/features/parent/domain/parent_models.dart';

/// Phase 4G mobile foundation: fail-closed persona, child context and data.
void main() {
  const asha = GuardianChild(
    id: 'child-1',
    name: 'Asha Rai',
    classSection: 'Grade 4 - A',
    rollNumber: '7',
    academicYear: '2026',
    relationship: 'Daughter',
  );
  const bikram = GuardianChild(
    id: 'child-2',
    name: 'Bikram Rai',
    classSection: 'Grade 2 - B',
    rollNumber: '3',
    academicYear: '2026',
    relationship: 'Son',
  );

  group('MobileRole', () {
    test('platform identities never receive a school persona', () {
      expect(
        MobileRole.normalize('PLATFORM_SUPER_ADMIN'),
        MobileRole.unsupported,
      );
      expect(
        MobileRole.normalize('admin', roles: ['platform_support']),
        MobileRole.unsupported,
      );
    });

    test('a session without any role gets no persona (not student)', () {
      expect(MobileRole.normalize(null), MobileRole.unsupported);
      expect(MobileRole.normalize(''), MobileRole.unsupported);
    });

    test('school roles still resolve as before', () {
      expect(MobileRole.normalize('principal'), MobileRole.principal);
      expect(MobileRole.normalize('guardian'), MobileRole.parent);
      expect(MobileRole.normalize('admin'), MobileRole.admin);
    });
  });

  group('selected child', () {
    test('never substitutes another child for an unmatched selection', () {
      const state = ParentState(
        children: [asha, bikram],
        selectedChildId: 'child-9',
      );
      expect(state.selectedChild, isNull);
    });

    test('returns the selected linked child', () {
      const state = ParentState(
        children: [asha, bikram],
        selectedChildId: 'child-2',
      );
      expect(state.selectedChild?.id, 'child-2');
    });
  });

  group('fees', () {
    test('a missing outstanding balance is unknown, never "paid"', () {
      final summary = ParentDashboardSummary.fromMobileDashboard({
        'fees': {'paidAmount': 0},
        'modules': {'fees': true},
      }, asha);
      expect(summary.feesKnown, isFalse);
      expect(summary.feesStatus, 'UNKNOWN');
    });

    test('a real zero balance is known and paid', () {
      final summary = ParentDashboardSummary.fromMobileDashboard({
        'fees': {'totalOutstanding': '0.00', 'paidAmount': 1500},
        'modules': {'fees': true},
      }, asha);
      expect(summary.feesKnown, isTrue);
      expect(summary.feesStatus, 'PAID');
    });

    test('modules the server did not confirm are not enabled', () {
      final summary = ParentDashboardSummary.fromMobileDashboard({}, asha);
      expect(summary.feesEnabled, isFalse);
      expect(summary.attendanceEnabled, isFalse);
    });
  });
}
