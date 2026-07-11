import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/utils/nepali_bs_calendar.dart';
import '../../application/parent_portal_providers.dart';
import '../../domain/parent_portal_models.dart';
import '../widgets/parent_detail_widgets.dart';
import '../widgets/parent_portal_widgets.dart';

class ParentCalendarScreen extends ConsumerStatefulWidget {
  const ParentCalendarScreen({super.key});

  @override
  ConsumerState<ParentCalendarScreen> createState() =>
      _ParentCalendarScreenState();
}

class _ParentCalendarScreenState extends ConsumerState<ParentCalendarScreen> {
  late BsDate visibleMonth = NepaliBsCalendar.fromAd(DateTime.now());
  late BsDate selectedDay = _defaultSelectedDay(visibleMonth);

  static BsDate _defaultSelectedDay(BsDate month) {
    final today = NepaliBsCalendar.today();
    if (today.year == month.year && today.month == month.month) {
      return today;
    }
    return BsDate(year: month.year, month: month.month, day: 1);
  }

  @override
  Widget build(BuildContext context) {
    final portal = ref.watch(parentPortalDataProvider);
    return ParentDetailScaffold(
      title: 'BS Calendar',
      selectedIndex: 5,
      body: portal.when(
        loading: () => const PortalLoadingState(),
        error: (_, _) => PortalErrorState(
          onRetry: () => ref.invalidate(parentPortalDataProvider),
        ),
        data: (data) {
          final bounds = _academicBounds(data);
          visibleMonth = _clampMonth(visibleMonth, bounds.$1, bounds.$2);
          final markers = _calendarMarkers(data);
          final visibleMarkers = markers
              .where(
                (item) =>
                    item.bs.year == visibleMonth.year &&
                    item.bs.month == visibleMonth.month,
              )
              .toList();
          final dayMarkers = markers
              .where(
                (item) =>
                    item.bs.year == selectedDay.year &&
                    item.bs.month == selectedDay.month &&
                    item.bs.day == selectedDay.day,
              )
              .toList();
          final selectedAd = selectedDay.gregorianDate;
          final upcoming =
              markers
                  .where((item) => item.bs.gregorianDate.isAfter(selectedAd))
                  .toList()
                ..sort(
                  (a, b) => a.bs.gregorianDate.compareTo(b.bs.gregorianDate),
                );
          final childNames = {
            for (final child in data.children) child.id: child.name,
          };
          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(parentPortalDataProvider);
              await ref.read(parentPortalDataProvider.future);
            },
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
              children: [
                _CalendarHeader(
                  month: visibleMonth,
                  onPrevious: () => setState(() {
                    visibleMonth = _addMonths(visibleMonth, -1);
                    selectedDay = _defaultSelectedDay(visibleMonth);
                  }),
                  onNext: () => setState(() {
                    visibleMonth = _addMonths(visibleMonth, 1);
                    selectedDay = _defaultSelectedDay(visibleMonth);
                  }),
                  canGoPrevious: _compareMonth(visibleMonth, bounds.$1) > 0,
                  canGoNext: _compareMonth(visibleMonth, bounds.$2) < 0,
                  academicYearLabel: _academicYearLabel(data),
                ),
                const SizedBox(height: 12),
                _MonthGrid(
                  month: visibleMonth,
                  markers: visibleMarkers,
                  selectedDay: selectedDay,
                  onDaySelected: (day) => setState(() {
                    selectedDay = BsDate(
                      year: visibleMonth.year,
                      month: visibleMonth.month,
                      day: day,
                    );
                  }),
                ),
                const SizedBox(height: 14),
                _SelectedDayCard(
                  day: selectedDay,
                  isHoliday: _isHolidayBs(selectedDay),
                  dayMarkers: dayMarkers,
                  upcoming: upcoming.take(5).toList(),
                  childNames: childNames,
                ),
                const SizedBox(height: 18),
                const ParentSectionHeader(title: 'This month'),
                const SizedBox(height: 10),
                if (data.children.length == 1)
                  _ChildCalendarSection(
                    child: data.children.first,
                    markers: visibleMarkers
                        .where((item) => item.childId == data.children.first.id)
                        .toList(),
                  )
                else
                  for (final child in data.children) ...[
                    _ChildCalendarSection(
                      child: child,
                      markers: visibleMarkers
                          .where((item) => item.childId == child.id)
                          .toList(),
                    ),
                    const SizedBox(height: 12),
                  ],
                const SizedBox(height: 10),
                const PortalCard(
                  color: ParentPortalColors.surfaceAlt,
                  child: Text(
                    'BS calendar dates are shown in English. School events and child items refresh from mobile parent APIs.',
                    style: TextStyle(color: ParentPortalColors.muted),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _CalendarHeader extends StatelessWidget {
  const _CalendarHeader({
    required this.month,
    required this.onPrevious,
    required this.onNext,
    required this.canGoPrevious,
    required this.canGoNext,
    required this.academicYearLabel,
  });

  final BsDate month;
  final VoidCallback onPrevious;
  final VoidCallback onNext;
  final bool canGoPrevious;
  final bool canGoNext;
  final String academicYearLabel;

  @override
  Widget build(BuildContext context) {
    return PortalCard(
      child: Row(
        children: [
          IconButton(
            tooltip: 'Previous month',
            onPressed: canGoPrevious ? onPrevious : null,
            icon: const Icon(Icons.chevron_left_rounded),
          ),
          Expanded(
            child: Column(
              children: [
                Text(
                  '${month.monthName} ${month.year}',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: ParentPortalColors.navy,
                    fontWeight: FontWeight.w900,
                    fontSize: 20,
                  ),
                ),
                Text(
                  academicYearLabel,
                  style: const TextStyle(color: ParentPortalColors.muted),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Next month',
            onPressed: canGoNext ? onNext : null,
            icon: const Icon(Icons.chevron_right_rounded),
          ),
        ],
      ),
    );
  }
}

class _MonthGrid extends StatelessWidget {
  const _MonthGrid({
    required this.month,
    required this.markers,
    required this.selectedDay,
    required this.onDaySelected,
  });

  final BsDate month;
  final List<_CalendarMarker> markers;
  final BsDate selectedDay;
  final ValueChanged<int> onDaySelected;

  @override
  Widget build(BuildContext context) {
    final days = NepaliBsCalendar.daysInMonth(month.year, month.month);
    final firstAd = BsDate(
      year: month.year,
      month: month.month,
      day: 1,
    ).gregorianDate;
    final leading = firstAd.weekday % 7;
    final cells = leading + days;
    final isSelectedMonth =
        selectedDay.year == month.year && selectedDay.month == month.month;

    return PortalCard(
      child: Column(
        children: [
          const Row(
            children: [
              _WeekdayLabel('Sun'),
              _WeekdayLabel('Mon'),
              _WeekdayLabel('Tue'),
              _WeekdayLabel('Wed'),
              _WeekdayLabel('Thu'),
              _WeekdayLabel('Fri'),
              _WeekdayLabel('Sat'),
            ],
          ),
          const SizedBox(height: 8),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 7,
              childAspectRatio: .82,
            ),
            itemCount: cells,
            itemBuilder: (context, index) {
              if (index < leading) {
                return const SizedBox.shrink();
              }
              final day = index - leading + 1;
              final date = BsDate(
                year: month.year,
                month: month.month,
                day: day,
              );
              final adDate = date.gregorianDate;
              final dayMarkers = markers
                  .where((item) => item.bs.day == day)
                  .toList();
              final isToday = _sameDay(adDate, DateTime.now());
              final isHoliday = adDate.weekday == DateTime.saturday;
              return _DayCell(
                day: day,
                isToday: isToday,
                isHoliday: isHoliday,
                isSelected: isSelectedMonth && selectedDay.day == day,
                markers: dayMarkers,
                onTap: () => onDaySelected(day),
              );
            },
          ),
          const Divider(height: 18),
          const Wrap(
            spacing: 12,
            runSpacing: 8,
            children: [
              _LegendDot(color: ParentPortalColors.green, label: 'Attendance'),
              _LegendDot(color: ParentPortalColors.purple, label: 'Homework'),
              _LegendDot(color: ParentPortalColors.orange, label: 'Fees'),
              _LegendDot(color: ParentPortalColors.blue, label: 'Notice/Event'),
              _LegendDot(color: ParentPortalColors.red, label: 'Holiday'),
            ],
          ),
        ],
      ),
    );
  }
}

class _WeekdayLabel extends StatelessWidget {
  const _WeekdayLabel(this.label);

  final String label;

  @override
  Widget build(BuildContext context) => Expanded(
    child: Text(
      label,
      textAlign: TextAlign.center,
      style: const TextStyle(
        color: ParentPortalColors.muted,
        fontWeight: FontWeight.w800,
        fontSize: 12,
      ),
    ),
  );
}

class _DayCell extends StatelessWidget {
  const _DayCell({
    required this.day,
    required this.isToday,
    required this.isHoliday,
    required this.isSelected,
    required this.markers,
    required this.onTap,
  });

  final int day;
  final bool isToday;
  final bool isHoliday;
  final bool isSelected;
  final List<_CalendarMarker> markers;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final textColor = isSelected
        ? Colors.white
        : isHoliday
        ? ParentPortalColors.red
        : ParentPortalColors.navy;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          margin: const EdgeInsets.all(2),
          decoration: BoxDecoration(
            color: isSelected
                ? ParentPortalColors.green
                : isToday
                ? ParentPortalColors.greenSoft
                : Colors.transparent,
            borderRadius: BorderRadius.circular(14),
            border: !isSelected && isToday
                ? Border.all(
                    color: ParentPortalColors.green.withValues(alpha: .4),
                  )
                : null,
          ),
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  '$day',
                  style: TextStyle(
                    color: textColor,
                    fontWeight: isToday || isSelected
                        ? FontWeight.w900
                        : FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 5),
                Wrap(
                  alignment: WrapAlignment.center,
                  spacing: 3,
                  runSpacing: 3,
                  children: [
                    if (isHoliday)
                      _MiniDot(
                        isSelected ? Colors.white : ParentPortalColors.red,
                      ),
                    for (final marker in markers.take(4))
                      _MiniDot(isSelected ? Colors.white : marker.color),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ChildCalendarSection extends StatelessWidget {
  const _ChildCalendarSection({required this.child, required this.markers});

  final ParentPortalChild child;
  final List<_CalendarMarker> markers;

  @override
  Widget build(BuildContext context) {
    return PortalCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              AvatarInitials(name: child.name, radius: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      child.name,
                      style: const TextStyle(
                        color: ParentPortalColors.navy,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    Text(
                      '${child.classSection} - ${child.teacher}',
                      style: const TextStyle(color: ParentPortalColors.muted),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (markers.isEmpty)
            const Text(
              'No dated child items in this BS month.',
              style: TextStyle(color: ParentPortalColors.muted),
            )
          else
            for (final item in markers.take(6)) ...[
              _MarkerRow(marker: item),
              const SizedBox(height: 8),
            ],
        ],
      ),
    );
  }
}

class _MarkerRow extends StatelessWidget {
  const _MarkerRow({
    required this.marker,
    this.childName,
    this.showDate = true,
  });

  final _CalendarMarker marker;
  final String? childName;
  final bool showDate;

  @override
  Widget build(BuildContext context) {
    final prefixParts = <String>[
      ?childName,
      if (showDate) '${marker.bs.day} ${marker.bs.monthName}',
    ];
    final prefix = prefixParts.join(' • ');
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(marker.icon, size: 18, color: marker.color),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            prefix.isEmpty ? marker.title : '$prefix: ${marker.title}',
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
        ),
      ],
    );
  }
}

class _SelectedDayCard extends StatelessWidget {
  const _SelectedDayCard({
    required this.day,
    required this.isHoliday,
    required this.dayMarkers,
    required this.upcoming,
    required this.childNames,
  });

  final BsDate day;
  final bool isHoliday;
  final List<_CalendarMarker> dayMarkers;
  final List<_CalendarMarker> upcoming;
  final Map<String, String> childNames;

  @override
  Widget build(BuildContext context) {
    final adDate = day.gregorianDate;
    final showChildName = childNames.length > 1;
    return PortalCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${day.day} ${day.monthName} ${day.year}',
                      style: const TextStyle(
                        color: ParentPortalColors.navy,
                        fontWeight: FontWeight.w900,
                        fontSize: 16,
                      ),
                    ),
                    Text(
                      _weekdayName(adDate.weekday),
                      style: const TextStyle(color: ParentPortalColors.muted),
                    ),
                  ],
                ),
              ),
              if (isHoliday)
                const StatusBadge(
                  label: 'Holiday',
                  color: ParentPortalColors.red,
                  backgroundColor: ParentPortalColors.redSoft,
                ),
            ],
          ),
          const SizedBox(height: 12),
          if (dayMarkers.isEmpty)
            Text(
              isHoliday
                  ? 'No school on this day.'
                  : 'No school items on this day.',
              style: const TextStyle(color: ParentPortalColors.muted),
            )
          else
            for (final marker in dayMarkers) ...[
              _MarkerRow(
                marker: marker,
                showDate: false,
                childName: showChildName ? childNames[marker.childId] : null,
              ),
              const SizedBox(height: 8),
            ],
          if (upcoming.isNotEmpty) ...[
            const Divider(height: 24),
            const Text(
              'Coming up',
              style: TextStyle(
                color: ParentPortalColors.navy,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 8),
            for (final marker in upcoming) ...[
              _MarkerRow(
                marker: marker,
                childName: showChildName ? childNames[marker.childId] : null,
              ),
              const SizedBox(height: 8),
            ],
          ],
        ],
      ),
    );
  }
}

