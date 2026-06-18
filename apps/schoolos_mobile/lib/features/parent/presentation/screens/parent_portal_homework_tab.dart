import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/constants/app_routes.dart';
import '../../domain/parent_portal_models.dart';
import '../widgets/parent_portal_widgets.dart';

enum _HomeworkFilter { all, dueSoon, completed }

class ParentPortalHomeworkTab extends StatefulWidget {
  const ParentPortalHomeworkTab({
    super.key,
    required this.data,
    this.initialChildId,
  });

  final ParentPortalData data;
  final String? initialChildId;

  @override
  State<ParentPortalHomeworkTab> createState() =>
      _ParentPortalHomeworkTabState();
}

class _ParentPortalHomeworkTabState extends State<ParentPortalHomeworkTab>
    with AutomaticKeepAliveClientMixin {
  late String selectedChild = widget.initialChildId ?? 'all';
  _HomeworkFilter filter = _HomeworkFilter.all;

  @override
  bool get wantKeepAlive => true;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final items = widget.data.homework.where((item) {
      final childMatch =
          selectedChild == 'all' ||
          item.childName.toLowerCase().startsWith(selectedChild);
      final filterMatch = switch (filter) {
        _HomeworkFilter.all => true,
        _HomeworkFilter.dueSoon => item.isDueSoon,
        _HomeworkFilter.completed => item.isCompleted,
      };
      return childMatch && filterMatch;
    }).toList();

    return ListView(
      key: const PageStorageKey('parent-homework'),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
      children: [
        PortalCard(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: selectedChild,
              isExpanded: true,
              icon: const Icon(Icons.keyboard_arrow_down_rounded),
              items: const [
                DropdownMenuItem(value: 'all', child: Text('All children')),
                DropdownMenuItem(
                  value: 'aarav',
                  child: Text('Aarav Shrestha • Nursery-A'),
                ),
                DropdownMenuItem(
                  value: 'aarohi',
                  child: Text('Aarohi Shrestha • LKG-A'),
                ),
              ],
              onChanged: (value) =>
                  setState(() => selectedChild = value ?? 'all'),
            ),
          ),
        ),
        const SizedBox(height: 14),
        SegmentedButton<_HomeworkFilter>(
          segments: const [
            ButtonSegment(value: _HomeworkFilter.all, label: Text('All')),
            ButtonSegment(
              value: _HomeworkFilter.dueSoon,
              label: Text('Due soon'),
            ),
            ButtonSegment(
              value: _HomeworkFilter.completed,
              label: Text('Completed'),
            ),
          ],
          selected: {filter},
          showSelectedIcon: false,
          style: ButtonStyle(
            visualDensity: VisualDensity.compact,
            backgroundColor: WidgetStateProperty.resolveWith(
              (states) => states.contains(WidgetState.selected)
                  ? ParentPortalColors.greenSoft
                  : Colors.white,
            ),
            foregroundColor: WidgetStateProperty.resolveWith(
              (states) => states.contains(WidgetState.selected)
                  ? ParentPortalColors.green
                  : ParentPortalColors.muted,
            ),
          ),
          onSelectionChanged: (value) => setState(() => filter = value.first),
        ),
        const SizedBox(height: 18),
        PortalCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Homework summary',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: ParentPortalColors.navy,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 16),
              const Row(
                children: [
                  Expanded(
                    child: SummaryMetric(
                      icon: Icons.schedule_rounded,
                      value: '1',
                      label: 'due tomorrow',
                      color: ParentPortalColors.orange,
                    ),
                  ),
                  SizedBox(width: 8),
                  Expanded(
                    child: SummaryMetric(
                      icon: Icons.pending_actions_rounded,
                      value: '1',
                      label: 'pending',
                      color: ParentPortalColors.purple,
                    ),
                  ),
                  SizedBox(width: 8),
                  Expanded(
                    child: SummaryMetric(
                      icon: Icons.task_alt_rounded,
                      value: '1',
                      label: 'completed',
                      color: ParentPortalColors.green,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        ParentSectionHeader(title: '${items.length} assignments'),
        const SizedBox(height: 10),
        if (items.isEmpty)
          const PortalCard(
            child: Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(child: Text('No homework matches these filters.')),
            ),
          )
        else
          for (final item in items) ...[
            HomeworkCard(
              item: item,
              onOpen: () =>
                  context.push(AppRoutes.parentHomeworkDetail(item.id)),
            ),
            const SizedBox(height: 14),
          ],
      ],
    );
  }
}
