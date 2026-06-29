import 'package:flutter_test/flutter_test.dart';
import 'package:schoolos_mobile/core/notifications/push_deep_link_resolver.dart';

void main() {
  const tenantId = 'tenant-1';

  test('opens a linked childs published results destination', () async {
    final route = await PushDeepLinkResolver.resolve(
      payload: const {
        'tenantId': tenantId,
        'route': '/parent/more/report-cards',
        'childId': 'child-1',
      },
      role: 'PARENT',
      tenantId: tenantId,
      canAccessChild: (childId) async => childId == 'child-1',
    );

    expect(route, '/parent/more/report-cards');
  });

  test(
    'denies a parent route for an unlinked child without exposing it',
    () async {
      final route = await PushDeepLinkResolver.resolve(
        payload: const {
          'tenantId': tenantId,
          'route': '/parent/children/child-2/attendance',
          'childId': 'child-2',
        },
        role: 'PARENT',
        tenantId: tenantId,
        canAccessChild: (_) async => false,
      );

      expect(route, isNull);
    },
  );

  test('denies a route from another tenant before child lookup', () async {
    var checkedChild = false;
    final route = await PushDeepLinkResolver.resolve(
      payload: const {
        'tenantId': 'tenant-2',
        'route': '/parent/homework',
        'childId': 'child-1',
      },
      role: 'PARENT',
      tenantId: tenantId,
      canAccessChild: (_) async {
        checkedChild = true;
        return true;
      },
    );

    expect(route, isNull);
    expect(checkedChild, isFalse);
  });

  test('allows only assignment-safe teacher list routes', () async {
    final safe = await PushDeepLinkResolver.resolve(
      payload: const {'tenantId': tenantId, 'route': '/teacher/homework'},
      role: 'SUBJECT_TEACHER',
      tenantId: tenantId,
      canAccessChild: (_) async => false,
    );
    final unsafe = await PushDeepLinkResolver.resolve(
      payload: const {
        'tenantId': tenantId,
        'route': '/teacher/class/unassigned-class',
      },
      role: 'SUBJECT_TEACHER',
      tenantId: tenantId,
      canAccessChild: (_) async => false,
    );

    expect(safe, '/teacher/homework');
    expect(unsafe, isNull);
  });

  test('allows principal snapshots and rejects admin-shaped paths', () async {
    final safe = await PushDeepLinkResolver.resolve(
      payload: const {
        'tenantId': tenantId,
        'route': '/principal/academics-readiness',
      },
      role: 'PRINCIPAL',
      tenantId: tenantId,
      canAccessChild: (_) async => false,
    );
    final unsafe = await PushDeepLinkResolver.resolve(
      payload: const {
        'tenantId': tenantId,
        'route': '/dashboard/academics/report-cards',
      },
      role: 'PRINCIPAL',
      tenantId: tenantId,
      canAccessChild: (_) async => false,
    );

    expect(safe, '/principal/academics-readiness');
    expect(unsafe, isNull);
  });

  test('controlled student sessions cannot open push destinations', () async {
    final route = await PushDeepLinkResolver.resolve(
      payload: const {
        'tenantId': tenantId,
        'route': '/parent/more/report-cards',
        'childId': 'child-1',
      },
      role: 'STUDENT',
      tenantId: tenantId,
      canAccessChild: (_) async => true,
    );

    expect(route, isNull);
  });
}
