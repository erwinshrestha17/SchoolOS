import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../application/parent_feature_state.dart';
import '../widgets/parent_detail_widgets.dart';
import '../widgets/parent_portal_widgets.dart';

class ParentConsentsScreen extends ConsumerWidget {
  const ParentConsentsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(parentFeatureControllerProvider);
    return ParentDetailScaffold(
      title: 'Consent & Permissions',
      selectedIndex: 4,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
        children: [
          const Text(
            'Manage approvals and permissions for Erwin.',
            style: TextStyle(color: ParentPortalColors.muted, fontSize: 16),
          ),
          const SizedBox(height: 14),
          _ConsentToggle(
            icon: Icons.camera_alt_rounded,
            title: 'Media consent',
            description:
                'Allow the school to use photos and videos of Erwin in school activities and publications.',
            date: 'Approved on Jan 8, 2025',
            value: state.mediaConsent,
            onChanged: (value) => _confirmToggle(context, ref, 'media', value),
          ),
          const SizedBox(height: 12),
          PortalCard(
            child: Column(
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const FeatureIcon(
                      Icons.directions_bus_rounded,
                      color: ParentPortalColors.orange,
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Trip permission',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          Text('Field trip to City Science Museum'),
                          SizedBox(height: 5),
                          Text(
                            'May 22, 2025 • 8:00 AM – 2:30 PM',
                            style: TextStyle(color: ParentPortalColors.muted),
                          ),
                        ],
                      ),
                    ),
                    StatusBadge(
                      label: state.tripDecision == null
                          ? 'Pending'
                          : state.tripDecision!
                          ? 'Approved'
                          : 'Declined',
                      color: state.tripDecision == null
                          ? ParentPortalColors.orange
                          : state.tripDecision!
                          ? ParentPortalColors.green
                          : ParentPortalColors.red,
                      background: state.tripDecision == null
                          ? ParentPortalColors.orangeSoft
                          : state.tripDecision!
                          ? ParentPortalColors.greenSoft
                          : ParentPortalColors.redSoft,
                    ),
                  ],
                ),
                const Divider(height: 24),
                Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'We need your approval for Erwin to participate in this upcoming trip.',
                        style: TextStyle(color: ParentPortalColors.muted),
                      ),
                    ),
                    FilledButton(
                      onPressed: () => _tripDialog(context, ref),
                      child: const Text('Review request'),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          _ConsentToggle(
            icon: Icons.forum_rounded,
            title: 'Communication consent',
            description:
                'Allow the school to send notices, updates, and teacher messages via app, email, and SMS.',
            date: 'Approved on Aug 14, 2024',
            value: state.communicationConsent,
            onChanged: (value) =>
                _confirmToggle(context, ref, 'communication', value),
          ),
          const SizedBox(height: 12),
          PortalCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    FeatureIcon(Icons.group_rounded),
                    SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Authorized pickup',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          Text(
                            'People who are allowed to pick up Erwin from school.',
                            style: TextStyle(color: ParentPortalColors.muted),
                          ),
                        ],
                      ),
                    ),
                    ListChevron(),
                  ],
                ),
                const SizedBox(height: 12),
                const _Pickup('Aarohi Shrestha', 'Mother'),
                const SizedBox(height: 6),
                const _Pickup('Aarav Shrestha', 'Father'),
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed: () => _contacts(context),
                    child: const Text('Manage contacts'),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          const PortalCard(
            color: ParentPortalColors.purpleSoft,
            child: Row(
              children: [
                FeatureIcon(Icons.security_rounded, size: 42),
                SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'For your child’s safety, all changes are recorded and visible to school administrators.',
                    style: TextStyle(color: ParentPortalColors.muted),
                  ),
                ),
              ],
            ),
          ),
          if (state.activityLog.isNotEmpty) ...[
            const SizedBox(height: 14),
            const ParentSectionHeader(title: 'Recent consent activity'),
            for (final entry in state.activityLog.take(3))
              ListTile(
                leading: const Icon(
                  Icons.history_rounded,
                  color: ParentPortalColors.purple,
                ),
                title: Text(entry),
                subtitle: const Text('Recorded just now'),
              ),
          ],
        ],
      ),
    );
  }

  Future<void> _confirmToggle(
    BuildContext context,
    WidgetRef ref,
    String id,
    bool value,
  ) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(value ? 'Approve consent?' : 'Withdraw consent?'),
        content: const Text(
          'This change will be recorded and visible to school administrators.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
    if (ok == true) {
      ref.read(parentFeatureControllerProvider.notifier).setConsent(id, value);
    }
  }

  Future<void> _tripDialog(BuildContext context, WidgetRef ref) async {
    final decision = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Field trip permission'),
        content: const Text(
          'City Science Museum\nMay 22, 2025 • 8:00 AM – 2:30 PM\n\nApprove Erwin’s participation?',
        ),
        actions: [
          OutlinedButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Decline'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Approve'),
          ),
        ],
      ),
    );
    if (decision != null) {
      ref.read(parentFeatureControllerProvider.notifier).decideTrip(decision);
    }
  }

  void _contacts(BuildContext context) => showModalBottomSheet<void>(
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
              'Authorized pickup contacts',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
            ),
            SizedBox(height: 10),
            _Pickup('Aarohi Shrestha', 'Mother'),
            SizedBox(height: 8),
            _Pickup('Aarav Shrestha', 'Father'),
            SizedBox(height: 12),
            Text(
              'Contact editing will connect to the school approval workflow in a future API integration.',
              style: TextStyle(color: ParentPortalColors.muted),
            ),
          ],
        ),
      ),
    ),
  );
}

class _ConsentToggle extends StatelessWidget {
  const _ConsentToggle({
    required this.icon,
    required this.title,
    required this.description,
    required this.date,
    required this.value,
    required this.onChanged,
  });
  final IconData icon;
  final String title, description, date;
  final bool value;
  final ValueChanged<bool> onChanged;
  @override
  Widget build(BuildContext context) => PortalCard(
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        FeatureIcon(icon, color: ParentPortalColors.green),
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
              Text(description, style: const TextStyle(height: 1.4)),
              const SizedBox(height: 7),
              Text(
                date,
                style: const TextStyle(color: ParentPortalColors.muted),
              ),
            ],
          ),
        ),
        Switch(value: value, onChanged: onChanged),
      ],
    ),
  );
}

class _Pickup extends StatelessWidget {
  const _Pickup(this.name, this.role);
  final String name, role;
  @override
  Widget build(BuildContext context) => PortalCard(
    padding: const EdgeInsets.all(10),
    child: Row(
      children: [
        AvatarInitials(name: name, radius: 20),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(name, style: const TextStyle(fontWeight: FontWeight.w900)),
              Text(
                '$role • Can pickup',
                style: const TextStyle(color: ParentPortalColors.muted),
              ),
            ],
          ),
        ),
        const StatusBadge(label: 'Approved'),
      ],
    ),
  );
}
