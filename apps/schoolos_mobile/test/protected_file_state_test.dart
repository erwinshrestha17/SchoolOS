import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:schoolos_mobile/shared/widgets/app_access_state.dart';

/// `ProtectedFileUnavailableState` is one of the shared state components
/// DESIGN_SYSTEM.md section 10 requires. It replaced two hand-rolled
/// "Protected media is unavailable" panels in the parent activity feed, one of
/// which sits in a small 16:10 thumbnail - the slot most likely to overflow.
void main() {
  Widget host(Widget child, {Size size = const Size(360, 640)}) {
    return MaterialApp(
      home: Scaffold(
        body: Center(
          child: SizedBox(width: size.width, height: size.height, child: child),
        ),
      ),
    );
  }

  testWidgets('full state shows title, message and retry', (tester) async {
    var retries = 0;
    await tester.pumpWidget(
      host(ProtectedFileUnavailableState(onRetry: () => retries++)),
    );

    expect(find.text('File unavailable'), findsOneWidget);
    expect(
      find.text(
        'This protected file is unavailable or your access has expired.',
      ),
      findsOneWidget,
    );

    await tester.tap(find.text('Try again'));
    expect(retries, 1);
  });

  testWidgets('compact state drops the title but keeps message and retry', (
    tester,
  ) async {
    await tester.pumpWidget(
      host(
        const ProtectedFileUnavailableState(
          compact: true,
          message: 'Protected media is unavailable.',
        ),
        // A 16:10 thumbnail on a narrow phone - the tightest real slot.
        size: const Size(288, 180),
      ),
    );

    expect(find.text('Protected media is unavailable.'), findsOneWidget);
    expect(
      find.text('File unavailable'),
      findsNothing,
      reason: 'the compact slot has no room for the heading',
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('compact state stays overflow-free at large text scale', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: MediaQuery(
          data: const MediaQueryData(textScaler: TextScaler.linear(2)),
          child: Scaffold(
            body: Center(
              child: SizedBox(
                width: 288,
                height: 180,
                child: ProtectedFileUnavailableState(
                  compact: true,
                  message: 'Protected media is unavailable.',
                  onRetry: () {},
                ),
              ),
            ),
          ),
        ),
      ),
    );

    expect(
      tester.takeException(),
      isNull,
      reason: 'a thumbnail-sized slot must not overflow when text is scaled up',
    );
  });

  testWidgets('full state stays overflow-free at large text scale', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: MediaQuery(
          data: const MediaQueryData(textScaler: TextScaler.linear(2)),
          child: Scaffold(
            body: SizedBox(
              width: 320,
              height: 560,
              child: ProtectedFileUnavailableState(onRetry: () {}),
            ),
          ),
        ),
      ),
    );

    expect(tester.takeException(), isNull);
  });
}
