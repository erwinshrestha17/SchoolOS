import 'package:flutter_test/flutter_test.dart';
import 'package:schoolos_mobile/features/principal/presentation/screens/principal_screens.dart';

/// Owner decision 1: the Principal finance snapshot is aggregate-only and
/// distinguishes a known zero from an unavailable figure.
void main() {
  Map<String, String> byId(Map<String, dynamic> data) => {
    for (final row in principalFinanceIndicators(data))
      row['id'] as String: row['detail'] as String,
  };

  test('authorized summary renders every leadership indicator', () {
    final rows = byId({
      'metrics': {
        'aging': {'overdue31To90Count': 4, 'overdue90PlusCount': 2},
        'reconciliation': {'openSessions': 1, 'failedStatementImports': 3},
        'reversalsToday': {'count': 1, 'amountFormatted': 'NPR 500'},
        'cashBankPosition': {'available': false},
      },
    });
    expect(rows['aging-90'], '2');
    expect(rows['aging-31-90'], '4');
    expect(rows['recon-failed'], '3');
    expect(rows['reversals'], '1 · NPR 500');
    expect(rows['cash-bank'], 'Not available');
  });

  test('zero stays zero; a missing figure is "Not available", never 0', () {
    final zero = byId({
      'metrics': {
        'aging': {'overdue31To90Count': 0, 'overdue90PlusCount': 0},
        'reconciliation': {'openSessions': 0, 'failedStatementImports': 0},
        'reversalsToday': {'count': 0, 'amountFormatted': 'NPR 0'},
      },
    });
    expect(zero['aging-90'], '0');
    expect(zero['reversals'], '0 · NPR 0');

    final missing = byId({'metrics': <String, dynamic>{}});
    expect(missing.values.toSet(), {'Not available'});
    expect(byId(const {}).values.toSet(), {'Not available'});
  });
}
