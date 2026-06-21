import 'package:flutter_test/flutter_test.dart';
import 'package:schoolos_mobile/shared/utils/nepali_bs_calendar.dart';

void main() {
  group('NepaliBsCalendar', () {
    test(
      'converts an authoritative BS new-year fixture in both directions',
      () {
        final bs = NepaliBsCalendar.fromAd(DateTime.utc(2024, 4, 13));

        expect(bs.year, 2081);
        expect(bs.month, 1);
        expect(bs.day, 1);
        expect(NepaliBsCalendar.toAd(bs), DateTime.utc(2024, 4, 13));
      },
    );

    test('formats canonical English BS date and Nepal time presets', () {
      final instant = DateTime.utc(2026, 6, 20, 5);

      expect(NepaliBsCalendar.formatBsDate(instant, short: true), '2083-03-06');
      expect(NepaliBsCalendar.formatBsDate(instant), 'Asar 6, 2083');
      expect(
        NepaliBsCalendar.formatBsDate(instant, long: true),
        'Saturday, Asar 6, 2083',
      );
      expect(NepaliBsCalendar.formatNepalTime(instant), '10:45 AM NPT');
      expect(
        NepaliBsCalendar.formatBsDateTime(instant),
        'Asar 6, 2083, 10:45 AM NPT',
      );
      expect(NepaliBsCalendar.formatAcademicYear(2083), '2083/84');
    });

    test('uses Nepal school-day boundaries, not device-local dates', () {
      final beforeMidnight = DateTime.utc(2026, 6, 19, 18, 14, 59, 999);
      final atMidnight = DateTime.utc(2026, 6, 19, 18, 15);

      expect(
        NepaliBsCalendar.formatBsDate(beforeMidnight, short: true),
        '2083-03-05',
      );
      expect(
        NepaliBsCalendar.formatBsDate(atMidnight, short: true),
        '2083-03-06',
      );
      expect(
        NepaliBsCalendar.isSameNepalSchoolDay(beforeMidnight, atMidnight),
        isFalse,
      );
      expect(
        NepaliBsCalendar.startOfNepalSchoolDayUtc(atMidnight),
        DateTime.utc(2026, 6, 19, 18, 15),
      );
    });

    test('rejects malformed and impossible BS input dates', () {
      expect(
        () => NepaliBsCalendar.parseBsDateInput('2083-3-06'),
        throwsArgumentError,
      );
      expect(
        () => NepaliBsCalendar.parseBsDateInput('2083-03-33'),
        throwsArgumentError,
      );
    });
  });
}