class _LegendDot extends StatelessWidget {
  const _LegendDot({required this.color, required this.label});

  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      _MiniDot(color),
      const SizedBox(width: 5),
      Flexible(
        child: Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(color: ParentPortalColors.muted),
        ),
      ),
    ],
  );
}

class _MiniDot extends StatelessWidget {
  const _MiniDot(this.color);

  final Color color;

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(color: color, shape: BoxShape.circle),
    child: const SizedBox(width: 6, height: 6),
  );
}

class _CalendarMarker {
  const _CalendarMarker({
    required this.childId,
    required this.title,
    required this.bs,
    required this.color,
    required this.icon,
  });

  final String childId;
  final String title;
  final BsDate bs;
  final Color color;
  final IconData icon;
}

List<_CalendarMarker> _calendarMarkers(ParentPortalData data) {
  final nowBs = NepaliBsCalendar.fromAd(DateTime.now());
  final markers = <_CalendarMarker>[];
  for (final child in data.children) {
    markers.add(
      _CalendarMarker(
        childId: child.id,
        title: child.attendance,
        bs: nowBs,
        color: ParentPortalColors.green,
        icon: Icons.fact_check_rounded,
      ),
    );
    final feeDue = DateTime.tryParse(child.nextFeeDueDate ?? '');
    if (child.hasFeesDue && feeDue != null) {
      markers.add(
        _CalendarMarker(
          childId: child.id,
          title: 'Fees due NPR ${child.feesDue.toStringAsFixed(0)}',
          bs: NepaliBsCalendar.fromAd(feeDue),
          color: ParentPortalColors.orange,
          icon: Icons.account_balance_wallet_outlined,
        ),
      );
    }
  }

  for (final item in data.homework) {
    final dueAt = item.dueAt;
    if (dueAt == null) continue;
    markers.add(
      _CalendarMarker(
        childId: item.childId,
        title: item.title,
        bs: NepaliBsCalendar.fromAd(dueAt),
        color: ParentPortalColors.purple,
        icon: Icons.menu_book_outlined,
      ),
    );
  }

  for (final item in data.updates) {
    final createdAt = item.createdAt;
    if (createdAt == null) continue;
    final childIds = data.children
        .where((child) => item.metadata.contains(child.name))
        .map((child) => child.id)
        .toList();
    final targetIds = childIds.isEmpty
        ? data.children.map((child) => child.id).toList()
        : childIds;
    for (final childId in targetIds) {
      markers.add(
        _CalendarMarker(
          childId: childId,
          title: item.title,
          bs: NepaliBsCalendar.fromAd(createdAt),
          color: ParentPortalColors.blue,
          icon: item.category == ParentUpdateCategory.event
              ? Icons.event_outlined
              : Icons.campaign_outlined,
        ),
      );
    }
  }

  markers.sort((a, b) => a.bs.day.compareTo(b.bs.day));
  return markers;
}

