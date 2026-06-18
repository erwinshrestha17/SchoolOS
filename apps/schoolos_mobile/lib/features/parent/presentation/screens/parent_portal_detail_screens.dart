import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/constants/app_routes.dart';
import '../../application/parent_portal_providers.dart';
import '../../domain/parent_feature_models.dart';
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
          final portalChild = data.children.firstWhere(
            (item) => item.id == childId,
            orElse: () => data.children.first,
          );
          final child = parentChildren.firstWhere(
            (item) => item.id == portalChild.id,
            orElse: () => parentChildren.first,
          );
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
            children: [
              PortalCard(
                child: Row(
                  children: [
                    AvatarInitials(name: child.name, radius: 34),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            child.name,
                            style: Theme.of(context).textTheme.titleLarge
                                ?.copyWith(
                                  fontWeight: FontWeight.w900,
                                  color: ParentPortalColors.navy,
                                ),
                          ),
                          Text(
                            '${child.classSection} • Roll ${child.roll}',
                            style: const TextStyle(
                              color: ParentPortalColors.muted,
                            ),
                          ),
                          const SizedBox(height: 8),
                          const StatusBadge(label: 'In school today'),
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
                      label: 'Present',
                      value: child.id == 'aarav' ? '8:42 AM' : '8:38 AM',
                      color: ParentPortalColors.green,
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: SummaryMetric(
                      icon: Icons.directions_bus_rounded,
                      label: 'Pickup',
                      value: '3:15 PM',
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
                      label: child.id == 'aarav' ? 'No homework' : '1 homework',
                      value: child.id == 'aarav' ? 'due' : 'due tomorrow',
                      color: ParentPortalColors.purple,
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: SummaryMetric(
                      icon: Icons.credit_card_rounded,
                      label: 'No fee',
                      value: 'due',
                      color: ParentPortalColors.green,
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
                      AppRoutes.parentChildAttendanceDetail(child.id),
                    ),
                  ),
                  ActionTile(
                    icon: Icons.assignment_rounded,
                    label: 'Homework',
                    color: ParentPortalColors.purple,
                    onTap: () => context.go(
                      '${AppRoutes.parentHomework}?child=${child.id}',
                    ),
                  ),
                  ActionTile(
                    icon: Icons.forum_rounded,
                    label: 'Message teacher',
                    color: ParentPortalColors.purple,
                    onTap: () =>
                        showMessageComposer(context, childName: child.name),
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
                      'Ms. Sita Sharma',
                      ParentPortalColors.purple,
                    ),
                    const Divider(height: 1),
                    _infoRow(
                      Icons.door_front_door_rounded,
                      'Classroom',
                      child.classSection,
                      ParentPortalColors.green,
                    ),
                    const Divider(height: 1),
                    _infoRow(
                      Icons.event_rounded,
                      'Upcoming event',
                      'Parent–Teacher Meeting\nFriday 10:00 AM',
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
                      'Present at 8:42 AM',
                      'Checked in by class teacher',
                      ParentPortalColors.green,
                    ),
                    _timeline(
                      Icons.directions_bus_rounded,
                      'School bus pickup',
                      'Expected at 3:15 PM',
                      ParentPortalColors.orange,
                    ),
                    _timeline(
                      Icons.notifications_rounded,
                      'Last updated',
                      'Today, 8:42 AM',
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
        builder: (_) => const SafeArea(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Today timeline',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
                ),
                SizedBox(height: 16),
                ListTile(
                  leading: Icon(
                    Icons.check_circle,
                    color: ParentPortalColors.green,
                  ),
                  title: Text('8:42 AM • Present'),
                  subtitle: Text('Checked in by class teacher'),
                ),
                ListTile(
                  leading: Icon(
                    Icons.directions_bus,
                    color: ParentPortalColors.orange,
                  ),
                  title: Text('3:15 PM • Pickup expected'),
                  subtitle: Text('Butwal East Route • Gate 2'),
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
  DateTime? reminder;

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
          final item = portal.homework.firstWhere(
            (entry) => entry.id == widget.homeworkId,
            orElse: () => portal.homework.first,
          );
          final child = parentChildren.firstWhere(
            (entry) => entry.name == item.childName,
            orElse: () => parentChildren.last,
          );
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
            children: [
              ParentChildSelector(child: child, onChanged: (_) {}),
              const SizedBox(height: 16),
              PortalCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const FeatureIcon(Icons.menu_book_rounded),
                        const SizedBox(width: 12),
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Subject',
                                style: TextStyle(
                                  color: ParentPortalColors.muted,
                                ),
                              ),
                              Text(
                                'English',
                                style: TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.w900,
                                  color: ParentPortalColors.navy,
                                ),
                              ),
                            ],
                          ),
                        ),
                        StatusBadge(
                          label: 'Due in 1 day',
                          color: ParentPortalColors.orange,
                          background: ParentPortalColors.orangeSoft,
                          icon: Icons.schedule_rounded,
                        ),
                      ],
                    ),
                    const Divider(height: 28),
                    const Text(
                      'Title',
                      style: TextStyle(color: ParentPortalColors.muted),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Homework due tomorrow',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                        color: ParentPortalColors.navy,
                      ),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Read the phonics worksheet and complete the sounds exercise in your notebook.',
                      style: TextStyle(fontSize: 16, height: 1.5),
                    ),
                    const Divider(height: 28),
                    _homeworkInfo(
                      Icons.event_rounded,
                      'Due',
                      'Tomorrow, 4:00 PM',
                      ParentPortalColors.green,
                    ),
                    const SizedBox(height: 14),
                    _homeworkInfo(
                      Icons.person_rounded,
                      'Assigned by',
                      'Ms. Sita Sharma',
                      ParentPortalColors.green,
                    ),
                    const SizedBox(height: 14),
                    const Text(
                      'Attachment',
                      style: TextStyle(color: ParentPortalColors.muted),
                    ),
                    const SizedBox(height: 8),
                    PortalCard(
                      onTap: () => _attachmentSheet(context),
                      padding: const EdgeInsets.all(12),
                      child: const Row(
                        children: [
                          FeatureIcon(
                            Icons.picture_as_pdf_rounded,
                            color: ParentPortalColors.red,
                            size: 40,
                          ),
                          SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Phonics_Worksheet.pdf',
                                  style: TextStyle(fontWeight: FontWeight.w800),
                                ),
                                Text(
                                  'PDF • 356 KB',
                                  style: TextStyle(
                                    color: ParentPortalColors.muted,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          ListChevron(),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              PortalCard(
                color: ParentPortalColors.redSoft,
                child: const Row(
                  children: [
                    FeatureIcon(
                      Icons.hourglass_bottom_rounded,
                      color: ParentPortalColors.red,
                    ),
                    SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Status',
                            style: TextStyle(color: ParentPortalColors.muted),
                          ),
                          Text(
                            'Not submitted',
                            style: TextStyle(
                              color: ParentPortalColors.red,
                              fontSize: 18,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          Text('This homework is not yet submitted.'),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              if (reminder != null) ...[
                const SizedBox(height: 12),
                PortalCard(
                  color: ParentPortalColors.greenSoft,
                  child: const Row(
                    children: [
                      Icon(
                        Icons.notifications_active_rounded,
                        color: ParentPortalColors.green,
                      ),
                      SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Reminder created for tomorrow at 3:00 PM',
                          style: TextStyle(fontWeight: FontWeight.w800),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _attachmentSheet(context),
                      icon: const Icon(Icons.description_rounded),
                      label: const Text('Open attachment'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () =>
                          showMessageComposer(context, childName: child.name),
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
                  onPressed: _addReminder,
                  icon: const Icon(Icons.notifications_none_rounded),
                  label: Text(
                    reminder == null ? 'Add reminder' : 'Change reminder',
                  ),
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

  Future<void> _attachmentSheet(BuildContext context) =>
      showModalBottomSheet<void>(
        context: context,
        showDragHandle: true,
        builder: (_) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const FeatureIcon(
                  Icons.picture_as_pdf_rounded,
                  color: ParentPortalColors.red,
                  size: 64,
                ),
                const SizedBox(height: 14),
                const Text(
                  'Phonics_Worksheet.pdf',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Protected file preview placeholder\nPDF • 356 KB',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: ParentPortalColors.muted),
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Done'),
                  ),
                ),
              ],
            ),
          ),
        ),
      );

  Future<void> _addReminder() async {
    final date = await showDatePicker(
      context: context,
      initialDate: DateTime.now().add(const Duration(days: 1)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 30)),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: const TimeOfDay(hour: 15, minute: 0),
    );
    if (time == null || !mounted) return;
    setState(
      () => reminder = DateTime(
        date.year,
        date.month,
        date.day,
        time.hour,
        time.minute,
      ),
    );
    showFeatureSnack(context, 'Homework reminder created.');
  }
}
