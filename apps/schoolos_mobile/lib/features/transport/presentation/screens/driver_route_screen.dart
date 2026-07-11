import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/design_system/app_radius.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_exception_view.dart';
import '../../../../shared/widgets/app_skeleton.dart';
import '../../../../shared/widgets/role_shell_scaffold.dart';
import '../../../../shared/widgets/section_header.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../application/driver_transport_providers.dart';
import '../../domain/driver_transport_models.dart';

class DriverRouteScreen extends ConsumerWidget {
  const DriverRouteScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboard = ref.watch(driverTransportDashboardProvider);

    return RoleShellScaffold(
      role: 'DRIVER',
      selectedIndex: 1,
      title: 'Route',
      body: dashboard.when(
        loading: () => const _DriverListLoading(),
        error: (error, _) => AppExceptionView(
          error: error,
          onRetry: () => ref.invalidate(driverTransportDashboardProvider),
        ),
        data: (summary) => RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(driverTransportDashboardProvider);
            await ref.read(driverTransportDashboardProvider.future);
          },
          child: summary.assignments.isEmpty && summary.activeTrips.isEmpty
              ? ListView(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  children: const [
                    AppEmptyState(
                      title: 'No route assignment',
                      message:
                          'Assigned driver routes will appear after dispatch setup.',
                      icon: Icons.map_outlined,
                    ),
                  ],
                )
              : ListView(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  children: [
                    const SectionHeader(title: 'Active trips'),
                    const SizedBox(height: AppSpacing.sm),
                    if (summary.activeTrips.isEmpty)
                      const AppEmptyState(
                        title: 'No active trip',
                        message: 'Dispatch has not opened a trip yet.',
                        icon: Icons.route_outlined,
                      )
                    else
                      for (final trip in summary.activeTrips) ...[
                        DriverTripTile(trip: trip),
                        const SizedBox(height: AppSpacing.md),
                      ],
                    const SizedBox(height: AppSpacing.lg),
                    const SectionHeader(title: 'Assignments'),
                    const SizedBox(height: AppSpacing.sm),
                    for (final assignment in summary.assignments) ...[
                      _AssignmentTile(assignment: assignment),
                      const SizedBox(height: AppSpacing.md),
                    ],
                  ],
                ),
        ),
      ),
    );
  }
}

class DriverStudentsScreen extends ConsumerWidget {
  const DriverStudentsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboard = ref.watch(driverTransportDashboardProvider);

