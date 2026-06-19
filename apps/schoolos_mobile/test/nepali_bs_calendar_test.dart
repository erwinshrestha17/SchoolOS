import 'package:flutter_test/flutter_test.dart';
import 'package:schoolos_mobile/shared/utils/nepali_bs_calendar.dart';

void main() {
  group('NepaliBsCalendar', () {
    test('converts current QA dates into BS dates', () {
      final bs = NepaliBsCalendar.fromAd(DateTime(2026, 6, 19));

      expect(bs.year, 2083);
      expect(bs.month, 3);
      expect(bs.day, 5);
      expect(bs.monthName, 'Ashadh');
    });

    test('reports BS month lengths for the supported calendar range', () {
      expect(NepaliBsCalendar.daysInMonth(2083, 3), 32);
      expect(NepaliBsCalendar.daysInMonth(2083, 10), 30);
    });
  });
}
