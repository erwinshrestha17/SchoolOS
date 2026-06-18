import 'package:flutter/material.dart';

import '../../../parent/domain/parent_feature_models.dart';
import '../../../parent/presentation/widgets/parent_detail_widgets.dart';
import '../../../parent/presentation/widgets/parent_portal_widgets.dart';

class ParentAttendanceScreen extends StatefulWidget {
  const ParentAttendanceScreen({super.key, required this.studentId});
  final String studentId;
  @override
  State<ParentAttendanceScreen> createState() => _ParentAttendanceScreenState();
}

class _ParentAttendanceScreenState extends State<ParentAttendanceScreen> {
  late ChildProfile child = parentChildren.firstWhere(
    (item) => item.id == widget.studentId,
    orElse: () => parentChildren.first,
  );
  int monthOffset = 0;
  int selectedDay = 18;

  static const records = [
    AttendanceRecord('18 Ashadh', 'Present', '8:42 AM'),
    AttendanceRecord('17 Ashadh', 'Present', '8:41 AM'),
    AttendanceRecord('16 Ashadh', 'Late', '9:12 AM'),
    AttendanceRecord('15 Ashadh', 'Absent', null),
  ];

  @override
  Widget build(BuildContext context) => ParentDetailScaffold(
    title: 'Attendance',
    selectedIndex: 1,
    body: ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
      children: [
        ParentChildSelector(
          child: child,
          onChanged: (value) => setState(() => child = value),
        ),
        const SizedBox(height: 14),
        PortalCard(
          color: ParentPortalColors.greenSoft,
          child: Row(
            children: [
              const FeatureIcon(
                Icons.check_rounded,
                color: ParentPortalColors.green,
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Today: Present at ${child.id == 'aarav' ? '8:42 AM' : '8:38 AM'}',
                      style: const TextStyle(
                        color: ParentPortalColors.green,
                        fontWeight: FontWeight.w900,
                        fontSize: 17,
                      ),
                    ),
                    Text(
                      'Great start! Keep it up, ${child.name.split(' ').first}.',
                      style: const TextStyle(color: ParentPortalColors.muted),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        PortalCard(
          child: Row(
            children: const [
              Expanded(
                child: _Metric(
                  label: 'Attendance rate',
                  value: '94%',
                  note: '↑ 2% vs last month',
                  color: ParentPortalColors.green,
                ),
              ),
              Expanded(
                child: _Metric(
                  label: 'Present',
                  value: '17',
                  note: 'days',
                  color: ParentPortalColors.green,
                ),
              ),
              Expanded(
                child: _Metric(
                  label: 'Absent',
                  value: '1',
                  note: 'day',
                  color: ParentPortalColors.red,
                ),
              ),
              Expanded(
                child: _Metric(
                  label: 'Late',
                  value: '1',
                  note: 'day',
                  color: ParentPortalColors.orange,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        PortalCard(
          child: Column(
            children: [
              Row(
                children: [
                  IconButton(
                    onPressed: () => setState(() => monthOffset--),
                    icon: const Icon(Icons.chevron_left_rounded),
                  ),
                  Expanded(
                    child: Text(
                      _monthLabel,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                        color: ParentPortalColors.navy,
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: () => setState(() => monthOffset++),
                    icon: const Icon(Icons.chevron_right_rounded),
                  ),
                ],
              ),
              Row(
                children: [
                  for (final day in [
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
                        day,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: ParentPortalColors.muted,
                          fontSize: 12,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: 35,
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 7,
                  childAspectRatio: .92,
                ),
                itemBuilder: (_, index) {
                  final day = index + 1;
                  final color = day == 20
                      ? ParentPortalColors.red
                      : day == 16
                      ? ParentPortalColors.orange
                      : (day == 7 || day == 14 || day == 21 || day == 28)
                      ? ParentPortalColors.purple
                      : ParentPortalColors.green;
                  return InkWell(
                    onTap: () => setState(() => selectedDay = day),
                    borderRadius: BorderRadius.circular(99),
                    child: Container(
                      margin: const EdgeInsets.all(2),
                      decoration: BoxDecoration(
                        color: selectedDay == day
                            ? color.withValues(alpha: .13)
                            : null,
                        shape: BoxShape.circle,
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            '$day',
                            style: TextStyle(
                              fontWeight: selectedDay == day
                                  ? FontWeight.w900
                                  : FontWeight.w500,
                            ),
                          ),
                          Container(
                            width: 5,
                            height: 5,
                            margin: const EdgeInsets.only(top: 3),
                            decoration: BoxDecoration(
                              color: color,
                              shape: BoxShape.circle,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
              const Divider(height: 20),
              const Wrap(
                spacing: 18,
                runSpacing: 8,
                alignment: WrapAlignment.center,
                children: [
                  _Legend('Present', ParentPortalColors.green),
                  _Legend('Absent', ParentPortalColors.red),
                  _Legend('Late', ParentPortalColors.orange),
                  _Legend('Holiday', ParentPortalColors.purple),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        const ParentSectionHeader(title: 'Recent records'),
        const SizedBox(height: 8),
        PortalCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              for (var i = 0; i < records.length; i++) ...[
                ListTile(
                  leading: FeatureIcon(
                    records[i].status == 'Present'
                        ? Icons.check_rounded
                        : records[i].status == 'Late'
                        ? Icons.schedule_rounded
                        : Icons.close_rounded,
                    color: _statusColor(records[i].status),
                    size: 36,
                  ),
                  title: Text(
                    records[i].day,
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                  subtitle: Text(
                    records[i].status,
                    style: TextStyle(color: _statusColor(records[i].status)),
                  ),
                  trailing: Text(records[i].time ?? '—'),
                ),
                if (i < records.length - 1) const Divider(height: 1),
              ],
            ],
          ),
        ),
        const SizedBox(height: 14),
        Row(
          children: [
            Expanded(
              child: FilledButton.icon(
                onPressed: () => _requestSheet('Request correction'),
                icon: const Icon(Icons.edit_calendar_rounded),
                label: const Text('Request correction'),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => _requestSheet('Report planned absence'),
                icon: const Icon(Icons.calendar_month_rounded),
                label: const Text('Planned absence'),
              ),
            ),
          ],
        ),
      ],
    ),
  );

  String get _monthLabel {
    const months = ['May 2083', 'June 2083', 'July 2083'];
    return months[(monthOffset + 1).clamp(0, 2)];
  }

  Future<void> _requestSheet(String title) async {
    final reason = TextEditingController();
    DateTime date = DateTime.now();
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) => Padding(
          padding: EdgeInsets.fromLTRB(
            20,
            0,
            20,
            MediaQuery.viewInsetsOf(context).bottom + 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 14),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.event_rounded),
                title: const Text('Date'),
                subtitle: Text('${date.day}/${date.month}/${date.year}'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () async {
                  final picked = await showDatePicker(
                    context: context,
                    initialDate: date,
                    firstDate: DateTime.now().subtract(
                      const Duration(days: 30),
                    ),
                    lastDate: DateTime.now().add(const Duration(days: 60)),
                  );
                  if (picked != null) setSheetState(() => date = picked);
                },
              ),
              TextField(
                controller: reason,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Reason',
                  hintText: 'Add a clear reason',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () {
                    Navigator.pop(context);
                    showFeatureSnack(
                      this.context,
                      '$title submitted successfully.',
                    );
                  },
                  child: const Text('Submit request'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
    reason.dispose();
  }
}

class _Metric extends StatelessWidget {
  const _Metric({
    required this.label,
    required this.value,
    required this.note,
    required this.color,
  });
  final String label;
  final String value;
  final String note;
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 4),
    decoration: const BoxDecoration(
      border: Border(right: BorderSide(color: ParentPortalColors.border)),
    ),
    child: Column(
      children: [
        Text(
          label,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 11, color: ParentPortalColors.muted),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.w900,
            color: color,
          ),
        ),
        Text(
          note,
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 10, color: color),
        ),
      ],
    ),
  );
}

class _Legend extends StatelessWidget {
  const _Legend(this.label, this.color);
  final String label;
  final Color color;
  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Container(
        width: 8,
        height: 8,
        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
      ),
      const SizedBox(width: 5),
      Text(
        label,
        style: const TextStyle(fontSize: 12, color: ParentPortalColors.muted),
      ),
    ],
  );
}

Color _statusColor(String status) => status == 'Present'
    ? ParentPortalColors.green
    : status == 'Late'
    ? ParentPortalColors.orange
    : ParentPortalColors.red;

class StudentAttendanceScreen extends StatelessWidget {
  const StudentAttendanceScreen({super.key});
  @override
  Widget build(BuildContext context) =>
      const ParentAttendanceScreen(studentId: 'aarav');
}
