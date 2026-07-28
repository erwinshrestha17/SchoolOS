import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/constants/app_routes.dart';
import '../../../../core/auth/auth_provider.dart';
import '../../application/parent_dashboard_view_model.dart';
import '../../domain/parent_models.dart';
import '../../domain/parent_portal_models.dart';
import '../widgets/parent_portal_widgets.dart';

class ParentPortalMoreTab extends ConsumerWidget {
  const ParentPortalMoreTab({super.key, required this.data});

  final ParentPortalData data;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // The same rule the Today header uses. Guardian accounts are routinely
    // provisioned without a name, and this card was printing the raw login
    // handle - "guardian.c01a001" - as the account holder's name, initials
    // and all. Fall back to the role rather than to the database key.
    final displayName = guardianDisplayName(data.parentName) ?? 'Parent';

    return ListView(
      key: const PageStorageKey('parent-more'),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
      children: [
        PortalCard(
          child: Row(
            children: [
              AvatarInitials(name: displayName, radius: 31),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      displayName,
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        color: ParentPortalColors.navy,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    Text(
                      'Parent / Guardian',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: ParentPortalColors.muted,
                      ),
                    ),
                    Text(
                      '${data.schoolName} • ${data.children.length} linked ${data.children.length == 1 ? 'child' : 'children'}',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: ParentPortalColors.muted,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const StatusBadge(
                      label: 'Active',
                      icon: Icons.check_circle_rounded,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        _group(context, 'Academic', [
          _Menu(
            Icons.insights_rounded,
            'Weekly Progress',
            'Attendance, homework, feedback, results, and next actions',
            AppRoutes.parentWeeklyProgress,
            capability: GuardianCapabilityKey.academicsView,
          ),
          _Menu(
            Icons.event_note_outlined,
            'Subject Timetable',
            'Subjects, periods, teachers, rooms, and class teacher',
            AppRoutes.parentTimetable,
            capability: GuardianCapabilityKey.academicsView,
          ),
          _Menu(
            Icons.assessment_outlined,
            'Exams & Results',
            'Published exam schedule, results, and protected reports',
            AppRoutes.parentReportCards,
            capability: GuardianCapabilityKey.academicsView,
          ),
          _Menu(
            Icons.calendar_month_outlined,
            'School Calendar',
            'Events, holidays, and important dates',
            AppRoutes.parentCalendar,
            capability: GuardianCapabilityKey.academicsView,
          ),
        ]),
        _group(context, 'Finance', [
          _Menu(
            Icons.receipt_long_outlined,
            'Fees & Receipts',
            'Dues, invoices, and confirmed receipts',
            AppRoutes.parentFeesReceipts,
            capability: GuardianCapabilityKey.feesView,
          ),
          _Menu(
            Icons.account_balance_wallet_outlined,
            'Canteen Wallet',
            'Balance and recent school purchases',
            AppRoutes.parentCanteen,
            capability: GuardianCapabilityKey.feesView,
          ),
        ]),
        _group(context, 'Services', [
          _Menu(
            Icons.task_alt_rounded,
            'Action Centre',
            'Live school tasks that need your attention',
            AppRoutes.parentActionCentre,
          ),
          _Menu(
            Icons.directions_bus_outlined,
            'Transport',
            'Pickup, route, and trip information',
            AppRoutes.parentTransport,
            capability: GuardianCapabilityKey.emergencyAlertReceive,
          ),
          _Menu(
            Icons.local_library_outlined,
            'Library',
            'Borrowed books and due dates',
            AppRoutes.parentLibrary,
            capability: GuardianCapabilityKey.academicsView,
          ),
          _Menu(
            Icons.fact_check_outlined,
            'Consent & Permissions',
            'Review school requests and approvals',
            AppRoutes.parentConsents,
            capability: GuardianCapabilityKey.specificConsentGive,
          ),
          _Menu(
            Icons.support_agent_outlined,
            'Help & Requests',
            'School concerns, payment disputes, and responses',
            AppRoutes.parentServiceRequests,
            capability: GuardianCapabilityKey.complaintOrCorrectionSubmit,
          ),
        ]),
        const ParentSectionHeader(title: 'Account'),
        const SizedBox(height: 10),
        PortalCard(
          child: Column(
            children: [
              SettingsMenuItem(
                icon: Icons.person_outline_rounded,
                title: 'My Profile',
                subtitle: 'Personal details and linked account',
                onTap: () => context.push(AppRoutes.profile),
              ),
              const Divider(),
              SettingsMenuItem(
                icon: Icons.notifications_none_rounded,
                title: 'Notification Settings',
                subtitle: 'Choose the updates you receive',
                onTap: () => context.push(AppRoutes.settings),
              ),
              const Divider(),
              SettingsMenuItem(
                icon: Icons.language_rounded,
                title: 'Language',
                subtitle: 'English',
                onTap: () => _soon(context, 'Language preferences'),
              ),
              const Divider(),
              SettingsMenuItem(
                icon: Icons.help_outline_rounded,
                title: 'Help & Support',
                subtitle:
                    _hasCapability(
                      GuardianCapabilityKey.complaintOrCorrectionSubmit,
                    )
                    ? 'Send and follow a request to the school'
                    : 'Not included in your access for this child',
                onTap: () => _openCapabilityRoute(
                  context,
                  AppRoutes.parentServiceRequests,
                  GuardianCapabilityKey.complaintOrCorrectionSubmit,
                ),
              ),
              const Divider(),
              SettingsMenuItem(
                icon: Icons.logout_rounded,
                title: 'Logout',
                subtitle: 'Sign out of this device',
                color: ParentPortalColors.red,
                onTap: () => _confirmLogout(context, ref),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _group(BuildContext context, String title, List<_Menu> items) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ParentSectionHeader(title: title),
          const SizedBox(height: 10),
          PortalCard(
            child: Column(
              children: [
                for (var index = 0; index < items.length; index++) ...[
                  _menuItem(context, items[index]),
                  if (index != items.length - 1) const Divider(),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _menuItem(BuildContext context, _Menu item) {
    final allowed = item.capability == null || _hasCapability(item.capability!);
    return SettingsMenuItem(
      icon: item.icon,
      title: item.title,
      subtitle: allowed
          ? item.subtitle
          : 'Not included in your access for this child',
      onTap: () {
        final route = item.route;
        if (route == null) {
          _soon(context, item.title);
        } else if (!allowed) {
          _locked(context);
        } else {
          context.push(route);
        }
      },
    );
  }

  bool _hasCapability(String capability) =>
      data.activeChild?.hasCapability(capability) ?? false;

  void _openCapabilityRoute(
    BuildContext context,
    String route,
    String capability,
  ) {
    if (_hasCapability(capability)) {
      context.push(route);
      return;
    }
    _locked(context);
  }

  Future<void> _confirmLogout(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Logout?'),
        content: const Text(
          'You will need to sign in again to view private school information.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            style: FilledButton.styleFrom(
              backgroundColor: ParentPortalColors.red,
            ),
            child: const Text('Logout'),
          ),
        ],
      ),
    );
    if (confirmed == true) await ref.read(authProvider.notifier).logout();
  }
}

class _Menu {
  const _Menu(
    this.icon,
    this.title,
    this.subtitle,
    this.route, {
    this.capability,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String? route;
  final String? capability;
}

void _soon(BuildContext context, String feature) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(content: Text('$feature is not available for this school yet.')),
  );
}

void _locked(BuildContext context) {
  ScaffoldMessenger.of(context).showSnackBar(
    const SnackBar(
      content: Text(
        'The school has not granted this access for the selected child.',
      ),
    ),
  );
}