    return RoleShellScaffold(
      role: 'DRIVER',
      selectedIndex: 2,
      title: 'Students',
      body: dashboard.when(
        loading: () => const _DriverListLoading(),
        error: (error, _) => AppExceptionView(
          error: error,
          onRetry: () => ref.invalidate(driverTransportDashboardProvider),
        ),
        data: (summary) {
          final activeTrips = summary.activeTrips
              .where((trip) => trip.isActive)
              .toList();
          if (activeTrips.isEmpty) {
            return ListView(
              padding: const EdgeInsets.all(AppSpacing.lg),
              children: const [
                AppEmptyState(
                  title: 'No active manifest',
                  message:
                      'Student manifest rows appear once dispatch opens an active trip.',
                  icon: Icons.groups_outlined,
                ),
              ],
            );
          }
          final trip = activeTrips.first;
          final manifest = ref.watch(driverTripManifestProvider(trip.id));

          return manifest.when(
            loading: () => const _DriverListLoading(),
            error: (error, _) => AppExceptionView(
              error: error,
              onRetry: () =>
                  ref.invalidate(driverTripManifestProvider(trip.id)),
            ),
            data: (manifest) => RefreshIndicator(
              onRefresh: () async {
                ref.invalidate(driverTripManifestProvider(trip.id));
                await ref.read(driverTripManifestProvider(trip.id).future);
              },
              child: ListView(
                padding: const EdgeInsets.all(AppSpacing.lg),
                children: [
                  DriverTripTile(trip: trip),
                  const SizedBox(height: AppSpacing.xl),
                  const SectionHeader(title: 'Student manifest'),
                  const SizedBox(height: AppSpacing.sm),
                  if (manifest.students.isEmpty)
                    const AppEmptyState(
                      title: 'No students',
                      message: 'No students are attached to this trip yet.',
                      icon: Icons.groups_outlined,
                    )
                  else
                    for (final student in manifest.students) ...[
                      _StudentTile(student: student),
                      const SizedBox(height: AppSpacing.md),
                    ],
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class DriverHistoryScreen extends ConsumerWidget {
  const DriverHistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final history = ref.watch(driverTripHistoryProvider);

    return RoleShellScaffold(
      role: 'DRIVER',
      selectedIndex: 3,
      title: 'History',
      body: history.when(
        loading: () => const _DriverListLoading(),
        error: (error, _) => AppExceptionView(
          error: error,
          onRetry: () => ref.invalidate(driverTripHistoryProvider),
        ),
        data: (trips) => RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(driverTripHistoryProvider);
            await ref.read(driverTripHistoryProvider.future);
          },
          child: trips.isEmpty
              ? ListView(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  children: const [
                    AppEmptyState(
                      title: 'No trip history',
                      message: 'Completed trips will appear here.',
                      icon: Icons.history_rounded,
                    ),
                  ],
                )
              : ListView(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  children: [
                    const SectionHeader(title: 'Recent trips'),
                    const SizedBox(height: AppSpacing.sm),
                    for (final trip in trips) ...[
                      DriverTripTile(trip: trip),
                      const SizedBox(height: AppSpacing.md),
                    ],
                  ],
                ),
        ),
      ),
    );
  }
}

class DriverTripTile extends StatelessWidget {
  const DriverTripTile({super.key, required this.trip});

  final DriverTransportTrip trip;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _IconTile(
            icon: trip.isActive
                ? Icons.near_me_rounded
                : Icons.check_circle_rounded,
            color: trip.isActive ? AppColors.driverAccent : AppColors.success,
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        _routeLabel(trip.routeCode, trip.routeName),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    StatusChip(
                      status: _tripStatus(trip.status),
                      label: _label(trip.status),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  '${_label(trip.direction)} - ${_vehicleLabel(trip)}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.slate500,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  _tripWindow(trip),
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: AppColors.slate500),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AssignmentTile extends StatelessWidget {
  const _AssignmentTile({required this.assignment});

  final DriverTransportAssignment assignment;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _IconTile(
            icon: Icons.directions_bus_rounded,
            color: AppColors.driverAccent,
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _routeLabel(assignment.routeCode, assignment.routeName),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  _assignmentVehicleLabel(assignment),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.slate500,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          StatusChip(
            status: assignment.isActive
                ? AppStatusType.approved
                : AppStatusType.completed,
            label: assignment.isActive ? 'Active' : 'Closed',
          ),
        ],
      ),
    );
  }
}

class _StudentTile extends StatelessWidget {
  const _StudentTile({required this.student});

  final DriverManifestStudent student;

  @override
  Widget build(BuildContext context) {
    final medicalNote = _studentMedicalNote(student);

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _IconTile(
                icon: Icons.person_rounded,
                color: _studentColor(student.status),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      student.name ?? student.studentSystemId ?? 'Student',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      _studentMeta(student),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.slate500,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              StatusChip(
                status: _studentStatus(student.status),
                label: _label(student.status),
              ),
            ],
          ),
          if (medicalNote.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  Icons.medical_information_outlined,
                  size: 16,
                  color: AppColors.warningDark,
                ),
                const SizedBox(width: AppSpacing.xs),
                Expanded(
                  child: Text(
                    medicalNote,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.warningDark,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

String _studentMedicalNote(DriverManifestStudent student) {
  final parts = [
    if ((student.medicalConditions ?? '').trim().isNotEmpty)
      student.medicalConditions!.trim(),
    if ((student.severeAllergies ?? '').trim().isNotEmpty)
      student.severeAllergies!.trim(),
  ];
  return parts.join(' - ');
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

class _DriverListLoading extends StatelessWidget {
  const _DriverListLoading();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.all(AppSpacing.lg),
      child: Column(
        children: [
          AppSkeleton(width: double.infinity, height: 104),
          SizedBox(height: AppSpacing.md),
          AppSkeleton(width: double.infinity, height: 104),
          SizedBox(height: AppSpacing.md),
          AppSkeleton(width: double.infinity, height: 104),
        ],
      ),
    );
  }
}

String _routeLabel(String? code, String? name) {
  final values = [
    if ((code ?? '').trim().isNotEmpty) code!.trim(),
    if ((name ?? '').trim().isNotEmpty) name!.trim(),
  ];
  return values.isEmpty ? 'Route pending' : values.join(' - ');
}

String _vehicleLabel(DriverTransportTrip trip) {
  final values = [
    if ((trip.vehicleRegistration ?? '').trim().isNotEmpty)
      trip.vehicleRegistration!.trim(),
    if ((trip.vehicleModel ?? '').trim().isNotEmpty) trip.vehicleModel!.trim(),
    if (trip.vehicleCapacity > 0) 'Capacity ${trip.vehicleCapacity}',
  ];
  return values.isEmpty ? 'Vehicle pending' : values.join(' - ');
}

String _assignmentVehicleLabel(DriverTransportAssignment assignment) {
  final values = [
    assignment.vehicleRegistration,
    if ((assignment.vehicleModel ?? '').trim().isNotEmpty)
      assignment.vehicleModel!.trim(),
    if (assignment.vehicleCapacity > 0)
      'Capacity ${assignment.vehicleCapacity}',
  ];
  return values.join(' - ');
}

String _tripWindow(DriverTransportTrip trip) {
  final started = _dateTimeLabel(trip.startedAt);
  final completed = _dateTimeLabel(trip.completedAt);
  if (completed != null) {
    return 'Started $started - completed $completed';
  }
  if (started != null) {
    return 'Started $started';
  }
  return 'Trip timing pending';
}

String? _dateTimeLabel(String? isoDate) {
  if (isoDate == null || isoDate.trim().isEmpty) {
    return null;
  }
  final parsed = DateTime.tryParse(isoDate);
  if (parsed == null) {
    return isoDate;
  }
  final hour = parsed.hour.toString().padLeft(2, '0');
  final minute = parsed.minute.toString().padLeft(2, '0');
  return '${parsed.month}/${parsed.day} $hour:$minute';
}

String _studentMeta(DriverManifestStudent student) {
  final values = [
    if ((student.rollNumber ?? '').isNotEmpty) 'Roll ${student.rollNumber}',
    if ((student.stopName ?? '').isNotEmpty) 'Stop ${student.stopName}',
    if (student.stopSequence != null) 'Seq ${student.stopSequence}',
  ];
  return values.isEmpty ? 'Manifest student' : values.join(' - ');
}

AppStatusType _tripStatus(String status) {
  switch (status.toUpperCase()) {
    case 'ACTIVE':
      return AppStatusType.onRoute;
    case 'COMPLETED':
    case 'CLOSED':
      return AppStatusType.completed;
    case 'CANCELLED':
      return AppStatusType.rejected;
    default:
      return AppStatusType.pending;
  }
}

AppStatusType _studentStatus(String status) {
  switch (status.toUpperCase()) {
    case 'BOARDED':
      return AppStatusType.onRoute;
    case 'DROPPED':
      return AppStatusType.completed;
    case 'ABSENT':
      return AppStatusType.late;
    default:
      return AppStatusType.pending;
  }
}

Color _studentColor(String status) {
  switch (status.toUpperCase()) {
    case 'BOARDED':
      return AppColors.driverAccent;
    case 'DROPPED':
      return AppColors.success;
    case 'ABSENT':
      return AppColors.warning;
    default:
      return AppColors.slate400;
  }
}

String _label(String value) {
  final normalized = value.replaceAll('_', ' ').trim().toLowerCase();
  if (normalized.isEmpty) {
    return 'Pending';
  }
  return normalized
      .split(RegExp(r'\s+'))
      .map((part) => '${part[0].toUpperCase()}${part.substring(1)}')
      .join(' ');
}
