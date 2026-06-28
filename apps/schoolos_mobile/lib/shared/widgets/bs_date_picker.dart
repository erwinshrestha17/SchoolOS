import 'package:flutter/material.dart';

import '../utils/nepali_bs_calendar.dart';

Future<DateTime?> showSchoolBsDatePicker({
  required BuildContext context,
  required DateTime initialDate,
  required DateTime firstDate,
  required DateTime lastDate,
}) {
  final initialBs = NepaliBsCalendar.fromAd(initialDate);
  final firstBs = NepaliBsCalendar.fromAd(firstDate);
  final lastBs = NepaliBsCalendar.fromAd(lastDate);
  var year = initialBs.year;
  var month = initialBs.month;
  var day = initialBs.day;
  String? error;

  return showDialog<DateTime>(
    context: context,
    builder: (context) => StatefulBuilder(
      builder: (context, setState) {
        final daysInMonth = NepaliBsCalendar.daysInMonth(year, month);
        if (day > daysInMonth) {
          day = daysInMonth;
        }

        return AlertDialog(
          title: const Text('Select BS date'),
          content: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<int>(
                  initialValue: year,
                  decoration: const InputDecoration(labelText: 'BS year'),
                  items: [
                    for (
                      var value = firstBs.year;
                      value <= lastBs.year;
                      value++
                    )
                      DropdownMenuItem(value: value, child: Text('$value')),
                  ],
                  onChanged: (value) {
                    if (value == null) return;
                    setState(() {
                      year = value;
                      error = null;
                    });
                  },
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<int>(
                  initialValue: month,
                  decoration: const InputDecoration(labelText: 'BS month'),
                  items: [
                    for (var value = 1; value <= 12; value++)
                      DropdownMenuItem(
                        value: value,
                        child: Text(NepaliBsCalendar.monthName(value)),
                      ),
                  ],
                  onChanged: (value) {
                    if (value == null) return;
                    setState(() {
                      month = value;
                      error = null;
                    });
                  },
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<int>(
                  initialValue: day,
                  decoration: const InputDecoration(labelText: 'BS day'),
                  items: [
                    for (var value = 1; value <= daysInMonth; value++)
                      DropdownMenuItem(value: value, child: Text('$value')),
                  ],
                  onChanged: (value) {
                    if (value == null) return;
                    setState(() {
                      day = value;
                      error = null;
                    });
                  },
                ),
                if (error != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    error!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () {
                final selected = NepaliBsCalendar.toAd(
                  BsDate(year: year, month: month, day: day),
                );
                final selectedDay = DateTime.utc(
                  selected.year,
                  selected.month,
                  selected.day,
                );
                final firstDay = DateTime.utc(
                  firstDate.year,
                  firstDate.month,
                  firstDate.day,
                );
                final lastDay = DateTime.utc(
                  lastDate.year,
                  lastDate.month,
                  lastDate.day,
                );

                if (selectedDay.isBefore(firstDay) ||
                    selectedDay.isAfter(lastDay)) {
                  setState(() {
                    error = 'Choose a date within the allowed range.';
                  });
                  return;
                }

                Navigator.of(context).pop(selected);
              },
              child: const Text('Select'),
            ),
          ],
        );
      },
    ),
  );
}
