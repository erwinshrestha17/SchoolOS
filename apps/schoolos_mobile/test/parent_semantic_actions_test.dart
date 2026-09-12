import 'dart:ui' show SemanticsAction;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:schoolos_mobile/app/theme/app_theme.dart';
import 'package:schoolos_mobile/features/parent/application/parent_dashboard_view_model.dart';
import 'package:schoolos_mobile/features/parent/presentation/widgets/parent_dashboard_cards.dart';
import 'package:schoolos_mobile/features/parent/presentation/widgets/parent_dashboard_widgets.dart';

void main() {
  testWidgets('spoken parent controls retain their tap actions', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    addTearDown(semantics.dispose);
    var profiles = 0;
    var attendance = 0;
    var quickActions = 0;
    const row = ParentStatusRow(
      kind: ParentStatusKind.attendance,
      tone: ParentStatusTone.neutral,
      title: 'Awaiting teacher update',
      subtitle: null,
      route: '/parent/attendance',
    );
    const child = ParentDashboardChild(
      id: 'child-1',
      name: 'Aarav',
      classSection: 'Class 1 A',
      schoolName: 'School',
      guardianContext: 'Guardian',
      teacher: null,
      statusRows: [row],
      route: '/parent/child/child-1',
      canOpenProfile: true,
      canViewAttendance: true,
      canViewFees: false,
      canViewAcademics: false,
    );
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(
          body: Column(
            children: [
              StudentDaySummaryCard(
                child: child,
                onOpenChild: () => profiles++,
                onOpenStatus: (_) => attendance++,
              ),
              QuickActionTile(
                icon: Icons.calendar_today,
                label: 'Calendar',
                color: Colors.blue,
                onTap: () => quickActions++,
              ),
              const QuickActionTile(
                icon: Icons.receipt,
                label: 'Fees unavailable',
                color: Colors.blue,
                onTap: null,
              ),
            ],
          ),
        ),
      ),
    );
    for (final label in [
      "Open Aarav's profile",
      row.semanticLabel,
      'Calendar',
    ]) {
      final node = tester.getSemantics(find.bySemanticsLabel(label));
      expect(
        node.getSemanticsData().hasAction(SemanticsAction.tap),
        isTrue,
        reason: '$label must be activatable by a screen reader',
      );
      node.owner!.performAction(node.id, SemanticsAction.tap);
      await tester.pump();
    }
    expect(profiles, 1);
    expect(attendance, 1);
    expect(quickActions, 1);
    final disabled = tester.getSemantics(
      find.bySemanticsLabel('Fees unavailable'),
    );
    expect(disabled.getSemanticsData().hasAction(SemanticsAction.tap), isFalse);
    expect(tester.takeException(), isNull);
  });
}
