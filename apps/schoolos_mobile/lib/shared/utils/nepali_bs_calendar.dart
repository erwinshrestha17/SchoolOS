import 'package:nepali_utils/nepali_utils.dart';
import 'package:timezone/data/latest.dart' as tz_data;
import 'package:timezone/timezone.dart' as tz;

/// Canonical SchoolOS Nepal date/time policy for Flutter.
///
/// Timestamp instants are localized through IANA `Asia/Kathmandu` before BS
/// conversion. Date-only business values remain Gregorian `YYYY-MM-DD` at API
/// boundaries. Do not use the device timezone or a manual year offset.
class BsDate {
  const BsDate({required this.year, required this.month, required this.day});

  final int year;
  final int month;
  final int day;

  String get monthName => NepaliBsCalendar.monthName(month);
  String get inputValue =>
      '${year.toString().padLeft(4, '0')}-${month.toString().padLeft(2, '0')}-${day.toString().padLeft(2, '0')}';
  DateTime get gregorianDate => NepaliBsCalendar.toAd(this);

  @Deprecated('Use gregorianDate.')
  DateTime get approximateAdDate => gregorianDate;
}

class NepalLocalDateTime {
  const NepalLocalDateTime({
    required this.year,
    required this.month,
    required this.day,
    required this.hour,
    required this.minute,
    required this.second,
    required this.millisecond,
  });

  final int year;
  final int month;
  final int day;
  final int hour;
  final int minute;
  final int second;
  final int millisecond;

  String get gregorianDateInput =>
      '${year.toString().padLeft(4, '0')}-${month.toString().padLeft(2, '0')}-${day.toString().padLeft(2, '0')}';
}

class NepaliBsCalendar {
  const NepaliBsCalendar._();

  static const timeZone = 'Asia/Kathmandu';
  static const _monthNames = <String>[
    'Baisakh',
    'Jestha',
    'Asar',
    'Shrawan',
    'Bhadra',
    'Ashwin',
    'Kartik',
    'Mangsir',
    'Poush',
    'Magh',
    'Falgun',
    'Chaitra',
  ];
  static const _weekdayNames = <String>[
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];

  static bool _timeZoneInitialized = false;

  static tz.Location get _nepalLocation {
    if (!_timeZoneInitialized) {
      tz_data.initializeTimeZones();
      _timeZoneInitialized = true;
    }
    return tz.getLocation(timeZone);
  }

  static NepalLocalDateTime toNepalLocalDateTime(DateTime value) {
    final local = tz.TZDateTime.from(value.toUtc(), _nepalLocation);
    return NepalLocalDateTime(
      year: local.year,
      month: local.month,
      day: local.day,
      hour: local.hour,
      minute: local.minute,
      second: local.second,
      millisecond: local.millisecond,
    );
  }

  static NepalLocalDateTime getNepalNow() =>
      toNepalLocalDateTime(DateTime.now());

  static BsDate today() => fromAd(DateTime.now());

  static String monthName(int month) {
    if (month < 1 || month > 12) {
      throw ArgumentError.value(month, 'month', 'BS month must be 1-12.');
    }
    return _monthNames[month - 1];
  }

  static BsDate fromAd(DateTime value) {
    final local = toNepalLocalDateTime(value);
    final bs = DateTime.utc(
      local.year,
      local.month,
      local.day,
    ).toNepaliDateTime();
    return BsDate(year: bs.year, month: bs.month, day: bs.day);
  }

  static DateTime toAd(BsDate value) {
    final bs = NepaliDateTime.parse(value.inputValue);
    final date = bs.toDateTime();
    return DateTime.utc(date.year, date.month, date.day);
  }

  static int daysInMonth(int year, int month) {
    final start = toAd(BsDate(year: year, month: month, day: 1));
    final next = month == 12
        ? toAd(BsDate(year: year + 1, month: 1, day: 1))
        : toAd(BsDate(year: year, month: month + 1, day: 1));
    return next.difference(start).inDays;
  }

  static BsDate parseBsDateInput(String value) {
    final match = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$').firstMatch(value.trim());
    if (match == null) {
      throw ArgumentError('BS date must use YYYY-MM-DD with English numerals.');
    }
    final date = BsDate(
      year: int.parse(match.group(1)!),
      month: int.parse(match.group(2)!),
      day: int.parse(match.group(3)!),
    );
    final days = daysInMonth(date.year, date.month);
    if (date.day < 1 || date.day > days) {
      throw ArgumentError('BS date is not valid.');
    }
    return date;
  }

  static String formatBsDateForInput(DateTime value) =>
      fromAd(value).inputValue;

  static String formatBsDate(
    DateTime value, {
    bool short = false,
    bool long = false,
  }) {
    final local = toNepalLocalDateTime(value);
    final date = fromAd(value);
    if (short) return date.inputValue;
    final standard = '${monthName(date.month)} ${date.day}, ${date.year}';
    if (!long) return standard;
    final weekday =
        DateTime.utc(local.year, local.month, local.day).weekday % 7;
    return '${_weekdayNames[weekday]}, $standard';
  }

  static String formatNepalTime(DateTime value) {
    final local = toNepalLocalDateTime(value);
    final suffix = local.hour >= 12 ? 'PM' : 'AM';
    final hour = local.hour % 12 == 0 ? 12 : local.hour % 12;
    return '${hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')} $suffix NPT';
  }

  static String formatBsDateTime(DateTime value) =>
      '${formatBsDate(value)}, ${formatNepalTime(value)}';

  static String formatAcademicYear(int year) =>
      '$year/${((year + 1) % 100).toString().padLeft(2, '0')}';

  static String formatDateRange(BsDate start, BsDate end) {
    if (start.year == end.year && start.month == end.month) {
      return '${monthName(start.month)} ${start.day}–${end.day}, ${start.year}';
    }
    return '${monthName(start.month)} ${start.day}, ${start.year} – '
        '${monthName(end.month)} ${end.day}, ${end.year}';
  }

  static bool isSameNepalSchoolDay(DateTime left, DateTime right) {
    final a = toNepalLocalDateTime(left);
    final b = toNepalLocalDateTime(right);
    return a.year == b.year && a.month == b.month && a.day == b.day;
  }

  static DateTime startOfNepalSchoolDayUtc(DateTime value) {
    final local = toNepalLocalDateTime(value);
    return tz.TZDateTime(
      _nepalLocation,
      local.year,
      local.month,
      local.day,
    ).toUtc();
  }
}
