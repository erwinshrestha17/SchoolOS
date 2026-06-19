class BsDate {
  const BsDate({required this.year, required this.month, required this.day});

  final int year;
  final int month;
  final int day;

  String get monthName => NepaliBsCalendar.monthName(month);

  DateTime get approximateAdDate => NepaliBsCalendar.toAd(this);
}

class NepaliBsCalendar {
  const NepaliBsCalendar._();

  static final _anchorAd = DateTime.utc(2024, 4, 13);
  static const _anchorBs = BsDate(year: 2081, month: 1, day: 1);

  static const _monthNames = [
    'Baisakh',
    'Jestha',
    'Ashadh',
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

  static const Map<int, List<int>> _monthDays = {
    2081: [31, 31, 32, 31, 31, 31, 30, 29, 30, 30, 29, 31],
    2082: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
    2083: [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30],
    2084: [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30],
  };

  static String monthName(int month) {
    if (month < 1 || month > 12) {
      return 'BS';
    }
    return _monthNames[month - 1];
  }

  static int daysInMonth(int year, int month) {
    final months = _monthDays[year];
    if (months == null || month < 1 || month > 12) {
      return 30;
    }
    return months[month - 1];
  }

  static BsDate fromAd(DateTime value) {
    final utc = DateTime.utc(value.year, value.month, value.day);
    var delta = utc.difference(_anchorAd).inDays;
    var year = _anchorBs.year;
    var month = _anchorBs.month;
    var day = _anchorBs.day;

    if (delta >= 0) {
      while (delta > 0) {
        final days = daysInMonth(year, month);
        if (day < days) {
          day += 1;
        } else {
          day = 1;
          month += 1;
          if (month > 12) {
            month = 1;
            year += 1;
          }
        }
        delta -= 1;
      }
      return BsDate(year: year, month: month, day: day);
    }

    while (delta < 0) {
      if (day > 1) {
        day -= 1;
      } else {
        month -= 1;
        if (month < 1) {
          year -= 1;
          month = 12;
        }
        day = daysInMonth(year, month);
      }
      delta += 1;
    }
    return BsDate(year: year, month: month, day: day);
  }

  static DateTime toAd(BsDate value) {
    var date = _anchorAd;
    var year = _anchorBs.year;
    var month = _anchorBs.month;
    var day = _anchorBs.day;

    while (year != value.year || month != value.month || day != value.day) {
      date = date.add(const Duration(days: 1));
      final days = daysInMonth(year, month);
      if (day < days) {
        day += 1;
      } else {
        day = 1;
        month += 1;
        if (month > 12) {
          month = 1;
          year += 1;
        }
      }

      if (date.year > 2030) {
        break;
      }
    }

    return DateTime(date.year, date.month, date.day);
  }
}
