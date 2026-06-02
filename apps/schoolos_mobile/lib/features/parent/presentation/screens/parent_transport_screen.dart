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
import '../../../../shared/widgets/section_header.dart';
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
            AppSkeleton(width: double.infinity, height: 108),
            SizedBox(height: AppSpacing.md),
            AppSkeleton(width: double.infinity, height: 108),
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
                  const SizedBox(height: AppSpacing.xl),
                  const SectionHeader(title: 'Route details'),
                  const SizedBox(height: AppSpacing.sm),
                  _TransportRow(
                    icon: Icons.route_rounded,
                    title: 'Route',
                    value: _routeLabel(info),
                    accent: AppColors.driverAccent,
                  ),
                  _TransportRow(
                    icon: Icons.pin_drop_rounded,
                    title: 'Boarding stop',
                    value: _stopLabel(info),
                    accent: AppColors.parentAccent,
                  ),
                  _TransportRow(
                    icon: Icons.directions_bus_rounded,
                    title: 'Vehicle',
                    value: _vehicleLabel(info),
                    accent: AppColors.info,
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  const SectionHeader(title: 'Live signal'),
                  const SizedBox(height: AppSpacing.sm),
                  _LiveSignalCard(info: info),
                  const SizedBox(height: AppSpacing.lg),
                  const SectionHeader(title: 'Assignment'),
                  const SizedBox(height: AppSpacing.sm),
                  _AssignmentCard(info: info),
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
    final statusLabel = info.hasActiveTrip
        ? _labelize(info.studentStatus ?? info.tripStatus ?? 'ON_ROUTE')
        : 'Route assigned';

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
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(AppSpacing.md),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.8),
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                ),
                child: Icon(
                  delayed
                      ? Icons.warning_amber_rounded
                      : Icons.directions_bus_filled_rounded,
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
                      statusLabel,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.headlineMedium
                          ?.copyWith(
                            color: AppColors.slate900,
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      _routeLabel(info),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.slate600,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              StatusChip(
                status: delayed
                    ? AppStatusType.late
                    : (info.hasActiveTrip
                          ? AppStatusType.onRoute
                          : AppStatusType.approved),
                label: delayed
                    ? 'Delayed'
                    : (info.hasActiveTrip ? 'Tracking' : 'Assigned'),
              ),
            ],
          ),
          if (delayed) ...[
            const SizedBox(height: AppSpacing.md),
            Text(
              _delayLabel(info),
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

class _LiveSignalCard extends StatelessWidget {
  const _LiveSignalCard({required this.info});

  final ParentTransportInfo info;

  @override
  Widget build(BuildContext context) {
    final coordinateLabel = _coordinateLabel(info);
    final speedLabel = info.speedKph == null
        ? 'Speed unavailable'
        : '${_compactNumber(info.speedKph!)} km/h';

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _IconTile(
                icon: info.hasLatestLocation
                    ? Icons.gps_fixed_rounded
                    : Icons.gps_off_rounded,
                color: info.hasLatestLocation
                    ? AppColors.success
                    : AppColors.slate400,
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      info.hasLatestLocation
                          ? 'Latest GPS update'
                          : 'No live GPS update yet',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(
                      _date(info.latestLocationAt) ??
                          'The school transport team has not published a location ping for this trip.',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.slate500,
                      ),
                    ),
                  ],
                ),
              ),
              StatusChip(
                status: info.hasLatestLocation
                    ? AppStatusType.onRoute
                    : AppStatusType.draft,
                label: info.hasLatestLocation ? 'Signal' : 'Waiting',
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          _InlineMetric(label: 'Speed', value: speedLabel),
          const SizedBox(height: AppSpacing.sm),
          _InlineMetric(label: 'Coordinates', value: coordinateLabel),
        ],
      ),
    );
  }
}

class _AssignmentCard extends StatelessWidget {
  const _AssignmentCard({required this.info});

  final ParentTransportInfo info;

