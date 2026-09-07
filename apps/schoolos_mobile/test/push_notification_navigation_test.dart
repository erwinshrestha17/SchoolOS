import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:schoolos_mobile/core/auth/auth_provider.dart';
import 'package:schoolos_mobile/core/auth/models/auth_user.dart';
import 'package:schoolos_mobile/core/notifications/push_notification_navigation.dart';

void main() {
  for (final transition in [
    'loading',
    'logout',
    'other-user',
    'other-tenant',
    'revalidated',
  ]) {
    test('child lookup cannot navigate after $transition', () async {
      final original = _auth();
      var current = original;
      final lookup = Completer<bool>();
      final entered = Completer<void>();
      final routes = <String>[];
      final navigation = openPushNotificationForSession(
        auth: original,
        readAuth: () => current,
        payload: _payload,
        canAccessChild: (_) {
          entered.complete();
          return lookup.future;
        },
        navigate: routes.add,
      );
      await entered.future;
      current = switch (transition) {
        'loading' => original.copyWith(status: AuthStatus.loading),
        'logout' => AuthState(status: AuthStatus.unauthenticated),
        'other-user' => _auth(id: 'other-user'),
        'other-tenant' => _auth(tenantId: 'other-tenant'),
        _ => _auth(),
      };
      lookup.complete(true);
      await navigation;
      expect(routes, isEmpty);
    });
  }

  test('current linked parent can navigate after lookup', () async {
    final auth = _auth();
    final routes = <String>[];
    await openPushNotificationForSession(
      auth: auth,
      readAuth: () => auth,
      payload: _payload,
      canAccessChild: (_) async => true,
      navigate: routes.add,
    );
    expect(routes, ['/parent/homework']);
  });

  test('stale callback does not even request child scope', () async {
    await openPushNotificationForSession(
      auth: _auth(),
      readAuth: () => _auth(),
      payload: _payload,
      canAccessChild: (_) async => fail('stale lookup'),
      navigate: (_) => fail('stale navigation'),
    );
  });

  test('malformed payload and scope failure never render or escape', () async {
    final auth = _auth();
    for (final payload in [
      _payload,
      {'tenantId': 123, 'route': true},
    ]) {
      await openPushNotificationForSession(
        auth: auth,
        readAuth: () => auth,
        payload: payload,
        canAccessChild: (_) async =>
            throw StateError('synthetic scope failure'),
        navigate: (_) => fail('unsafe navigation'),
      );
    }
  });
}

const _payload = <String, dynamic>{
  'tenantId': 'tenant-a',
  'route': '/parent/homework',
  'childId': 'child-a',
};

AuthState _auth({String id = 'parent-a', String tenantId = 'tenant-a'}) =>
    AuthState(
      status: AuthStatus.authenticated,
      role: 'PARENT',
      token: 'synthetic-session',
      user: AuthUser(
        id: id,
        name: 'Synthetic Parent',
        email: 'parent@example.invalid',
        role: 'PARENT',
        tenantId: tenantId,
      ),
    );
