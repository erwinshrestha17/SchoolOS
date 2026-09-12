import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:schoolos_mobile/app/theme/app_theme.dart';
import 'package:schoolos_mobile/shared/widgets/app_button.dart';
import 'package:schoolos_mobile/shared/widgets/app_empty_state.dart';
import 'package:schoolos_mobile/features/parent/presentation/widgets/parent_portal_widgets.dart';

void main() {
  for (final theme in [AppTheme.light, AppTheme.dark]) {
    testWidgets(
      'shared actions fit an intrinsic row and preserve large labels ${theme.brightness.name}',
      (tester) async {
        tester.view.physicalSize = const Size(320, 640);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        var taps = 0;
        await tester.pumpWidget(
          MaterialApp(
            theme: theme,
            home: Scaffold(
              body: MediaQuery(
                data: const MediaQueryData(textScaler: TextScaler.linear(2)),
                child: Column(
                  children: [
                    Row(
                      children: [
                        AppButton(
                          label: 'Review',
                          fullWidth: false,
                          onPressed: () => taps++,
                        ),
                      ],
                    ),
                    AppButton(
                      label: 'Review the pending attendance correction request',
                      onPressed: () => taps++,
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
        expect(tester.takeException(), isNull);
        expect(
          tester.getSize(find.byType(AppButton).last).height,
          greaterThan(52),
        );
        await tester.tap(find.text('Review'));
        expect(taps, 1);
      },
    );

    testWidgets(
      'recovery action remains reachable in a short large-text viewport ${theme.brightness.name}',
      (tester) async {
        tester.view.physicalSize = const Size(320, 300);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        var retries = 0;
        await tester.pumpWidget(
          MaterialApp(
            theme: theme,
            home: Scaffold(
              body: MediaQuery(
                data: const MediaQueryData(textScaler: TextScaler.linear(2)),
                child: AppEmptyState(
                  title: 'Attendance unavailable',
                  message:
                      'Your school records could not be loaded. Check your connection and try again.',
                  actionLabel: 'Try again',
                  onActionPressed: () => retries++,
                ),
              ),
            ),
          ),
        );
        expect(tester.takeException(), isNull);
        await tester.ensureVisible(find.text('Try again'));
        await tester.tap(find.text('Try again'));
        expect(retries, 1);
      },
    );

    testWidgets(
      'parent semantic text and selected control colors meet AA ${theme.brightness.name}',
      (tester) async {
        late ParentPortalPalette palette;
        await tester.pumpWidget(
          MaterialApp(
            theme: theme,
            home: Builder(
              builder: (context) {
                palette = ParentPortalColors.of(context);
                return const Scaffold();
              },
            ),
          ),
        );
        double contrast(Color a, Color b) {
          final first = a.computeLuminance(), second = b.computeLuminance();
          return ((first > second ? first : second) + .05) /
              ((first < second ? first : second) + .05);
        }

        for (final foreground in [
          palette.navy,
          palette.muted,
          palette.green,
          palette.orange,
          palette.red,
          palette.blue,
          palette.purple,
        ]) {
          expect(
            contrast(foreground, palette.surface),
            greaterThanOrEqualTo(4.5),
          );
          expect(contrast(foreground, palette.page), greaterThanOrEqualTo(4.5));
        }
        expect(
          contrast(palette.onGreen, palette.green),
          greaterThanOrEqualTo(4.5),
        );
      },
    );
  }
}
