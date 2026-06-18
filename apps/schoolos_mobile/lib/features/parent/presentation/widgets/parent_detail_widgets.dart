import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/constants/app_routes.dart';
import '../../../../app/design_system/app_radius.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../domain/parent_feature_models.dart';
import 'parent_portal_widgets.dart';
import '../../../../shared/widgets/school_os_app_shell.dart';

class ParentDetailScaffold extends StatelessWidget {
  const ParentDetailScaffold({
    super.key,
    required this.title,
    required this.selectedIndex,
    required this.body,
  });
  final String title;
  final int selectedIndex;
  final Widget body;

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: ParentPortalColors.page,
    appBar: AppTopBar(title: title),
    body: SafeArea(top: false, child: body),
    bottomNavigationBar: SchoolOsBottomNavigation(
      selectedIndex: selectedIndex,
      onSelected: (index) {
        final route = [
          AppRoutes.parentHome,
          AppRoutes.parentChildren,
          AppRoutes.parentHomework,
          AppRoutes.parentUpdates,
          AppRoutes.parentMore,
        ][index];
        context.go(route);
      },
    ),
  );
}

class ParentChildSelector extends StatelessWidget {
  const ParentChildSelector({
    super.key,
    required this.child,
    required this.onChanged,
    this.showPresence = false,
  });
  final ChildProfile child;
  final ValueChanged<ChildProfile> onChanged;
  final bool showPresence;

  @override
  Widget build(BuildContext context) => PortalCard(
    padding: const EdgeInsets.symmetric(
      horizontal: AppSpacing.md,
      vertical: AppSpacing.sm,
    ),
    child: Row(
      children: [
        AvatarInitials(name: child.name, radius: 24),
        const SizedBox(width: AppSpacing.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                child.name,
                style: const TextStyle(
                  fontWeight: FontWeight.w900,
                  color: ParentPortalColors.navy,
                ),
              ),
              Text(
                child.classSection,
                style: const TextStyle(color: ParentPortalColors.muted),
              ),
            ],
          ),
        ),
        if (showPresence) const StatusBadge(label: 'Present'),
        PopupMenuButton<ChildProfile>(
          tooltip: 'Select child',
          icon: const Icon(Icons.keyboard_arrow_down_rounded),
          onSelected: onChanged,
          itemBuilder: (_) => [
            for (final item in parentChildren)
              PopupMenuItem(
                value: item,
                child: Text('${item.name} • ${item.classSection}'),
              ),
          ],
        ),
      ],
    ),
  );
}

class FeatureIcon extends StatelessWidget {
  const FeatureIcon(
    this.icon, {
    super.key,
    this.color = ParentPortalColors.purple,
    this.size = 46,
  });
  final IconData icon;
  final Color color;
  final double size;
  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(
      color: color.withValues(alpha: .1),
      borderRadius: BorderRadius.circular(AppRadius.lg),
    ),
    child: Icon(icon, color: color, size: size * .5),
  );
}

Future<void> showMessageComposer(
  BuildContext context, {
  String childName = 'Aarohi Shrestha',
}) async {
  final controller = TextEditingController();
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) => Padding(
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
            'Message teacher',
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 6),
          Text(
            'About $childName • Ms. Sita Sharma',
            style: const TextStyle(color: ParentPortalColors.muted),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: controller,
            maxLines: 4,
            decoration: const InputDecoration(
              hintText: 'Write your message…',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: () {
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Message saved to the mock conversation.'),
                  ),
                );
              },
              icon: const Icon(Icons.send_rounded),
              label: const Text('Send message'),
            ),
          ),
        ],
      ),
    ),
  );
  controller.dispose();
}

void showFeatureSnack(BuildContext context, String message) =>
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));

Future<String?> showMockPaymentSheet(
  BuildContext context, {
  String title = 'Choose payment method',
}) {
  return showModalBottomSheet<String>(
    context: context,
    showDragHandle: true,
    builder: (context) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 12),
            for (final method in const [
              ('eSewa', Icons.account_balance_wallet_rounded),
              ('Khalti', Icons.wallet_rounded),
              ('Bank transfer', Icons.account_balance_rounded),
              ('Cash at school', Icons.payments_rounded),
            ])
              ListTile(
                leading: FeatureIcon(
                  method.$2,
                  color: method.$1 == 'Cash at school'
                      ? ParentPortalColors.orange
                      : ParentPortalColors.green,
                  size: 40,
                ),
                title: Text(
                  method.$1,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                trailing: const ListChevron(),
                onTap: () => Navigator.pop(context, method.$1),
              ),
          ],
        ),
      ),
    ),
  );
}
