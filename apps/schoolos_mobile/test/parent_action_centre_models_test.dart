import 'package:flutter_test/flutter_test.dart';
import 'package:schoolos_mobile/features/parent/domain/parent_action_centre_models.dart';

void main() {
  group('ParentActionCentre', () {
    test(
      'maps live partial coverage without inventing unavailable actions',
      () {
        final centre = ParentActionCentre.fromJson({
          'generatedAt': '2026-07-26T10:00:00.000Z',
          'dataState': 'LIVE',
          'scope': {
            'selectedStudentId': 'child-1',
            'children': [
              {
                'id': 'child-1',
                'name': 'Asha Rai',
                'classSection': 'Grade 4 - A',
              },
            ],
          },
          'summary': {
            'visibleActionCount': 2,
            'urgentCount': 1,
            'returnedCount': 2,
            'isPartial': true,
          },
          'items': [
            {
              'id': 'notice-ack:notice-1',
              'source': 'notices',
              'type': 'NOTICE_ACKNOWLEDGEMENT',
              'priority': 'URGENT',
              'title': 'Holiday notice',
              'description': 'Review and confirm this school notice.',
              'child': null,
              'dueAt': null,
              'isOverdue': false,
              'action': {
                'label': 'Review notice',
                'route': '/notices/notification-1',
              },
            },
          ],
          'truncated': false,
          'sources': {
            'notices': {'status': 'available', 'reason': null},
            'fees': {
              'status': 'locked',
              'reason': 'Fees are not enabled for this school.',
            },
          },
        });

        expect(centre.isLive, isTrue);
        expect(centre.summary.visibleActionCount, 2);
        expect(centre.summary.isPartial, isTrue);
        expect(centre.items.single.route, '/notices/notification-1');
        expect(centre.sources['fees']?.status, 'locked');
        expect(centre.sources['fees']?.isAvailable, isFalse);
      },
    );
  });

  group('safeParentActionRoute', () {
    test('accepts only owned app-local task destinations', () {
      expect(
        safeParentActionRoute(
          '/parent/fees?child=child-1',
          expectedChildId: 'child-1',
        ),
        '/parent/fees?child=child-1',
      );
      expect(
        safeParentActionRoute('/parent/homework/homework-1'),
        '/parent/homework/homework-1',
      );
      expect(
        safeParentActionRoute('/notices/notification-1'),
        '/notices/notification-1',
      );
    });

    test('rejects absolute, unknown, and child-mismatched routes', () {
      expect(
        safeParentActionRoute('https://untrusted.test/parent/fees'),
        isNull,
      );
      expect(safeParentActionRoute('/principal/today'), isNull);
      expect(
        safeParentActionRoute(
          '/parent/fees?child=child-2',
          expectedChildId: 'child-1',
        ),
        isNull,
      );
      expect(
        safeParentActionRoute('/parent/fees?child=child-1&admin=true'),
        isNull,
      );
    });
  });
}
