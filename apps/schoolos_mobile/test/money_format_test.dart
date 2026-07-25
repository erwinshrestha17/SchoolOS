import 'package:flutter_test/flutter_test.dart';
import 'package:schoolos_mobile/shared/utils/money_format.dart';

/// The parent screens printed `NPR 3700`. "NPR" is the code banks use, and an
/// ungrouped four-figure fee looks like an ungrouped five-figure one at a
/// glance - which matters most on exactly the screen where a parent is
/// deciding how much to pay.
void main() {
  test('reads as Rs with grouped thousands', () {
    expect(formatMoney(0), 'Rs 0');
    expect(formatMoney(450), 'Rs 450');
    expect(formatMoney(3700), 'Rs 3,700');
    expect(formatMoney(12345678), 'Rs 12,345,678');
  });

  test('whole amounts do not carry meaningless decimals', () {
    expect(formatMoney(1200), 'Rs 1,200');
    expect(formatMoney(1200.0), 'Rs 1,200');
  });

  test('a real fraction is kept to two places', () {
    expect(formatMoney(25.25), 'Rs 25.25');
    expect(formatMoney(1234.5), 'Rs 1,234.50');
  });

  test('a credit reads as negative rather than silently flipping sign', () {
    expect(formatMoney(-1500), 'Rs -1,500');
  });

  test('group boundaries are exact', () {
    expect(formatAmount(999), '999');
    expect(formatAmount(1000), '1,000');
    expect(formatAmount(999999), '999,999');
    expect(formatAmount(1000000), '1,000,000');
  });
}
