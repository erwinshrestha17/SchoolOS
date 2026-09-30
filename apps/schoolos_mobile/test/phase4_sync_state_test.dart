import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:schoolos_mobile/core/storage/secure_storage_service.dart';
import 'package:schoolos_mobile/core/sync/teacher_marks_draft_store.dart';
import 'package:schoolos_mobile/shared/design/status_tone.dart';
import 'package:schoolos_mobile/shared/widgets/status_chip.dart';
import 'package:schoolos_mobile/shared/widgets/sync_state_banner.dart';

class _MemorySecureStore implements SecureKeyValueStore {
  final Map<String, String> values = {};

  @override
  Future<void> write(String key, String value) async => values[key] = value;

  @override
  Future<String?> read(String key) async => values[key];

  @override
  Future<Map<String, String>> readAll() async => Map.of(values);

  @override
  Future<void> delete(String key) async => values.remove(key);

  @override
  Future<void> clearAll() async => values.clear();

  @override
  Future<bool> containsKey(String key) async => values.containsKey(key);

  @override
  Future<void> deleteByPrefix(String prefix) async =>
      values.removeWhere((key, _) => key.startsWith(prefix));
}

Widget _host(Widget child) => MaterialApp(home: Scaffold(body: child));

void main() {
  group('status tones (shared with Web)', () {
    test('overdue and unpaid are danger, due is pending', () {
      expect(resolveStatusTone('overdue'), StatusTone.overdue);
      expect(resolveStatusTone('UNPAID'), StatusTone.unpaid);
      expect(resolveStatusTone('DUE'), StatusTone.pending);
      expect(resolveStatusTone('something-new'), StatusTone.info);
    });

    testWidgets('StatusChip.fromStatus labels raw backend statuses', (
      tester,
    ) async {
      await tester.pumpWidget(_host(StatusChip.fromStatus('PARTIALLY_PAID')));
      expect(find.text('PARTIALLY PAID'), findsOneWidget);
    });
  });

  group('SyncStateBanner', () {
    testWidgets('live data shows nothing', (tester) async {
      await tester.pumpWidget(
        _host(const SyncStateBanner(state: SyncState.live)),
      );
      expect(find.byType(Text), findsNothing);
    });

    testWidgets('cached data says how old it is', (tester) async {
      final now = DateTime(2026, 9, 30, 12);
      await tester.pumpWidget(
        _host(
          SyncStateBanner(
            state: SyncState.cached,
            lastUpdated: now.subtract(const Duration(hours: 3)),
            now: now,
          ),
        ),
      );
      expect(
        find.text('Showing information saved 3 hours ago.'),
        findsOneWidget,
      );
    });

    testWidgets(
      'failed changes are named with the server reason and an action',
      (tester) async {
        var discarded = false;
        await tester.pumpWidget(
          _host(
            SyncStateBanner(
              state: SyncState.failed,
              count: 2,
              detail: 'Marks for this term are locked.',
              actionLabel: 'Discard',
              onAction: () => discarded = true,
            ),
          ),
        );
        expect(find.text('2 changes could not be saved.'), findsOneWidget);
        expect(find.text('Marks for this term are locked.'), findsOneWidget);
        await tester.tap(find.text('Discard'));
        expect(discarded, isTrue);
      },
    );
  });

  group('TeacherMarksDraftStore', () {
    test('a refused draft keeps its reason and is not lost', () async {
      final storage = _MemorySecureStore();
      final store = TeacherMarksDraftStore(
        storage,
        scope: const TeacherMarksDraftScope(tenantId: 't1', userId: 'u1'),
      );
      await store.write(operationId: 'op-1', payload: {'classId': 'c1'});
      final draft = (await store.listQueued()).single;

      await store.markFailed(draft, reason: 'Marks are locked.');

      final after = (await store.listQueued()).single;
      expect(after['operationId'], 'op-1');
      expect(after['lastError'], 'Marks are locked.');
      expect(after['payload'], {'classId': 'c1'});
    });

    test('never reads or writes drafts outside its tenant and user', () async {
      final storage = _MemorySecureStore();
      final mine = TeacherMarksDraftStore(
        storage,
        scope: const TeacherMarksDraftScope(tenantId: 't1', userId: 'u1'),
      );
      final other = TeacherMarksDraftStore(
        storage,
        scope: const TeacherMarksDraftScope(tenantId: 't2', userId: 'u1'),
      );
      await mine.write(operationId: 'op-1', payload: const {});
      expect(await other.listQueued(), isEmpty);
    });
  });
}
