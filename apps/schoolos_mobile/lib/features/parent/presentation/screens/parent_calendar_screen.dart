import 'package:flutter/material.dart';

import '../widgets/parent_detail_widgets.dart';
import '../widgets/parent_portal_widgets.dart';

class ParentCalendarScreen extends StatefulWidget {
  const ParentCalendarScreen({super.key});
  @override
  State<ParentCalendarScreen> createState() => _ParentCalendarScreenState();
}

class _ParentCalendarScreenState extends State<ParentCalendarScreen> {
  int month = 6;
  int selectedDay = 10;
  final events = const [
    (
      6,
      'Parent–Teacher Meeting',
      'Friday • 10:00 AM\nFor Aarohi • LKG-A',
      ParentPortalColors.purple,
      Icons.event_available_rounded,
    ),
    (
      9,
      'School Holiday',
      'Eid • Ganatantra Diwas',
      ParentPortalColors.blue,
      Icons.calendar_month_rounded,
    ),
    (
      16,
      'Unit Test Begins',
      'Monday • For Aarav • Nursery-A',
      ParentPortalColors.orange,
      Icons.assignment_rounded,
    ),
    (
      21,
      'Annual Sports Day',
      'Next week • Sat, 21 Jun',
      ParentPortalColors.green,
      Icons.emoji_events_rounded,
    ),
  ];
  @override
  Widget build(BuildContext context) => ParentDetailScaffold(
    title: 'School Calendar',
    selectedIndex: 4,
    body: ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
      children: [
        PortalCard(
          child: Column(
            children: [
              Row(
                children: [
                  IconButton(
                    onPressed: () => setState(() {
                      month = month == 1 ? 12 : month - 1;
                      selectedDay = 1;
                    }),
                    icon: const Icon(Icons.chevron_left),
                  ),
                  Expanded(
                    child: Text(
                      '${_monthName(month)} 2083',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: () => setState(() {
                      month = month == 12 ? 1 : month + 1;
                      selectedDay = 1;
                    }),
                    icon: const Icon(Icons.chevron_right),
                  ),
                ],
              ),
              Row(
                children: [
                  for (final d in [
                    'Sun',
                    'Mon',
                    'Tue',
                    'Wed',
                    'Thu',
                    'Fri',
                    'Sat',
                  ])
                    Expanded(
                      child: Text(
                        d,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 12,
                          color: ParentPortalColors.muted,
                        ),
                      ),
                    ),
                ],
              ),
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: 35,
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 7,
                ),
                itemBuilder: (_, i) {
                  final day = i + 1;
                  final event = month == 6
                      ? events.where((e) => e.$1 == day).firstOrNull
                      : null;
                  return InkWell(
                    onTap: () => setState(() => selectedDay = day),
                    child: Container(
                      margin: const EdgeInsets.all(2),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: selectedDay == day
                            ? ParentPortalColors.greenSoft
                            : null,
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            '$day',
                            style: TextStyle(
                              fontWeight: selectedDay == day
                                  ? FontWeight.w900
                                  : null,
                            ),
                          ),
                          if (event != null)
                            Container(
                              width: 6,
                              height: 6,
                              margin: const EdgeInsets.only(top: 3),
                              decoration: BoxDecoration(
                                color: event.$4,
                                shape: BoxShape.circle,
                              ),
                            ),
                        ],
                      ),
                    ),
                  );
                },
              ),
              const Divider(),
              const Wrap(
                spacing: 16,
                runSpacing: 8,
                children: [
                  _CalLegend('Events', ParentPortalColors.green),
                  _CalLegend('Meetings', ParentPortalColors.purple),
                  _CalLegend('Exams', ParentPortalColors.orange),
                  _CalLegend('Holidays', ParentPortalColors.blue),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        const ParentSectionHeader(title: 'Upcoming'),
        Align(
          alignment: Alignment.centerRight,
          child: TextButton.icon(
            onPressed: () => showFeatureSnack(
              context,
              'Events added to the mock phone calendar.',
            ),
            icon: const Icon(Icons.calendar_month_rounded),
            label: const Text('Add to phone calendar'),
          ),
        ),
        const SizedBox(height: 8),
        for (final event in events.where(
          (event) =>
              month != 6 ||
              selectedDay == 1 ||
              event.$1 == selectedDay ||
              selectedDay == 10,
        )) ...[
          PortalCard(
            onTap: () => _eventSheet(context, event),
            child: Row(
              children: [
                FeatureIcon(event.$5, color: event.$4),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        event.$2,
                        style: const TextStyle(
                          fontWeight: FontWeight.w900,
                          fontSize: 16,
                        ),
                      ),
                      Text(
                        event.$3,
                        style: const TextStyle(color: ParentPortalColors.muted),
                      ),
                    ],
                  ),
                ),
                Text(
                  '${event.$1} Jun',
                  style: TextStyle(
                    color: event.$4,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const ListChevron(),
              ],
            ),
          ),
          const SizedBox(height: 10),
        ],
      ],
    ),
  );
  String _monthName(int value) => const [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'June',
    'July',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ][value - 1];
  void _eventSheet(
    BuildContext context,
    (int, String, String, Color, IconData) event,
  ) => showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (_) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            FeatureIcon(event.$5, color: event.$4, size: 60),
            const SizedBox(height: 12),
            Text(
              event.$2,
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 8),
            Text(
              event.$3,
              textAlign: TextAlign.center,
              style: const TextStyle(color: ParentPortalColors.muted),
            ),
            const SizedBox(height: 10),
            Text(
              '${event.$1} June 2083',
              style: TextStyle(color: event.$4, fontWeight: FontWeight.w800),
            ),
          ],
        ),
      ),
    ),
  );
}

class _CalLegend extends StatelessWidget {
  const _CalLegend(this.label, this.color);
  final String label;
  final Color color;
  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Container(
        width: 9,
        height: 9,
        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
      ),
      const SizedBox(width: 5),
      Text(label, style: const TextStyle(fontSize: 12)),
    ],
  );
}
