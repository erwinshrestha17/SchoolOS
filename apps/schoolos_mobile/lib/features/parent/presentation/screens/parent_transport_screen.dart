import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../app/design_system/app_radius.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_error_view.dart';
import '../../../../shared/widgets/app_skeleton.dart';
import '../../../../shared/widgets/role_shell_scaffold.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../application/parent_providers.dart';
import '../../domain/parent_models.dart';
import '../widgets/parent_state_view.dart';

class ParentTransportScreen extends ConsumerWidget {
  const ParentTransportScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(parentControllerProvider);
    final controller = ref.read(parentControllerProvider.notifier);
    final childId = state.selectedChildId;

    return RoleShellScaffold(
      role: 'PARENT',
      selectedIndex: 4,
      title: 'Transport',
      body: ParentStateView(
        status: state.status,
        message: state.message,
        onRetry: controller.load,
        child: childId == null
            ? const AppEmptyState(
                title: 'No child selected',
                message: 'Select a child before viewing transport.',
                icon: Icons.directions_bus_rounded,
              )
            : _TransportContent(childId: childId),
      ),
    );
  }
}

class _TransportContent extends ConsumerWidget {
  const _TransportContent({required this.childId});

  final String childId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final transport = ref.watch(parentTransportProvider(childId));

    return transport.when(
      loading: () => const Padding(
        padding: EdgeInsets.all(AppSpacing.lg),
        child: Column(
          children: [
            AppSkeleton(width: double.infinity, height: 180),
            SizedBox(height: AppSpacing.md),
            AppSkeleton(width: double.infinity, height: 96),
          ],
        ),
      ),
      error: (_, _) => AppErrorView(
        title: 'Could not load transport',
        message: 'Please try again in a moment.',
        onRetry: () => ref.invalidate(parentTransportProvider(childId)),
      ),
      data: (info) => RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(parentTransportProvider(childId));
          await ref.read(parentTransportProvider(childId).future);
        },
        child: !info.hasRoute
            ? ListView(
                padding: const EdgeInsets.all(AppSpacing.lg),
                children: const [
                  AppEmptyState(
                    title: 'No transport assigned',
                    message: 'Bus route details will appear after assignment.',
                    icon: Icons.directions_bus_rounded,
                  ),
                ],
              )
            : ListView(
                padding: const EdgeInsets.all(AppSpacing.lg),
                children: [
                  _TripHero(info: info),
                  const SizedBox(height: AppSpacing.lg),
                  _TransportRow(
                    icon: Icons.route_rounded,
                    title: 'Route',
                    value: info.routeName ?? 'Route assigned',
                  ),
                  _TransportRow(
                    icon: Icons.pin_drop_rounded,
                    title: 'Stop',
                    value: info.stopName ?? 'Stop not set',
                  ),
                  _TransportRow(
                    icon: Icons.directions_bus_rounded,
                    title: 'Vehicle',
                    value: info.vehicleLabel ?? 'Vehicle not assigned',
                  ),
                  _TransportRow(
                    icon: Icons.schedule_rounded,
                    title: 'Last update',
                    value: _date(info.latestLocationAt) ?? 'No live update yet',
                  ),
                ],
              ),
      ),
    );
  }
}

class _TripHero extends StatelessWidget {
  const _TripHero({required this.info});

  final ParentTransportInfo info;

  @override
  Widget build(BuildContext context) {
    final delayed = info.isDelayed || info.delayMinutes > 0;

    return AppCard(
      color: delayed ? AppColors.warningLight : AppColors.secondaryLight,
      border: Border.all(
        color: delayed
            ? AppColors.warning.withValues(alpha: 0.24)
            : AppColors.secondary.withValues(alpha: 0.18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(AppSpacing.md),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.8),
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                ),
                child: Icon(
                  delayed ? Icons.warning_amber_rounded : Icons.route_rounded,
                  color: delayed ? AppColors.warning : AppColors.secondary,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      info.hasActiveTrip ? 'Active trip' : 'Route ready',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: AppColors.slate600,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      _labelize(
                        info.studentStatus ?? info.tripStatus ?? 'Assigned',
                      ),
                      style: Theme.of(context).textTheme.headlineMedium
                          ?.copyWith(
                            color: AppColors.slate900,
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                  ],
                ),
              ),
              StatusChip(
                status: delayed ? AppStatusType.late : AppStatusType.onRoute,
                label: delayed ? 'Delayed' : null,
              ),
            ],
          ),
          if (delayed) ...[
            const SizedBox(height: AppSpacing.md),
            Text(
              'Delay ${info.delayMinutes} min. The school transport team is updating this route.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppColors.warningDark,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _TransportRow extends StatelessWidget {
  const _TransportRow({
    required this.icon,
    required this.title,
    required this.value,
  });

  final IconData icon;
  final String title;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: AppCard(
        child: Row(
          children: [
            Icon(icon, color: AppColors.driverAccent),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.slate500,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    value,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

String _labelize(String value) {
  return value
      .split('_')
      .where((part) => part.isNotEmpty)
      .map((part) => part[0].toUpperCase() + part.substring(1).toLowerCase())
      .join(' ');
}

String? _date(String? isoDate) {
  if (isoDate == null || isoDate.isEmpty) {
    return null;
  }
  final parsed = DateTime.tryParse(isoDate);
  if (parsed == null) {
    return null;
  }
  return DateFormat('MMM d, yyyy h:mm a').format(parsed);
}
