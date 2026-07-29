import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/constants/app_routes.dart';
import '../../../../app/design_system/app_radius.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../domain/parent_portal_models.dart';
import '../widgets/parent_portal_widgets.dart';

enum _HomeworkFilter { all, overdue, dueSoon, completed }

enum _HomeworkSort { urgency, newestAssigned, subject, child }

enum _HomeworkDueRange { any, nextThreeDays, nextSevenDays, pastDue }

class ParentPortalHomeworkTab extends StatefulWidget {
  const ParentPortalHomeworkTab({
    super.key,
    required this.data,
    this.initialChildId,
    this.now,
  });

  final ParentPortalData data;
  final String? initialChildId;
  final DateTime? now;

  @override
  State<ParentPortalHomeworkTab> createState() =>
      _ParentPortalHomeworkTabState();
}

class _ParentPortalHomeworkTabState extends State<ParentPortalHomeworkTab>
    with AutomaticKeepAliveClientMixin {
  late String selectedChild = _initialChild();
  _HomeworkFilter filter = _HomeworkFilter.all;
  _HomeworkSort sort = _HomeworkSort.urgency;
  _HomeworkDueRange dueRange = _HomeworkDueRange.any;
  String selectedSubject = 'all';
  String selectedTeacher = 'all';

  @override
  bool get wantKeepAlive => true;

  DateTime get _now => widget.now ?? DateTime.now();

  String _initialChild() {
    final requested = widget.initialChildId;
    if (requested == null ||
        !widget.data.children.any((child) => child.id == requested)) {
      return 'all';
    }
    return requested;
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final now = _now;
    final baseItems = _baseItems(now);
    final items = _visibleItems(baseItems, now);
    final overdueCount = baseItems
        .where((item) => item.isOverdueAt(now))
        .length;
    final dueSoonCount = baseItems
        .where((item) => item.isDueSoonAt(now))
        .length;
    final completedCount = baseItems.where((item) => item.isCompleted).length;
    final hasHomeworkAccess = selectedChild == 'all'
        ? widget.data.children.any((child) => child.canViewAcademics)
        : widget.data.children.any(
            (child) => child.id == selectedChild && child.canViewAcademics,
          );

    if (!hasHomeworkAccess) {
      return ListView(
        key: const PageStorageKey('parent-homework-locked'),
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
        children: [
          _childSelector(),
          const SizedBox(height: AppSpacing.md),
          const PortalCard(
            child: Padding(
              padding: EdgeInsets.symmetric(vertical: AppSpacing.xl),
              child: Column(
                children: [
                  Icon(Icons.lock_outline_rounded),
                  SizedBox(height: AppSpacing.sm),
                  Text(
                    'Homework is not included in your access for this child.',
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        ],
      );
    }

    return CustomScrollView(
      key: const PageStorageKey('parent-homework'),
      slivers: [
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          sliver: SliverList.list(
            children: [
              _childSelector(),
              const SizedBox(height: AppSpacing.md),
              _statusTabs(),
              const SizedBox(height: AppSpacing.md),
              _HomeworkSummary(
                overdueCount: overdueCount,
                dueSoonCount: dueSoonCount,
                completedCount: completedCount,
                selected: filter,
                onSelected: (value) => setState(() => filter = value),
              ),
              const SizedBox(height: AppSpacing.md),
            ],
          ),
        ),
        SliverPersistentHeader(
          pinned: true,
          delegate: _HomeworkFilterHeaderDelegate(
            title: '${_filterTitle(filter)} · ${items.length}',
            activeFilterCount: _activeFilterCount,
            onFilter: _showFilters,
          ),
        ),
        if (items.isEmpty)
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
            sliver: SliverToBoxAdapter(
              child: _HomeworkEmptyState(
                filter: filter,
                childName: _selectedChildName,
              ),
            ),
          )
        else
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
            sliver: SliverList.separated(
              itemCount: items.length,
              itemBuilder: (context, index) => HomeworkCard(
                item: items[index],
                now: now,
                showChildIdentity: selectedChild == 'all',
                onOpen: () => context.push(
                  AppRoutes.parentHomeworkDetail(items[index].id),
                ),
              ),
              separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
            ),
          ),
      ],
    );
  }

  List<ParentPortalHomework> _baseItems(DateTime now) {
    return widget.data.homework.where((item) {
      if (selectedChild != 'all' && item.childId != selectedChild) {
        return false;
      }
      if (selectedSubject != 'all' && item.subject != selectedSubject) {
        return false;
      }
      if (selectedTeacher != 'all' && item.teacher != selectedTeacher) {
        return false;
      }
      final due = item.dueAt;
      return switch (dueRange) {
        _HomeworkDueRange.any => true,
        _HomeworkDueRange.nextThreeDays =>
          due != null &&
              !due.isBefore(now) &&
              !due.isAfter(now.add(const Duration(days: 3))),
        _HomeworkDueRange.nextSevenDays =>
          due != null &&
              !due.isBefore(now) &&
              !due.isAfter(now.add(const Duration(days: 7))),
        _HomeworkDueRange.pastDue => due != null && due.isBefore(now),
      };
    }).toList();
  }

  List<ParentPortalHomework> _visibleItems(
    List<ParentPortalHomework> baseItems,
    DateTime now,
  ) {
    final items = baseItems.where((item) {
      return switch (filter) {
        _HomeworkFilter.all => true,
        _HomeworkFilter.overdue => item.isOverdueAt(now),
        _HomeworkFilter.dueSoon => item.isDueSoonAt(now),
        _HomeworkFilter.completed => item.isCompleted,
      };
    }).toList();
    items.sort((left, right) => _compareHomework(left, right, now));
    return items;
  }

  int _compareHomework(
    ParentPortalHomework left,
    ParentPortalHomework right,
    DateTime now,
  ) {
    return switch (sort) {
      _HomeworkSort.urgency => _compareUrgency(left, right, now),
      _HomeworkSort.newestAssigned => _compareNewest(
        left.assignedAt,
        right.assignedAt,
      ),
      _HomeworkSort.subject => left.subject.toLowerCase().compareTo(
        right.subject.toLowerCase(),
      ),
      _HomeworkSort.child => left.childName.toLowerCase().compareTo(
        right.childName.toLowerCase(),
      ),
    };
  }

  int _compareUrgency(
    ParentPortalHomework left,
    ParentPortalHomework right,
    DateTime now,
  ) {
    final rank = _urgencyRank(left, now).compareTo(_urgencyRank(right, now));
    if (rank != 0) return rank;
    if (left.isCompleted && right.isCompleted) {
      return _compareNewest(
        left.submittedAt ?? left.dueAt,
        right.submittedAt ?? right.dueAt,
      );
    }
    return _compareOldest(left.dueAt, right.dueAt);
  }

  int _urgencyRank(ParentPortalHomework item, DateTime now) {
    if (item.isOverdueAt(now)) return 0;
    if (item.isDueSoonAt(now)) return 1;
    if (item.state.needsAttention) return 2;
    if (item.state == ParentHomeworkState.submitted ||
        item.state == ParentHomeworkState.late) {
      return 3;
    }
    if (item.isCompleted) return 4;
    return 5;
  }

  Widget _childSelector() {
    return PortalCard(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: selectedChild,
          isExpanded: true,
          icon: const Icon(Icons.keyboard_arrow_down_rounded),
          items: [
            const DropdownMenuItem(value: 'all', child: Text('All children')),
            for (final child in widget.data.children)
              DropdownMenuItem(
                value: child.id,
                child: Text('${child.name} • ${child.classSection}'),
              ),
          ],
          onChanged: (value) => setState(() {
            selectedChild = value ?? 'all';
            selectedSubject = 'all';
            selectedTeacher = 'all';
          }),
        ),
      ),
    );
  }

  Widget _statusTabs() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final value in _HomeworkFilter.values) ...[
            ChoiceChip(
              label: Text(_filterTabLabel(value)),
              selected: filter == value,
              showCheckmark: false,
              onSelected: (_) => setState(() => filter = value),
              selectedColor: ParentPortalColors.greenSoft,
              labelStyle: TextStyle(
                color: filter == value
                    ? ParentPortalColors.green
                    : ParentPortalColors.muted,
                fontWeight: FontWeight.w800,
              ),
            ),
            if (value != _HomeworkFilter.values.last)
              const SizedBox(width: AppSpacing.sm),
          ],
        ],
      ),
    );
  }

  Future<void> _showFilters() async {
    final availableItems = widget.data.homework
        .where(
          (item) => selectedChild == 'all' || item.childId == selectedChild,
        )
        .toList();
    final subjects = availableItems.map((item) => item.subject).toSet().toList()
      ..sort();
    final teachers = availableItems.map((item) => item.teacher).toSet().toList()
      ..sort();
    var nextSort = sort;
    var nextRange = dueRange;
    var nextSubject = subjects.contains(selectedSubject)
        ? selectedSubject
        : 'all';
    var nextTeacher = teachers.contains(selectedTeacher)
        ? selectedTeacher
        : 'all';

    final selection = await showModalBottomSheet<_HomeworkFilterSelection>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) => SafeArea(
          child: SingleChildScrollView(
            padding: EdgeInsets.fromLTRB(
              AppSpacing.lg,
              0,
              AppSpacing.lg,
              MediaQuery.viewInsetsOf(context).bottom + AppSpacing.xl,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Sort and filter',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    color: ParentPortalColors.navy,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                DropdownButtonFormField<_HomeworkSort>(
                  initialValue: nextSort,
                  decoration: const InputDecoration(labelText: 'Sort by'),
                  items: [
                    for (final value in _HomeworkSort.values)
                      DropdownMenuItem(
                        value: value,
                        child: Text(_sortLabel(value)),
                      ),
                  ],
                  onChanged: (value) =>
                      setSheetState(() => nextSort = value ?? nextSort),
                ),
                const SizedBox(height: AppSpacing.md),
                DropdownButtonFormField<String>(
                  initialValue: nextSubject,
                  decoration: const InputDecoration(labelText: 'Subject'),
                  items: [
                    const DropdownMenuItem(
                      value: 'all',
                      child: Text('All subjects'),
                    ),
                    for (final subject in subjects)
                      DropdownMenuItem(value: subject, child: Text(subject)),
                  ],
                  onChanged: (value) =>
                      setSheetState(() => nextSubject = value ?? 'all'),
                ),
                const SizedBox(height: AppSpacing.md),
                DropdownButtonFormField<String>(
                  initialValue: nextTeacher,
                  decoration: const InputDecoration(labelText: 'Teacher'),
                  items: [
                    const DropdownMenuItem(
                      value: 'all',
                      child: Text('All teachers'),
                    ),
                    for (final teacher in teachers)
                      DropdownMenuItem(value: teacher, child: Text(teacher)),
                  ],
                  onChanged: (value) =>
                      setSheetState(() => nextTeacher = value ?? 'all'),
                ),
                const SizedBox(height: AppSpacing.lg),
                Text(
                  'Due date range',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: ParentPortalColors.navy,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.sm,
                  children: [
                    for (final value in _HomeworkDueRange.values)
                      ChoiceChip(
                        label: Text(_dueRangeLabel(value)),
                        selected: nextRange == value,
                        showCheckmark: false,
                        onSelected: (_) =>
                            setSheetState(() => nextRange = value),
                      ),
                  ],
                ),
                const SizedBox(height: AppSpacing.xl),
                Row(
                  children: [
                    TextButton(
                      onPressed: () => Navigator.pop(
                        context,
                        const _HomeworkFilterSelection(
                          sort: _HomeworkSort.urgency,
                          range: _HomeworkDueRange.any,
                          subject: 'all',
                          teacher: 'all',
                        ),
                      ),
                      child: const Text('Reset'),
                    ),
                    const Spacer(),
                    FilledButton(
                      onPressed: () => Navigator.pop(
                        context,
                        _HomeworkFilterSelection(
                          sort: nextSort,
                          range: nextRange,
                          subject: nextSubject,
                          teacher: nextTeacher,
                        ),
                      ),
                      child: const Text('Apply filters'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
    if (selection == null || !mounted) return;
    setState(() {
      sort = selection.sort;
      dueRange = selection.range;
      selectedSubject = selection.subject;
      selectedTeacher = selection.teacher;
    });
  }

  int get _activeFilterCount {
    var count = 0;
    if (sort != _HomeworkSort.urgency) count++;
    if (dueRange != _HomeworkDueRange.any) count++;
    if (selectedSubject != 'all') count++;
    if (selectedTeacher != 'all') count++;
    return count;
  }

  String? get _selectedChildName {
    if (selectedChild == 'all') return null;
    for (final child in widget.data.children) {
      if (child.id == selectedChild) return child.name;
    }
    return null;
  }
}

class _HomeworkSummary extends StatelessWidget {
  const _HomeworkSummary({
    required this.overdueCount,
    required this.dueSoonCount,
    required this.completedCount,
    required this.selected,
    required this.onSelected,
  });

  final int overdueCount;
  final int dueSoonCount;
  final int completedCount;
  final _HomeworkFilter selected;
  final ValueChanged<_HomeworkFilter> onSelected;

  @override
  Widget build(BuildContext context) {
    return PortalCard(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.md,
      ),
      child: Row(
        children: [
          Expanded(
            child: _SummaryAction(
              value: overdueCount,
              label: 'Overdue',
              icon: Icons.error_outline_rounded,
              color: ParentPortalColors.red,
              selected: selected == _HomeworkFilter.overdue,
              onTap: () => onSelected(_HomeworkFilter.overdue),
            ),
          ),
          Expanded(
            child: _SummaryAction(
              value: dueSoonCount,
              label: 'Due soon',
              icon: Icons.schedule_rounded,
              color: ParentPortalColors.orange,
              selected: selected == _HomeworkFilter.dueSoon,
              onTap: () => onSelected(_HomeworkFilter.dueSoon),
            ),
          ),
          Expanded(
            child: _SummaryAction(
              value: completedCount,
              label: 'Completed',
              icon: Icons.task_alt_rounded,
              color: ParentPortalColors.green,
              selected: selected == _HomeworkFilter.completed,
              onTap: () => onSelected(_HomeworkFilter.completed),
            ),
          ),
        ],
      ),
    );
  }
}

class _SummaryAction extends StatelessWidget {
  const _SummaryAction({
    required this.value,
    required this.label,
    required this.icon,
    required this.color,
    required this.selected,
    required this.onTap,
  });

  final int value;
  final String label;
  final IconData icon;
  final Color color;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: '$value $label assignments',
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.borderRadiusLG,
        child: Container(
          constraints: const BoxConstraints(minHeight: 64),
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.xs,
            vertical: AppSpacing.sm,
          ),
          decoration: BoxDecoration(
            color: selected ? color.withValues(alpha: .09) : null,
            borderRadius: AppRadius.borderRadiusLG,
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: color, size: 18),
              const SizedBox(height: AppSpacing.xs),
              Text(
                '$value $label',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: selected ? color : ParentPortalColors.navy,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HomeworkFilterHeaderDelegate extends SliverPersistentHeaderDelegate {
  const _HomeworkFilterHeaderDelegate({
    required this.title,
    required this.activeFilterCount,
    required this.onFilter,
  });

  final String title;
  final int activeFilterCount;
  final VoidCallback onFilter;

  @override
  double get minExtent => 48;

  @override
  double get maxExtent => 48;

  @override
  Widget build(
    BuildContext context,
    double shrinkOffset,
    bool overlapsContent,
  ) {
    return ColoredBox(
      color: ParentPortalColors.page,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
        child: Row(
          children: [
            Expanded(
              child: Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: ParentPortalColors.navy,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
            TextButton.icon(
              onPressed: onFilter,
              icon: Badge.count(
                count: activeFilterCount,
                isLabelVisible: activeFilterCount > 0,
                child: const Icon(Icons.tune_rounded),
              ),
              label: const Text('Filter'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  bool shouldRebuild(covariant _HomeworkFilterHeaderDelegate oldDelegate) {
    return oldDelegate.title != title ||
        oldDelegate.activeFilterCount != activeFilterCount ||
        oldDelegate.onFilter != onFilter;
  }
}

class _HomeworkEmptyState extends StatelessWidget {
  const _HomeworkEmptyState({required this.filter, this.childName});

  final _HomeworkFilter filter;
  final String? childName;

  @override
  Widget build(BuildContext context) {
    final owner = childName ?? 'Your children';
    final (title, message) = switch (filter) {
      _HomeworkFilter.overdue => (
        'Nothing overdue',
        '$owner ${childName == null ? 'have' : 'has'} no overdue homework.',
      ),
      _HomeworkFilter.dueSoon => (
        'Nothing due soon',
        '$owner ${childName == null ? 'have' : 'has'} no homework due in the next three days.',
      ),
      _HomeworkFilter.completed => (
        'No completed homework',
        'Completed assignments will appear here after the school records them.',
      ),
      _HomeworkFilter.all => (
        'No homework found',
        'No assignments match the selected child and filters.',
      ),
    };
    return PortalCard(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.xl),
        child: Column(
          children: [
            const Icon(
              Icons.assignment_turned_in_outlined,
              color: ParentPortalColors.muted,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              title,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                color: ParentPortalColors.navy,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              message,
              textAlign: TextAlign.center,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: ParentPortalColors.muted),
            ),
          ],
        ),
      ),
    );
  }
}

class _HomeworkFilterSelection {
  const _HomeworkFilterSelection({
    required this.sort,
    required this.range,
    required this.subject,
    required this.teacher,
  });

  final _HomeworkSort sort;
  final _HomeworkDueRange range;
  final String subject;
  final String teacher;
}

int _compareNewest(DateTime? left, DateTime? right) {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  return right.compareTo(left);
}

int _compareOldest(DateTime? left, DateTime? right) {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  return left.compareTo(right);
}

String _filterTabLabel(_HomeworkFilter value) => switch (value) {
  _HomeworkFilter.all => 'All',
  _HomeworkFilter.overdue => 'Overdue',
  _HomeworkFilter.dueSoon => 'Due soon',
  _HomeworkFilter.completed => 'Completed',
};

String _filterTitle(_HomeworkFilter value) => switch (value) {
  _HomeworkFilter.all => 'All assignments',
  _HomeworkFilter.overdue => 'Overdue assignments',
  _HomeworkFilter.dueSoon => 'Due soon',
  _HomeworkFilter.completed => 'Completed assignments',
};

String _sortLabel(_HomeworkSort value) => switch (value) {
  _HomeworkSort.urgency => 'Urgency',
  _HomeworkSort.newestAssigned => 'Newest assigned',
  _HomeworkSort.subject => 'Subject',
  _HomeworkSort.child => 'Child',
};

String _dueRangeLabel(_HomeworkDueRange value) => switch (value) {
  _HomeworkDueRange.any => 'Any time',
  _HomeworkDueRange.nextThreeDays => 'Next 3 days',
  _HomeworkDueRange.nextSevenDays => 'Next 7 days',
  _HomeworkDueRange.pastDue => 'Past due',
};
