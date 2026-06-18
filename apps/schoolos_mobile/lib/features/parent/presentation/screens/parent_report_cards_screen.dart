import 'package:flutter/material.dart';

import '../../domain/parent_feature_models.dart';
import '../widgets/parent_detail_widgets.dart';
import '../widgets/parent_portal_widgets.dart';

class ParentReportCardsScreen extends StatefulWidget {
  const ParentReportCardsScreen({super.key});
  @override
  State<ParentReportCardsScreen> createState() =>
      _ParentReportCardsScreenState();
}

class _ParentReportCardsScreenState extends State<ParentReportCardsScreen> {
  ChildProfile child = parentChildren.first;

  Map<String, String> get grades => child.id == 'aarav'
      ? const {
          'Mathematics': 'A-',
          'English': 'B+',
          'Science': 'A',
          'Nepali': 'B+',
        }
      : const {
          'Mathematics': 'B+',
          'English': 'A',
          'Science': 'A-',
          'Nepali': 'A',
        };

  @override
  Widget build(BuildContext context) => ParentDetailScaffold(
    title: 'Report Cards',
    selectedIndex: 4,
    body: ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
      children: [
        ParentChildSelector(
          child: child,
          onChanged: (value) => setState(() => child = value),
        ),
        const SizedBox(height: 16),
        PortalCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const FeatureIcon(
                    Icons.description_rounded,
                    color: ParentPortalColors.green,
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'First Terminal Examination',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        Text(
                          'Published on May 28, 2025 / 15 Ashadh 2083',
                          style: TextStyle(color: ParentPortalColors.muted),
                        ),
                      ],
                    ),
                  ),
                  const StatusBadge(
                    label: 'Published',
                    icon: Icons.check_rounded,
                  ),
                ],
              ),
              const SizedBox(height: 14),
              const PortalCard(
                color: ParentPortalColors.greenSoft,
                child: Row(
                  children: [
                    Expanded(child: _ResultMetric('Overall result', 'Pass')),
                    Expanded(child: _ResultMetric('Attendance', '94%')),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Subject grades',
                style: TextStyle(fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 10),
              GridView.count(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisCount: 2,
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                childAspectRatio: 1.9,
                children: [
                  for (final entry in grades.entries)
                    PortalCard(
                      padding: const EdgeInsets.all(6),
                      color: entry.value.startsWith('A')
                          ? ParentPortalColors.greenSoft
                          : ParentPortalColors.purpleSoft,
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            entry.key,
                            style: const TextStyle(
                              fontSize: 11,
                              color: ParentPortalColors.muted,
                            ),
                          ),
                          Text(
                            entry.value,
                            style: TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.w900,
                              color: entry.value.startsWith('A')
                                  ? ParentPortalColors.green
                                  : ParentPortalColors.purple,
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: () => showFeatureSnack(
                        context,
                        'Report card saved to the local preview.',
                      ),
                      icon: const Icon(Icons.download_rounded),
                      label: const FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text('Download report card'),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _fullReport(context),
                      icon: const Icon(Icons.open_in_new_rounded),
                      label: const FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text('View full report'),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        const PortalCard(
          color: ParentPortalColors.surfaceAlt,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  FeatureIcon(
                    Icons.description_outlined,
                    color: ParentPortalColors.muted,
                  ),
                  SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Second Terminal Examination',
                          style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        Text(
                          'Not published yet',
                          style: TextStyle(color: ParentPortalColors.muted),
                        ),
                      ],
                    ),
                  ),
                  StatusBadge(
                    label: 'Upcoming',
                    color: ParentPortalColors.muted,
                    background: Colors.white,
                  ),
                ],
              ),
              SizedBox(height: 12),
              Text(
                'Results will appear here once they are finalized by the school.',
                style: TextStyle(color: ParentPortalColors.muted),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        PortalCard(
          color: ParentPortalColors.purpleSoft,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  Icon(Icons.chat_rounded, color: ParentPortalColors.purple),
                  SizedBox(width: 8),
                  Text(
                    'Teacher’s note',
                    style: TextStyle(
                      color: ParentPortalColors.purple,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                '${child.name.split(' ').first} is showing great progress and curiosity in class. Keep up the good work at home!',
                style: const TextStyle(height: 1.45),
              ),
              const SizedBox(height: 6),
              const Text(
                '– Class Teacher',
                style: TextStyle(color: ParentPortalColors.muted),
              ),
            ],
          ),
        ),
      ],
    ),
  );

  void _fullReport(BuildContext context) => showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${child.name} • Full report',
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 14),
            for (final entry in grades.entries)
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(entry.key),
                trailing: StatusBadge(
                  label: entry.value,
                  color: ParentPortalColors.purple,
                  background: ParentPortalColors.purpleSoft,
                ),
              ),
            const Divider(),
            const Text(
              'Attendance: 94% • Overall result: Pass',
              style: TextStyle(fontWeight: FontWeight.w800),
            ),
          ],
        ),
      ),
    ),
  );
}

class _ResultMetric extends StatelessWidget {
  const _ResultMetric(this.label, this.value);
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(label, style: const TextStyle(color: ParentPortalColors.muted)),
      const SizedBox(height: 4),
      Text(
        value,
        style: const TextStyle(
          color: ParentPortalColors.green,
          fontSize: 25,
          fontWeight: FontWeight.w900,
        ),
      ),
    ],
  );
}
