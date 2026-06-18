import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/constants/app_routes.dart';
import '../../application/parent_portal_providers.dart';
import '../../domain/parent_portal_models.dart';
import '../widgets/parent_portal_widgets.dart';

class ParentPortalChildDetailScreen extends ConsumerWidget {
  const ParentPortalChildDetailScreen({super.key, required this.childId});

  final String childId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(parentPortalDataProvider);
    return Scaffold(
      backgroundColor: ParentPortalColors.page,
      appBar: AppBar(title: const Text('Child details')),
      body: data.when(
        loading: () => const PortalLoadingState(),
        error: (_, _) => PortalErrorState(
          onRetry: () => ref.invalidate(parentPortalDataProvider),
        ),
        data: (portal) {
          final child = portal.children.firstWhere(
            (item) => item.id == childId,
            orElse: () => portal.children.first,
          );
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
            children: [
              PortalCard(
                color: ParentPortalColors.greenSoft,
                child: Row(
                  children: [
                    AvatarInitials(name: child.name, radius: 32),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            child.name,
                            style: Theme.of(context).textTheme.titleLarge
                                ?.copyWith(
                                  color: ParentPortalColors.navy,
                                  fontWeight: FontWeight.w900,
                                ),
                          ),
                          Text('${child.classSection} • ${child.teacher}'),
                          const SizedBox(height: 7),
                          const StatusBadge(label: 'Present today'),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 22),
              const ParentSectionHeader(title: 'Overview'),
              const SizedBox(height: 10),
              _detail(
                context,
                Icons.person_outline_rounded,
                'Profile',
                '${child.classSection} • Greenfield Academy',
                null,
              ),
              _detail(
                context,
                Icons.fact_check_outlined,
                'Attendance',
                child.attendanceTime,
                AppRoutes.parentAttendance,
              ),
              _detail(
                context,
                Icons.menu_book_outlined,
                'Homework',
                child.homework,
                AppRoutes.parentHomework,
              ),
              _detail(
                context,
                Icons.receipt_long_outlined,
                'Fees',
                'NPR 4,500 due in 3 days',
                AppRoutes.parentFees,
              ),
              _detail(
                context,
                Icons.directions_bus_outlined,
                'Transport',
                child.transport,
                AppRoutes.parentTransport,
              ),
              _detail(
                context,
                Icons.notifications_none_rounded,
                'Updates',
                child.updates,
                AppRoutes.parentUpdates,
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _detail(
    BuildContext context,
    IconData icon,
    String title,
    String subtitle,
    String? route,
  ) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: PortalCard(
        onTap: route == null ? null : () => context.push(route),
        child: Row(
          children: [
            Icon(icon, color: ParentPortalColors.green),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(fontWeight: FontWeight.w900),
                  ),
                  Text(
                    subtitle,
                    style: const TextStyle(color: ParentPortalColors.muted),
                  ),
                ],
              ),
            ),
            if (route != null) const ListChevron(),
          ],
        ),
      ),
    );
  }
}

class ParentPortalHomeworkDetailScreen extends ConsumerWidget {
  const ParentPortalHomeworkDetailScreen({super.key, required this.homeworkId});

  final String homeworkId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(parentPortalDataProvider);
    return Scaffold(
      backgroundColor: ParentPortalColors.page,
      appBar: AppBar(title: const Text('Homework details')),
      body: data.when(
        loading: () => const PortalLoadingState(),
        error: (_, _) => PortalErrorState(
          onRetry: () => ref.invalidate(parentPortalDataProvider),
        ),
        data: (portal) {
          final item = portal.homework.firstWhere(
            (entry) => entry.id == homeworkId,
            orElse: () => portal.homework.first,
          );
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
            children: [
              HomeworkCard(item: item, onOpen: () {}),
              const SizedBox(height: 18),
              const ParentSectionHeader(title: 'Assignment'),
              const SizedBox(height: 10),
              PortalCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _instructions(item),
                      style: Theme.of(
                        context,
                      ).textTheme.bodyLarge?.copyWith(height: 1.5),
                    ),
                    const Divider(height: 28),
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(
                        Icons.attach_file_rounded,
                        color: ParentPortalColors.purple,
                      ),
                      title: Text(
                        '${item.attachmentCount} worksheet attachment${item.attachmentCount == 1 ? '' : 's'}',
                      ),
                      subtitle: const Text(
                        'Protected school file • tap to preview',
                      ),
                      onTap: () => ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Attachment preview opened.'),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: item.isCompleted
                      ? null
                      : () => ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text(
                              'Submission status saved locally for this prototype.',
                            ),
                          ),
                        ),
                  icon: Icon(
                    item.isCompleted
                        ? Icons.task_alt_rounded
                        : Icons.check_rounded,
                  ),
                  label: Text(item.isCompleted ? 'Completed' : 'Mark as done'),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

String _instructions(ParentPortalHomework item) {
  return switch (item.id) {
    'phonics' =>
      'Read the attached phonics worksheet aloud with a guardian. Practice each sound twice and bring the worksheet to class.',
    'fruit' =>
      'Color each fruit neatly, name it aloud, and bring the completed worksheet to class.',
    _ =>
      'Complete the plant life worksheet and review the parts of a plant before the next class.',
  };
}
