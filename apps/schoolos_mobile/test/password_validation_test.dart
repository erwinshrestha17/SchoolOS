import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:schoolos_mobile/core/auth/password_validation.dart';
import 'package:schoolos_mobile/shared/widgets/app_text_field.dart';

void main() {
  for (final password in [
    'aA1!',
    'abcdef1!',
    'ABCDEF1!',
    'Abcdefg!',
    'Abcdefg1',
  ]) {
    test('basic policy rejects $password', () {
      expect(passwordValidationMessage(password, null), isNotNull);
    });
  }

  test(
    'email guidance is case-insensitive and ignores short identity parts',
    () {
      expect(
        passwordValidationMessage('XXpaRent7!', 'Parent@example.invalid'),
        'Password must not include your email.',
      );
      expect(
        passwordValidationMessage('XXexample7!', 'parent@EXAMPLE.invalid'),
        isNotNull,
      );
      expect(passwordValidationMessage('XXabCd7!', 'ab@cd.ef'), isNull);
    },
  );

  test('strong passwords preserve meaningful whitespace', () {
    expect(
      passwordValidationMessage(' Qz72!mV8 ', 'parent@example.invalid'),
      isNull,
    );
  });

  testWidgets(
    'password suggestions stay disabled when revealed and autofill is explicit',
    (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: AppTextField(
              label: 'New password',
              obscureText: true,
              autofillHints: [AutofillHints.newPassword],
            ),
          ),
        ),
      );
      var input = tester.widget<TextField>(find.byType(TextField));
      expect(input.autocorrect, isFalse);
      expect(input.enableSuggestions, isFalse);
      expect(input.autofillHints, [AutofillHints.newPassword]);
      expect(input.obscureText, isTrue);
      await tester.tap(find.byTooltip('Show password'));
      await tester.pumpAndSettle();
      input = tester.widget<TextField>(find.byType(TextField));
      expect(input.obscureText, isFalse);
      expect(input.autocorrect, isFalse);
      expect(input.enableSuggestions, isFalse);
    },
  );
}
