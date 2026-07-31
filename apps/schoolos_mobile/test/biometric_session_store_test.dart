import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:schoolos_mobile/core/auth/biometric_prompt_state.dart';
import 'package:schoolos_mobile/core/auth/biometric_session_store.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late SharedPreferences prefs;
  late BiometricSessionStore store;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    prefs = await SharedPreferences.getInstance();
    store = BiometricSessionStore(prefs);
  });

  test('keeps biometric configuration scoped per user account', () async {
    await store.setEnabled('user-a', tenantId: 'tenant-1', enabled: true);
    await store.setEnabled('user-b', tenantId: 'tenant-1', enabled: false);

    expect(store.isEnabled('user-a', tenantId: 'tenant-1'), isTrue);
    expect(store.isEnabled('user-b', tenantId: 'tenant-1'), isFalse);
    expect(store.isEnabled('user-a', tenantId: 'tenant-2'), isFalse);
  });

  test('first prompt is offered only while prompt state is never', () async {
    expect(
      store.shouldOfferFirstPrompt('user-a', tenantId: 'tenant-1'),
      isTrue,
    );

    await store.setPromptState(
      'user-a',
      tenantId: 'tenant-1',
      state: BiometricPromptState.dismissed,
    );
    expect(
      store.shouldOfferFirstPrompt('user-a', tenantId: 'tenant-1'),
      isFalse,
    );
    expect(
      store.shouldShowSoftSuggestion('user-a', tenantId: 'tenant-1'),
      isTrue,
    );

    await store.setPromptState(
      'user-a',
      tenantId: 'tenant-1',
      state: BiometricPromptState.softSuggested,
    );
    expect(
      store.shouldShowSoftSuggestion('user-a', tenantId: 'tenant-1'),
      isFalse,
    );
  });

  test(
    'clearForUser removes enabled flag without clearing dismissed prompt',
    () async {
      await store.setEnabled('user-a', tenantId: 'tenant-1', enabled: true);
      await store.clearForUser('user-a', tenantId: 'tenant-1');

      expect(store.isEnabled('user-a', tenantId: 'tenant-1'), isFalse);
      expect(
        store.promptState('user-a', tenantId: 'tenant-1'),
        BiometricPromptState.never,
      );

      await store.setPromptState(
        'user-a',
        tenantId: 'tenant-1',
        state: BiometricPromptState.dismissed,
      );
      await store.clearForUser('user-a', tenantId: 'tenant-1');
      expect(
        store.promptState('user-a', tenantId: 'tenant-1'),
        BiometricPromptState.dismissed,
      );
    },
  );

  test('excessive failures disable biometric unlock for that user', () async {
    await store.setEnabled('user-a', tenantId: 'tenant-1', enabled: true);

    for (var i = 0; i < BiometricSessionStore.maxFailuresBeforeDisable; i++) {
      await store.recordFailure('user-a', tenantId: 'tenant-1');
    }

    expect(store.isEnabled('user-a', tenantId: 'tenant-1'), isFalse);
  });

  test('purges legacy global biometric preference key', () async {
    SharedPreferences.setMockInitialValues({'app_biometric_enabled': true});
    prefs = await SharedPreferences.getInstance();
    store = BiometricSessionStore(prefs);

    await store.setEnabled('user-a', tenantId: 'tenant-1', enabled: true);
    expect(prefs.containsKey('app_biometric_enabled'), isFalse);
  });
}