  @override
  Widget build(BuildContext context) {
    final fee = info.feeAmount == null ? null : _money(info.feeAmount!);

    return AppCard(
      child: Column(
        children: [
          _CompactDetailRow(
            title: 'Student status',
            value: _labelize(info.studentStatus ?? 'Not boarded'),
          ),
          const Divider(),
          _CompactDetailRow(
            title: 'Trip direction',
            value: _labelize(info.tripDirection ?? info.pickupDirection ?? ''),
            fallback: 'Direction pending',
          ),
          const Divider(),
          _CompactDetailRow(
            title: 'Assignment',
            value: _labelize(info.assignmentStatus ?? ''),
            fallback: 'No active assignment record',
          ),
          const Divider(),
          _CompactDetailRow(
            title: 'Enrollment',
            value: _joinPresent([_labelize(info.enrollmentStatus ?? ''), ?fee]),
            fallback: 'No active fee enrollment record',
          ),
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
    required this.accent,
  });

  final IconData icon;
  final String title;
  final String value;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: AppCard(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _IconTile(icon: icon, color: accent),
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
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
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

class _IconTile extends StatelessWidget {
  const _IconTile({required this.icon, required this.color});

  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Icon(icon, color: color),
    );
  }
}

class _InlineMetric extends StatelessWidget {
  const _InlineMetric({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 96,
          child: Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: AppColors.slate500,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w700),
          ),
        ),
      ],
    );
  }
}

class _CompactDetailRow extends StatelessWidget {
  const _CompactDetailRow({
    required this.title,
    required this.value,
    this.fallback = 'Unavailable',
  });

  final String title;
  final String value;
  final String fallback;

  @override
  Widget build(BuildContext context) {
    final displayValue = value.trim().isEmpty ? fallback : value;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(
              title,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppColors.slate500,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            flex: 2,
            child: Text(
              displayValue,
              textAlign: TextAlign.right,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );
  }
}

String _routeLabel(ParentTransportInfo info) {
  return _joinPresent([
    ?info.routeCode,
    ?info.routeName,
  ], fallback: 'Route assigned');
}

String _stopLabel(ParentTransportInfo info) {
  final sequence = info.stopSequence == null
      ? null
      : 'Stop ${info.stopSequence}';
  return _joinPresent([?info.stopName, ?sequence], fallback: 'Stop not set');
}

String _vehicleLabel(ParentTransportInfo info) {
  final capacity = info.vehicleCapacity == null
      ? null
      : 'Capacity ${info.vehicleCapacity}';
  return _joinPresent([
    ?info.vehicleLabel,
    ?info.vehicleModel,
    ?capacity,
  ], fallback: 'Vehicle not assigned');
}

String _delayLabel(ParentTransportInfo info) {
  final minutes = info.delayMinutes > 0 ? '${info.delayMinutes} min' : null;
  return _joinPresent(['Delay', ?minutes, ?info.delayReason]);
}

String _coordinateLabel(ParentTransportInfo info) {
  if (info.latitude == null || info.longitude == null) {
    return 'Coordinates unavailable';
  }
  return '${_compactNumber(info.latitude!)}, ${_compactNumber(info.longitude!)}';
}

String _joinPresent(List<String> values, {String fallback = ''}) {
  final present = values.where((value) => value.trim().isNotEmpty).toList();
  if (present.isEmpty) {
    return fallback;
  }
  return present.join(' - ');
}

String _labelize(String value) {
  return value
      .split('_')
      .where((part) => part.isNotEmpty)
      .map((part) => part[0].toUpperCase() + part.substring(1).toLowerCase())
      .join(' ');
}

String _money(num value) {
  final formatted = NumberFormat.decimalPattern().format(value);
  return 'NPR $formatted';
}

String _compactNumber(num value) {
  if (value % 1 == 0) {
    return value.toInt().toString();
  }
  return value.toStringAsFixed(4).replaceFirst(RegExp(r'0+$'), '');
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
