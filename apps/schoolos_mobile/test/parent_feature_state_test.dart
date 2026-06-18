import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:schoolos_mobile/features/parent/application/parent_feature_state.dart';
import 'package:schoolos_mobile/features/parent/presentation/screens/parent_calendar_screen.dart';
import 'package:schoolos_mobile/features/parent/presentation/screens/parent_canteen_screen.dart';
import 'package:schoolos_mobile/features/parent/presentation/screens/parent_consents_screen.dart';
import 'package:schoolos_mobile/features/parent/presentation/screens/parent_fees_receipts_screen.dart';
import 'package:schoolos_mobile/features/parent/presentation/screens/parent_library_screen.dart';
import 'package:schoolos_mobile/features/parent/presentation/screens/parent_report_cards_screen.dart';
import 'package:schoolos_mobile/features/parent/presentation/screens/parent_transport_screen.dart';

void main() {
  test('shared parent feature state keeps related screens consistent', () {
    final controller = ParentFeatureController();

    controller.markNoticeRead();
    controller.completePayment();
    controller.topUp(500);
    controller.setLowBalanceReminder(250);
    controller.setConsent('media', false);
    controller.decideTrip(true);

    expect(controller.state.noticeRead, isTrue);
    expect(controller.state.invoicePaid, isTrue);
    expect(controller.state.walletBalance, 1120);
    expect(controller.state.lowBalanceReminder, 250);
    expect(controller.state.walletTransactions.first.amount, 500);
    expect(controller.state.mediaConsent, isFalse);
    expect(controller.state.tripDecision, isTrue);
    expect(controller.state.activityLog, isNotEmpty);
  });

  testWidgets('new parent More screens render on a compact phone', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(360, 780);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final screens = <Widget>[
      const ParentCalendarScreen(),
      const ParentFeesReceiptsScreen(),
      const ParentReportCardsScreen(),
      const ParentCanteenScreen(),
      const ParentTransportScreen(),
      const ParentConsentsScreen(),
      const ParentLibraryScreen(),
    ];

    for (final screen in screens) {
      await tester.pumpWidget(ProviderScope(child: MaterialApp(home: screen)));
      await tester.pumpAndSettle();
      expect(
        tester.takeException(),
        isNull,
        reason: screen.runtimeType.toString(),
      );
    }
  });
}
