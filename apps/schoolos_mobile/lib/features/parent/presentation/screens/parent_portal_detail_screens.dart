import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/constants/app_routes.dart';
import '../../application/parent_providers.dart';
import '../../application/parent_portal_providers.dart';
import '../../domain/parent_models.dart';
import '../widgets/parent_detail_widgets.dart';
import '../widgets/parent_portal_widgets.dart';

class ParentPortalChildDetailScreen extends ConsumerWidget {
  const ParentPortalChildDetailScreen({super.key, required this.childId});
  final String childId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final portal = ref.watch(parentPortalDataProvider);
    return ParentDetailScaffold(
      title: 'Child profile',
      selectedIndex: 1,
      body: portal.when(
        loading: () => const PortalLoadingState(),
        error: (_, _) => PortalErrorState(
          onRetry: () => ref.invalidate(parentPortalDataProvider),
        ),
        data: (data) {
          if (data.children.isEmpty) {
            return const _DetailUnavailable(
              icon: Icons.child_care_rounded,
              title: 'No linked children',
              message:
                  'Ask the school office to link this parent account to a child record.',
            );
          }
          final matches = data.children.where((item) => item.id == childId);
          final portalChild = matches.isEmpty
              ? data.children.first
              : matches.first;
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
            children: [
              PortalCard(
                child: Row(
                  children: [
                    AvatarInitials(name: portalChild.name, radius: 34),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            portalChild.name,
                            style: Theme.of(context).textTheme.titleLarge
                                ?.copyWith(
                                  fontWeight: FontWeight.w900,
                                  color: ParentPortalColors.navy,
                                ),
                          ),
                          Text(
                            portalChild.classSection,
                            style: const TextStyle(
                              color: ParentPortalColors.muted,
                            ),
                          ),
                          const SizedBox(height: 8),
                          StatusBadge(label: portalChild.attendance),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              const ParentSectionHeader(title: 'Today overview'),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: SummaryMetric(
                      icon: Icons.check_rounded,
                      label: 'Attendance',
                      value: portalChild.attendance,
                      color: ParentPortalColors.green,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: SummaryMetric(
                      icon: Icons.directions_bus_rounded,
                      label: 'Transport',
                      value: portalChild.transport,
                      color: ParentPortalColors.orange,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: SummaryMetric(
                      icon: Icons.assignment_outlined,
                      label: 'Homework',
                      value: portalChild.homework,
                      color: ParentPortalColors.purple,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: SummaryMetric(
                      icon: Icons.credit_card_rounded,
                      label: 'Fees due',
                      value: 'NPR ${portalChild.feesDue.toStringAsFixed(0)}',
                      color: portalChild.feesDue > 0
                          ? ParentPortalColors.orange
                          : ParentPortalColors.green,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              const ParentSectionHeader(title: 'Quick actions'),
              const SizedBox(height: 10),
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                childAspectRatio: 1.65,
                children: [
                  ActionTile(
                    icon: Icons.how_to_reg_rounded,
                    label: 'Attendance',
                    color: ParentPortalColors.green,
                    onTap: () => context.push(
                      AppRoutes.parentChildAttendanceDetail(portalChild.id),
                    ),
                  ),
                  ActionTile(
                    icon: Icons.assignment_rounded,
                    label: 'Homework',
                    color: ParentPortalColors.purple,
                    onTap: () => context.go(
                      '${AppRoutes.parentHomework}?child=${portalChild.id}',
                    ),
                  ),
                  ActionTile(
                    icon: Icons.forum_rounded,
                    label: 'Message teacher',
                    color: ParentPortalColors.purple,
                    onTap: () => context.push(AppRoutes.parentChat),
                  ),
                  ActionTile(
                    icon: Icons.credit_card_rounded,
                    label: 'Fees',
                    color: ParentPortalColors.green,
                    onTap: () => context.push(AppRoutes.parentFees),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              const ParentSectionHeader(title: 'At school'),
              const SizedBox(height: 10),
              PortalCard(
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    _infoRow(
                      Icons.person_rounded,
                      'Class teacher',
                      portalChild.teacher,
                      ParentPortalColors.purple,
                    ),
                    const Divider(height: 1),
                    _infoRow(
                      Icons.door_front_door_rounded,
                      'Classroom',
                      portalChild.classSection,
                      ParentPortalColors.green,
                    ),
                    const Divider(height: 1),
                    _infoRow(
                      Icons.event_rounded,
                      'Latest update',
                      portalChild.updates,
                      ParentPortalColors.blue,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              ParentSectionHeader(
                title: 'Today timeline',
                trailing: TextButton(
                  onPressed: () => _timelineSheet(context),
                  child: const Text('View all'),
                ),
              ),
              const SizedBox(height: 8),
              PortalCard(
                child: Column(
                  children: [
                    _timeline(
                      Icons.check_rounded,
                      portalChild.attendance,
                      portalChild.attendanceTime,
                      ParentPortalColors.green,
                    ),
                    _timeline(
                      Icons.directions_bus_rounded,
                      portalChild.transport,
                      portalChild.transportDetail ?? 'Open transport details',
                      ParentPortalColors.orange,
                    ),
                    _timeline(
                      Icons.notifications_rounded,
                      'Last updated',
                      data.lastUpdated,
                      ParentPortalColors.purple,
                      last: true,
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _infoRow(IconData icon, String title, String subtitle, Color color) =>
      ListTile(
        leading: FeatureIcon(icon, color: color, size: 42),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
        subtitle: Text(subtitle),
        trailing: const ListChevron(),
      );

  Widget _timeline(
    IconData icon,
    String title,
    String subtitle,
    Color color, {
    bool last = false,
  }) => Padding(
    padding: EdgeInsets.only(bottom: last ? 0 : 14),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        FeatureIcon(icon, color: color, size: 34),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
              Text(
                subtitle,
                style: const TextStyle(color: ParentPortalColors.muted),
              ),
            ],
          ),
        ),
      ],
    ),
  );

  Future<void> _timelineSheet(BuildContext context) =>
      showModalBottomSheet<void>(
        context: context,
        showDragHandle: true,
        builder: (_) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Today timeline',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 16),
                const ListTile(
                  leading: Icon(
                    Icons.check_circle,
                    color: ParentPortalColors.green,
                  ),
                  title: Text('Attendance summary'),
                  subtitle: Text(
                    'Open the Attendance screen for daily records.',
                  ),
                ),
                const ListTile(
                  leading: Icon(
                    Icons.directions_bus,
                    color: ParentPortalColors.orange,
                  ),
                  title: Text('Transport summary'),
                  subtitle: Text('Open the Transport screen for trip records.'),
                ),
              ],
            ),
          ),
        ),
      );
}

class ParentPortalHomeworkDetailScreen extends ConsumerStatefulWidget {
  const ParentPortalHomeworkDetailScreen({super.key, required this.homeworkId});
  final String homeworkId;
  @override
  ConsumerState<ParentPortalHomeworkDetailScreen> createState() =>
      _ParentPortalHomeworkDetailScreenState();
}

class _ParentPortalHomeworkDetailScreenState
    extends ConsumerState<ParentPortalHomeworkDetailScreen> {
  @override
  Widget build(BuildContext context) {
    final data = ref.watch(parentPortalDataProvider);
    return ParentDetailScaffold(
      title: 'Homework detail',
      selectedIndex: 2,
      body: data.when(
        loading: () => const PortalLoadingState(),
        error: (_, _) => PortalErrorState(
          onRetry: () => ref.invalidate(parentPortalDataProvider),
        ),
        data: (portal) {
          if (portal.homework.isEmpty) {
            return const _DetailUnavailable(
              icon: Icons.assignment_outlined,
              title: 'No homework available',
              message:
                  'Homework details will appear here after the school publishes assignments for linked children.',
            );
          }
          final matches = portal.homework.where(
            (entry) => entry.id == widget.homeworkId,
          );
          final item = matches.isEmpty ? portal.homework.first : matches.first;
          final attachments = ref.watch(
            parentHomeworkAttachmentsProvider((
              childId: item.childId,
              homeworkId: item.id,
            )),
          );
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
            children: [
              PortalCard(
                child: Row(
                  children: [
                    AvatarInitials(name: item.childName, radius: 24),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        '${item.childName} • ${item.classSection}',
                        style: const TextStyle(fontWeight: FontWeight.w900),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              PortalCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const FeatureIcon(Icons.menu_book_rounded),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Subject',
                                style: TextStyle(
                                  color: ParentPortalColors.muted,
                                ),
                              ),
                              Text(
                                item.subject,
                                style: const TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.w900,
                                  color: ParentPortalColors.navy,
                                ),
                              ),
                            ],
                          ),
                        ),
                        StatusBadge(
                          label: item.dueLabel,
                          color: ParentPortalColors.orange,
                          background: ParentPortalColors.orangeSoft,
                          icon: Icons.schedule_rounded,
                        ),
                      ],
                    ),
                    const Divider(height: 28),
                    Text(
                      'Title',
                      style: const TextStyle(color: ParentPortalColors.muted),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      item.title,
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                        color: ParentPortalColors.navy,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      item.status,
                      style: const TextStyle(fontSize: 16, height: 1.5),
                    ),
                    const Divider(height: 28),
                    _homeworkInfo(
                      Icons.event_rounded,
                      'Due',
                      item.dueLabel,
                      ParentPortalColors.green,
                    ),
                    const SizedBox(height: 14),
                    _homeworkInfo(
                      Icons.person_rounded,
                      'Assigned by',
                      item.teacher,
                      ParentPortalColors.green,
                    ),
                    const SizedBox(height: 14),
                    Text(
                      'Attachment',
                      style: const TextStyle(color: ParentPortalColors.muted),
                    ),
                    const SizedBox(height: 8),
                    _HomeworkAttachmentList(
                      childId: item.childId,
                      homeworkId: item.id,
                      count: item.attachmentCount,
                      attachments: attachments,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              PortalCard(
                color: item.isCompleted
                    ? ParentPortalColors.greenSoft
                    : ParentPortalColors.orangeSoft,
                child: Row(
                  children: [
                    const FeatureIcon(
                      Icons.hourglass_bottom_rounded,
                      color: ParentPortalColors.orange,
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Status',
                            style: TextStyle(color: ParentPortalColors.muted),
                          ),
                          Text(
                            item.status,
                            style: const TextStyle(
                              color: ParentPortalColors.orange,
                              fontSize: 18,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const Text('Status is synced from school records.'),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: item.attachmentCount == 0
                          ? null
                          : () => _attachmentListSheet(
                              context,
                              item.childId,
                              item.id,
                              attachments,
                            ),
                      icon: const Icon(Icons.description_rounded),
                      label: const Text('Open attachments'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => context.push(AppRoutes.parentChat),
                      icon: const Icon(Icons.forum_rounded),
                      label: const Text('Message teacher'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: FilledButton.tonalIcon(
                  onPressed: () => showUnavailableWorkflowSnack(
                    context,
                    'Homework reminders need a confirmed mobile reminder workflow.',
                  ),
                  icon: const Icon(Icons.notifications_none_rounded),
                  label: const Text('Add reminder'),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _homeworkInfo(
    IconData icon,
    String label,
    String value,
    Color color,
  ) => Row(
    children: [
      FeatureIcon(icon, color: color, size: 42),
      const SizedBox(width: 12),
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: ParentPortalColors.muted)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w900)),
        ],
      ),
    ],
  );

  Future<void> _attachmentListSheet(
    BuildContext context,
    String childId,
    String homeworkId,
    AsyncValue<List<ParentHomeworkAttachment>> attachments,
  ) => showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (_) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: attachments.when(
          loading: () => const Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(),
              SizedBox(height: 12),
              Text('Loading attachments...'),
            ],
          ),
          error: (_, _) => const Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              FeatureIcon(
                Icons.file_download_off_rounded,
                color: ParentPortalColors.orange,
                size: 64,
              ),
              SizedBox(height: 14),
              Text(
                'Attachments could not be loaded',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
              ),
            ],
          ),
          data: (items) => _HomeworkAttachmentSheet(
            childId: childId,
            homeworkId: homeworkId,
            attachments: items,
          ),
        ),
      ),
    ),
  );
}

class _HomeworkAttachmentList extends ConsumerWidget {
  const _HomeworkAttachmentList({
    required this.childId,
    required this.homeworkId,
    required this.count,
    required this.attachments,
  });

  final String childId;
  final String homeworkId;
  final int count;
  final AsyncValue<List<ParentHomeworkAttachment>> attachments;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return attachments.when(
      loading: () => PortalCard(
        padding: const EdgeInsets.all(12),
        child: Text(
          count == 0 ? 'No attachments' : 'Loading $count attachment(s)...',
          style: const TextStyle(color: ParentPortalColors.muted),
        ),
      ),
      error: (_, _) => PortalCard(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            const FeatureIcon(
              Icons.file_download_off_rounded,
              color: ParentPortalColors.orange,
              size: 40,
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Text(
                'Attachments could not be loaded.',
                style: TextStyle(color: ParentPortalColors.muted),
              ),
            ),
            IconButton(
              onPressed: () => ref.invalidate(
                parentHomeworkAttachmentsProvider((
                  childId: childId,
                  homeworkId: homeworkId,
                )),
              ),
              icon: const Icon(Icons.refresh_rounded),
            ),
          ],
        ),
      ),
      data: (items) {
        if (items.isEmpty) {
          return const PortalCard(
            padding: EdgeInsets.all(12),
            child: Text('No attachments for this homework.'),
          );
        }

        return PortalCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              for (var index = 0; index < items.length; index++) ...[
                ListTile(
                  leading: const FeatureIcon(
                    Icons.description_rounded,
                    color: ParentPortalColors.red,
                    size: 40,
                  ),
                  title: Text(
                    items[index].fileName,
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                  subtitle: Text(_fileSize(items[index].sizeBytes)),
                  trailing: const Icon(Icons.download_rounded),
                  onTap: () => _downloadAttachment(
                    context,
                    ref,
                    childId,
                    homeworkId,
                    items[index],
                  ),
                ),
                if (index != items.length - 1) const Divider(height: 1),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _HomeworkAttachmentSheet extends ConsumerWidget {
  const _HomeworkAttachmentSheet({
    required this.childId,
    required this.homeworkId,
    required this.attachments,
  });

  final String childId;
  final String homeworkId;
  final List<ParentHomeworkAttachment> attachments;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (attachments.isEmpty) {
      return const Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          FeatureIcon(Icons.description_rounded, size: 64),
          SizedBox(height: 14),
          Text(
            'No attachments',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
          ),
        ],
      );
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Text(
          'Homework attachments',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 12),
        for (final attachment in attachments)
          ListTile(
            leading: const Icon(
              Icons.description_rounded,
              color: ParentPortalColors.red,
            ),
            title: Text(attachment.fileName),
            subtitle: Text(_fileSize(attachment.sizeBytes)),
            trailing: const Icon(Icons.download_rounded),
            onTap: () => _downloadAttachment(
              context,
              ref,
              childId,
              homeworkId,
              attachment,
            ),
          ),
      ],
    );
  }
}

Future<void> _downloadAttachment(
  BuildContext context,
  WidgetRef ref,
  String childId,
  String homeworkId,
  ParentHomeworkAttachment attachment,
) async {
  try {
    final file = await ref
        .read(parentRepositoryProvider)
        .downloadHomeworkAttachment(
          childId: childId,
          homeworkId: homeworkId,
          attachment: attachment,
        );
    if (!context.mounted) return;
    Navigator.maybePop(context);
    showFeatureSnack(context, 'Attachment downloaded: ${file.fileName}');
  } catch (_) {
    if (!context.mounted) return;
    showFeatureSnack(context, 'Attachment is not available right now.');
  }
}

String _fileSize(int bytes) {
  if (bytes <= 0) return 'File size unavailable';
  if (bytes < 1024 * 1024) return '${(bytes / 1024).ceil()} KB';
  return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
}

class _DetailUnavailable extends StatelessWidget {
  const _DetailUnavailable({
    required this.icon,
    required this.title,
    required this.message,
  });

  final IconData icon;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
    children: [
      PortalCard(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            FeatureIcon(icon, color: ParentPortalColors.orange),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    message,
                    style: const TextStyle(color: ParentPortalColors.muted),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    ],
  );
}