BsDate _addMonths(BsDate value, int delta) {
  var year = value.year;
  var month = value.month + delta;
  while (month < 1) {
    month += 12;
    year -= 1;
  }
  while (month > 12) {
    month -= 12;
    year += 1;
  }
  return BsDate(year: year, month: month, day: 1);
}

bool _sameDay(DateTime a, DateTime b) {
  return a.year == b.year && a.month == b.month && a.day == b.day;
}

bool _isHolidayBs(BsDate day) => day.gregorianDate.weekday == DateTime.saturday;

const _weekdayNames = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

String _weekdayName(int weekday) => _weekdayNames[weekday - 1];

(BsDate, BsDate) _academicBounds(ParentPortalData data) {
  final starts = data.children
      .map((child) => DateTime.tryParse(child.academicYearStartsOn ?? ''))
      .whereType<DateTime>()
      .toList();
  final ends = data.children
      .map((child) => DateTime.tryParse(child.academicYearEndsOn ?? ''))
      .whereType<DateTime>()
      .toList();
  final now = DateTime.now();
  final start = starts.isEmpty
      ? DateTime(now.year, now.month - 6, 1)
      : starts.reduce((a, b) => a.isBefore(b) ? a : b);
  final end = ends.isEmpty
      ? DateTime(now.year, now.month + 6, 1)
      : ends.reduce((a, b) => a.isAfter(b) ? a : b);
  final startBs = NepaliBsCalendar.fromAd(start);
  final endBs = NepaliBsCalendar.fromAd(end);
  return (
    BsDate(year: startBs.year, month: startBs.month, day: 1),
    BsDate(year: endBs.year, month: endBs.month, day: 1),
  );
}

BsDate _clampMonth(BsDate value, BsDate start, BsDate end) {
  if (_compareMonth(value, start) < 0) return start;
  if (_compareMonth(value, end) > 0) return end;
  return value;
}

int _compareMonth(BsDate a, BsDate b) {
  return (a.year * 12 + a.month).compareTo(b.year * 12 + b.month);
}

String _academicYearLabel(ParentPortalData data) {
  final years = data.children
      .map((child) => child.academicYear)
      .where((value) => value.trim().isNotEmpty)
      .toSet()
      .toList();
  if (years.isEmpty) return 'Current academic year';
  if (years.length == 1) return 'Academic year ${years.first}';
  return 'Academic years ${years.join(', ')}';
}
