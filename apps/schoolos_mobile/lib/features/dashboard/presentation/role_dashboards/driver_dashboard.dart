import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import '../../../../app/design_system/app_radius.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../core/permissions/permission_service.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_exception_view.dart';
import '../../../../shared/widgets/app_gradient_card.dart';
import '../../../../shared/widgets/app_skeleton.dart';
import '../../../../shared/widgets/dashboard_card.dart';
import '../../../../shared/widgets/role_badge.dart';
import '../../../../shared/widgets/role_shell_scaffold.dart';
import '../../../../shared/widgets/section_header.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../../transport/application/driver_transport_providers.dart';
import '../../../transport/domain/driver_transport_models.dart';

class DriverDashboard extends ConsumerWidget {
  const DriverDashboard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboard = ref.watch(driverTransportDashboardProvider);

    return RoleShellScaffold(
      role: 'DRIVER',
      selectedIndex: 0,
      title: 'Driver',
      body: dashboard.when(
        data: (summary) => summary.hasWork
            ? _DriverDashboardContent(
                summary: summary,
                onRefresh: () =>
                    ref.refresh(driverTransportDashboardProvider.future),
              )
            : RefreshIndicator(
                onRefresh: () =>
                    ref.refresh(driverTransportDashboardProvider.future),
                child: ListView(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  children: const [
                    SizedBox(height: AppSpacing.xxl),
                    AppEmptyState(
                      title: 'No route assignment yet',
                      message:
                          'Transport assignments and trips will appear here once dispatch assigns them.',
                      icon: Icons.route_rounded,
                    ),
                  ],
                ),
              ),
        loading: () => const _DriverDashboardLoading(),
        error: (error, stackTrace) => AppExceptionView(
          error: error,
          onRetry: () => ref.invalidate(driverTransportDashboardProvider),
        ),
      ),
    );
  }
}

class _DriverDashboardContent extends StatelessWidget {
  const _DriverDashboardContent({
    required this.summary,
    required this.onRefresh,
  });

  final DriverTransportDashboard summary;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final activeTrip = _firstOrNull(
      summary.activeTrips.where((trip) => trip.isActive),
    );
    final activeAssignment = _firstOrNull(
      summary.assignments.where((assignment) => assignment.isActive),
    );
    final primaryRoute = activeTrip == null
        ? _assignmentRouteLabel(activeAssignment)
        : _tripRouteLabel(activeTrip);
    final primaryVehicle = activeTrip == null
        ? _assignmentVehicleLabel(activeAssignment)
        : _tripVehicleLabel(activeTrip);

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Driver route board',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.headlineSmall
                          ?.copyWith(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      activeTrip == null
                          ? 'Assigned routes and recent trip history.'
                          : 'Live trip and assigned vehicle from dispatch.',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.slate500,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              const RoleBadge(role: 'DRIVER'),
            ],
          ),
          const SizedBox(height: AppSpacing.xl),
          AppGradientCard(
            gradient: const LinearGradient(
              colors: AppColors.driverGradient,
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      StatusChip(
                        status: activeTrip == null
                            ? AppStatusType.draft
                            : AppStatusType.onRoute,
                        label: activeTrip == null ? 'Ready' : 'Live trip',
                      ),
                      const SizedBox(height: AppSpacing.md),
                      Text(
                        primaryRoute,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        primaryVehicle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Colors.white70,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      if (activeTrip?.isDelayed == true) ...[
                        const SizedBox(height: AppSpacing.md),
                        Text(
                          _delayLabel(activeTrip!),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(
                                color: Colors.white,
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.lg),
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.16),
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white30),
                  ),
                  child: const Icon(
                    Icons.directions_bus_filled_rounded,
                    color: Colors.white,
                    size: 38,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          const SectionHeader(title: "Today's transport"),
          const SizedBox(height: AppSpacing.sm),
          DashboardCard(
            title: 'Active trips',
            value: summary.activeTrips.length.toString(),
            icon: Icons.near_me_rounded,
            iconColor: summary.activeTrips.isEmpty
                ? AppColors.slate400
                : AppColors.driverAccent,
            badge: StatusChip(
              status: summary.activeTrips.isEmpty
                  ? AppStatusType.draft
                  : AppStatusType.onRoute,
              label: summary.activeTrips.isEmpty ? 'Idle' : 'On route',
            ),
            subtitle: summary.activeTrips.isEmpty
                ? 'No live trip is assigned to this driver account.'
                : 'Live trips are synced from transport dispatch.',
          ),
          const SizedBox(height: AppSpacing.md),
          DashboardCard(
            title: 'Assignments',
            value: summary.assignments.length.toString(),
            icon: Icons.assignment_ind_rounded,
            iconColor: AppColors.info,
            subtitle: 'Current driver-vehicle-route assignments.',
          ),
          const SizedBox(height: AppSpacing.md),
          DashboardCard(
            title: 'Recent trips',
            value: summary.recentTrips.length.toString(),
            icon: Icons.history_rounded,
            iconColor: AppColors.success,
            subtitle: 'Latest completed or closed trips for this driver.',
          ),
          const SizedBox(height: AppSpacing.xl),
          const SectionHeader(title: 'Active trips'),
          const SizedBox(height: AppSpacing.sm),
          if (summary.activeTrips.isEmpty)
            const AppEmptyState(
              title: 'No active trip',
              message:
                  'Start and completion controls will appear in the trip operation screen once dispatch opens a trip.',
              icon: Icons.route_outlined,
            )
          else
            ...summary.activeTrips.map(
              (trip) => _TripCard(
                trip,
                onTap: trip.isActive
                    ? () => _showTripManifest(context, trip, onRefresh)
                    : null,
              ),
            ),
          const SizedBox(height: AppSpacing.xl),
          const SectionHeader(title: 'Assigned routes'),
          const SizedBox(height: AppSpacing.sm),
          if (summary.assignments.isEmpty)
            const AppEmptyState(
              title: 'No active assignment',
              message: 'Vehicle and route assignments are managed by dispatch.',
              icon: Icons.directions_bus_outlined,
            )
          else
            ...summary.assignments.map(_AssignmentCard.new),
          if (summary.recentTrips.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xl),
            const SectionHeader(title: 'Recent trip history'),
            const SizedBox(height: AppSpacing.sm),
            ...summary.recentTrips.map((trip) => _TripCard(trip)),
          ],
        ],
      ),
    );
  }
}

class _AssignmentCard extends StatelessWidget {
  const _AssignmentCard(this.assignment);

  final DriverTransportAssignment assignment;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: AppCard(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _IconTile(
              color: assignment.isActive
                  ? AppColors.driverAccent
                  : AppColors.slate400,
              icon: Icons.directions_bus_rounded,
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
                          _assignmentRouteLabel(assignment),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(fontWeight: FontWeight.w800),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      StatusChip(
                        status: assignment.isActive
                            ? AppStatusType.approved
                            : AppStatusType.completed,
                        label: assignment.isActive ? 'Active' : 'Closed',
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    _assignmentVehicleLabel(assignment),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.slate500,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    _assignmentWindow(assignment),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(color: AppColors.slate500),
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

class _TripCard extends StatelessWidget {
  const _TripCard(this.trip, {this.onTap});

  final DriverTransportTrip trip;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final status = _tripStatusType(trip.status);

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: AppCard(
        onTap: onTap,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _IconTile(
              color: trip.isActive ? AppColors.driverAccent : AppColors.success,
              icon: trip.isActive
                  ? Icons.near_me_rounded
                  : Icons.check_circle_rounded,
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
                          _tripRouteLabel(trip),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(fontWeight: FontWeight.w800),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      StatusChip(
                        status: status,
                        label: _titleCase(trip.status),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    '${_titleCase(trip.direction)} - ${_tripVehicleLabel(trip)}',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.slate500,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    _tripWindow(trip),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(color: AppColors.slate500),
                  ),
                  if (trip.isDelayed) ...[
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      _delayLabel(trip),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.warningDark,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                  if (onTap != null) ...[
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      'Tap to open manifest and student actions.',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.driverAccent,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

void _showTripManifest(
  BuildContext context,
  DriverTransportTrip trip,
  Future<void> Function() onDashboardRefresh,
) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (context) {
      return SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.86,
        child: _TripManifestSheet(
          tripId: trip.id,
          onDashboardRefresh: onDashboardRefresh,
        ),
      );
    },
  );
}

class _TripManifestSheet extends ConsumerStatefulWidget {
  const _TripManifestSheet({
    required this.tripId,
    required this.onDashboardRefresh,
  });

  final String tripId;
  final Future<void> Function() onDashboardRefresh;

  @override
  ConsumerState<_TripManifestSheet> createState() => _TripManifestSheetState();
}

class _TripManifestSheetState extends ConsumerState<_TripManifestSheet> {
  String? _busyKey;

  bool get _isBusy => _busyKey != null;

  Future<void> _refreshManifest() async {
    ref.invalidate(driverTripManifestProvider(widget.tripId));
    ref.invalidate(driverTransportDashboardProvider);
    await ref.read(driverTripManifestProvider(widget.tripId).future);
    await widget.onDashboardRefresh();
  }

  Future<void> _markStudent(
    DriverManifestStudent student,
    _DriverStudentAction action,
  ) async {
    final key = '${action.name}:${student.studentId}';
    setState(() => _busyKey = key);
    try {
      final repository = ref.read(driverTransportRepositoryProvider);
      switch (action) {
        case _DriverStudentAction.boarded:
          await repository.markStudentBoarded(widget.tripId, student.studentId);
        case _DriverStudentAction.dropped:
          await repository.markStudentDropped(widget.tripId, student.studentId);
        case _DriverStudentAction.absent:
          await repository.markStudentAbsent(widget.tripId, student.studentId);
      }
      await _refreshManifest();
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${_studentName(student)} marked ${action.label}.'),
        ),
      );
    } catch (_) {
      if (!mounted) {
        return;
      }
      _showDriverActionFailure(
        context,
        'Could not update this student yet. Refresh the manifest and try again.',
      );
    } finally {
      if (mounted) {
        setState(() => _busyKey = null);
      }
    }
  }

  Future<void> _completeTrip() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Complete trip?'),
        content: const Text(
          'This will close the active trip after all current student updates are saved.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Complete'),
          ),
        ],
      ),
    );
    if (confirmed != true) {
      return;
    }

    setState(() => _busyKey = 'complete');
    try {
      await ref
          .read(driverTransportRepositoryProvider)
          .completeTrip(
            widget.tripId,
            notes: 'Completed from mobile driver app',
          );
      ref.invalidate(driverTripManifestProvider(widget.tripId));
      ref.invalidate(driverTransportDashboardProvider);
      await widget.onDashboardRefresh();
      if (!mounted) {
        return;
      }
      Navigator.of(context).pop();
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Trip completed.')));
    } catch (_) {
      if (!mounted) {
        return;
      }
      _showDriverActionFailure(
        context,
        'Could not complete this trip. Check connection and refresh trip status.',
      );
    } finally {
      if (mounted) {
        setState(() => _busyKey = null);
      }
    }
  }

  Future<void> _sendLocationPing() async {
    setState(() => _busyKey = 'location');
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        if (!mounted) {
          return;
        }
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Turn on location services before sending GPS.'),
          ),
        );
        return;
      }

      final permissionGranted = await ref
          .read(permissionServiceProvider)
          .requestLocationPermission();
      if (!permissionGranted) {
        if (!mounted) {
          return;
        }
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Location permission is required for driver GPS.'),
          ),
        );
        return;
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      );
      await ref
          .read(driverTransportRepositoryProvider)
          .recordLocationPing(
            widget.tripId,
            latitude: position.latitude,
            longitude: position.longitude,
            speedKph: _metersPerSecondToKph(position.speed),
            heading: _heading(position.heading),
            recordedAt: DateTime.now().toUtc().toIso8601String(),
          );
      await _refreshManifest();
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('GPS ping sent to transport tracking.')),
      );
    } catch (_) {
      if (!mounted) {
        return;
      }
      _showDriverActionFailure(
        context,
        'GPS was not sent. Location may be out of date until the next successful sync.',
      );
    } finally {
      if (mounted) {
        setState(() => _busyKey = null);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final manifest = ref.watch(driverTripManifestProvider(widget.tripId));

    return manifest.when(
      loading: () => const Padding(
        padding: EdgeInsets.all(AppSpacing.lg),
        child: Column(
          children: [
            AppSkeleton(width: 56, height: 5),
            SizedBox(height: AppSpacing.xl),
            AppSkeleton(width: double.infinity, height: 128),
            SizedBox(height: AppSpacing.md),
            AppSkeleton(width: double.infinity, height: 128),
            SizedBox(height: AppSpacing.md),
            AppSkeleton(width: double.infinity, height: 128),
          ],
        ),
      ),
      error: (error, _) => AppExceptionView(
        error: error,
        onRetry: () =>
            ref.invalidate(driverTripManifestProvider(widget.tripId)),
      ),
      data: (manifest) => _ManifestContent(
        manifest: manifest,
        busyKey: _busyKey,
        isBusy: _isBusy,
        onMarkStudent: _markStudent,
        onCompleteTrip: _completeTrip,
        onSendLocationPing: _sendLocationPing,
      ),
    );
  }
}

void _showDriverActionFailure(BuildContext context, String message) {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
}

class _ManifestContent extends StatelessWidget {
  const _ManifestContent({
    required this.manifest,
    required this.busyKey,
    required this.isBusy,
    required this.onMarkStudent,
    required this.onCompleteTrip,
    required this.onSendLocationPing,
  });

  final DriverTripManifest manifest;
  final String? busyKey;
  final bool isBusy;
  final Future<void> Function(
    DriverManifestStudent student,
    _DriverStudentAction action,
  )
  onMarkStudent;
  final Future<void> Function() onCompleteTrip;
  final Future<void> Function() onSendLocationPing;

  @override
  Widget build(BuildContext context) {
    final boarded = manifest.students
        .where((student) => student.isBoarded)
        .length;
    final dropped = manifest.students
        .where((student) => student.isDropped)
        .length;
    final absent = manifest.students
        .where((student) => student.isAbsent)
        .length;

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.md,
        AppSpacing.lg,
        AppSpacing.xl,
      ),
      children: [
        Center(
          child: Container(
            width: 56,
            height: 5,
            decoration: BoxDecoration(
              color: AppColors.slate300,
              borderRadius: BorderRadius.circular(AppRadius.max),
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _manifestRouteLabel(manifest.route),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    '${_titleCase(manifest.trip.direction)} - ${_manifestVehicleLabel(manifest.vehicle)}',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.slate500,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            StatusChip(
              status: _tripStatusType(manifest.trip.status),
              label: _titleCase(manifest.trip.status),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        AppCard(
          child: Row(
            children: [
              Expanded(
                child: _ManifestMetric(
                  label: 'Boarded',
                  value: boarded.toString(),
                  color: AppColors.driverAccent,
                ),
              ),
              Expanded(
                child: _ManifestMetric(
                  label: 'Dropped',
                  value: dropped.toString(),
                  color: AppColors.success,
                ),
              ),
              Expanded(
                child: _ManifestMetric(
                  label: 'Absent',
                  value: absent.toString(),
                  color: AppColors.warning,
                ),
              ),
            ],
          ),
        ),
        if (manifest.trip.isDelayed) ...[
          const SizedBox(height: AppSpacing.md),
          Text(
            _manifestDelayLabel(manifest.trip),
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: AppColors.warningDark,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
        const SizedBox(height: AppSpacing.xl),
        AppButton(
          label: 'Complete trip',
          icon: Icons.flag_rounded,
          onPressed: manifest.trip.isActive && !isBusy ? onCompleteTrip : null,
          isLoading: busyKey == 'complete',
          backgroundColor: AppColors.success,
        ),
        const SizedBox(height: AppSpacing.md),
        AppButton(
          label: 'Send GPS ping',
          icon: Icons.gps_fixed_rounded,
          variant: AppButtonVariant.outlined,
          onPressed: manifest.trip.isActive && !isBusy
              ? onSendLocationPing
              : null,
          isLoading: busyKey == 'location',
          foregroundColor: AppColors.driverAccent,
        ),
        const SizedBox(height: AppSpacing.xl),
        const SectionHeader(title: 'Student manifest'),
        const SizedBox(height: AppSpacing.sm),
        if (manifest.students.isEmpty)
          const AppEmptyState(
            title: 'No students on manifest',
            message:
                'Student boarding rows will appear after dispatch syncs this trip.',
            icon: Icons.groups_outlined,
          )
        else
          for (final student in manifest.students) ...[
            _ManifestStudentCard(
              student: student,
              busyKey: busyKey,
              isBusy: isBusy,
              onMarkStudent: onMarkStudent,
            ),
            const SizedBox(height: AppSpacing.md),
          ],
      ],
    );
  }
}

class _ManifestMetric extends StatelessWidget {
  const _ManifestMetric({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          value,
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
            color: color,
            fontWeight: FontWeight.w800,
          ),
        ),
        Text(
          label,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: AppColors.slate500,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}

class _ManifestStudentCard extends StatelessWidget {
  const _ManifestStudentCard({
    required this.student,
    required this.busyKey,
    required this.isBusy,
    required this.onMarkStudent,
  });

  final DriverManifestStudent student;
  final String? busyKey;
  final bool isBusy;
  final Future<void> Function(
    DriverManifestStudent student,
    _DriverStudentAction action,
  )
  onMarkStudent;

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
                color: _studentStatusColor(student.status),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _studentName(student),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      _studentManifestMeta(student),
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
                status: _studentStatusType(student.status),
                label: _titleCase(student.status),
              ),
            ],
          ),
          if (medicalNote.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            Text(
              medicalNote,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppColors.warningDark,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              _StudentActionButton(
                label: 'Board',
                icon: Icons.login_rounded,
                isLoading:
                    busyKey ==
                    '${_DriverStudentAction.boarded.name}:${student.studentId}',
                onPressed: isBusy || student.isDropped
                    ? null
                    : () =>
                          onMarkStudent(student, _DriverStudentAction.boarded),
              ),
              _StudentActionButton(
                label: 'Drop',
                icon: Icons.logout_rounded,
                isLoading:
                    busyKey ==
                    '${_DriverStudentAction.dropped.name}:${student.studentId}',
                onPressed: isBusy || student.isDropped
                    ? null
                    : () =>
                          onMarkStudent(student, _DriverStudentAction.dropped),
              ),
              _StudentActionButton(
                label: 'Absent',
                icon: Icons.person_off_rounded,
                isLoading:
                    busyKey ==
                    '${_DriverStudentAction.absent.name}:${student.studentId}',
                onPressed: isBusy || student.isBoarded || student.isDropped
                    ? null
                    : () => onMarkStudent(student, _DriverStudentAction.absent),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StudentActionButton extends StatelessWidget {
  const _StudentActionButton({
    required this.label,
    required this.icon,
    required this.onPressed,
    required this.isLoading,
  });

  final String label;
  final IconData icon;
  final VoidCallback? onPressed;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    return AppButton(
      label: label,
      icon: icon,
      variant: AppButtonVariant.outlined,
      fullWidth: false,
      onPressed: onPressed,
      isLoading: isLoading,
      foregroundColor: AppColors.driverAccent,
    );
  }
}

enum _DriverStudentAction {
  boarded('boarded'),
  dropped('dropped'),
  absent('absent');

  const _DriverStudentAction(this.label);

  final String label;
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

class _DriverDashboardLoading extends StatelessWidget {
  const _DriverDashboardLoading();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: const [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AppSkeleton(width: 180, height: 24),
                SizedBox(height: AppSpacing.sm),
                AppSkeleton(width: 220, height: 14),
              ],
            ),
            AppSkeleton(width: 72, height: 28),
          ],
        ),
        SizedBox(height: AppSpacing.xl),
        AppSkeleton(width: double.infinity, height: 170),
        SizedBox(height: AppSpacing.xl),
        AppSkeleton(width: double.infinity, height: 94),
        SizedBox(height: AppSpacing.md),
        AppSkeleton(width: double.infinity, height: 94),
        SizedBox(height: AppSpacing.md),
        AppSkeleton(width: double.infinity, height: 94),
      ],
    );
  }
}

T? _firstOrNull<T>(Iterable<T> items) {
  final iterator = items.iterator;
  if (!iterator.moveNext()) {
    return null;
  }
  return iterator.current;
}

String _assignmentRouteLabel(DriverTransportAssignment? assignment) {
  if (assignment == null) {
    return 'No route assigned';
  }
  return _routeLabel(assignment.routeCode, assignment.routeName);
}

String _assignmentVehicleLabel(DriverTransportAssignment? assignment) {
  if (assignment == null) {
    return 'No vehicle assigned';
  }
  final model = assignment.vehicleModel?.trim();
  final capacity = assignment.vehicleCapacity > 0
      ? 'Capacity ${assignment.vehicleCapacity}'
      : null;
  return _joinPresent([assignment.vehicleRegistration, ?model, ?capacity]);
}

String _assignmentWindow(DriverTransportAssignment assignment) {
  final starts = _dateTimeLabel(assignment.startsAt);
  final ends = _dateTimeLabel(assignment.endsAt);
  if (starts == 'Not scheduled') {
    return assignment.isActive ? 'Active assignment' : 'Closed assignment';
  }
  if (ends == 'Not scheduled') {
    return 'Started $starts';
  }
  return '$starts - $ends';
}

String _tripRouteLabel(DriverTransportTrip trip) {
  return _routeLabel(trip.routeCode, trip.routeName);
}

String _tripVehicleLabel(DriverTransportTrip trip) {
  final registration = trip.vehicleRegistration?.trim();
  final model = trip.vehicleModel?.trim();
  final capacity = trip.vehicleCapacity > 0
      ? 'Capacity ${trip.vehicleCapacity}'
      : null;
  return _joinPresent([
    ?registration,
    ?model,
    ?capacity,
  ], fallback: 'Vehicle pending');
}

String _tripWindow(DriverTransportTrip trip) {
  final started = _dateTimeLabel(trip.startedAt);
  final completed = _dateTimeLabel(trip.completedAt);
  if (trip.completedAt != null && completed != 'Not scheduled') {
    return 'Started $started - completed $completed';
  }
  if (started == 'Not scheduled') {
    return 'Trip timing pending';
  }
  return 'Started $started';
}

String _routeLabel(String? code, String? name) {
  final routeCode = code?.trim();
  final routeName = name?.trim();
  return _joinPresent([?routeCode, ?routeName], fallback: 'Route pending');
}

String _delayLabel(DriverTransportTrip trip) {
  final minutes = trip.delayMinutes == null ? null : '${trip.delayMinutes} min';
  final reason = trip.delayReason?.trim();
  return _joinPresent(['Delayed', ?minutes, ?reason]);
}

String _manifestRouteLabel(DriverManifestRoute route) {
  return _routeLabel(route.code, route.name);
}

String _manifestVehicleLabel(DriverManifestVehicle vehicle) {
  final registration = vehicle.registrationNumber?.trim();
  final model = vehicle.model?.trim();
  final capacity = vehicle.capacity > 0 ? 'Capacity ${vehicle.capacity}' : null;
  return _joinPresent([
    ?registration,
    ?model,
    ?capacity,
  ], fallback: 'Vehicle pending');
}

String _manifestDelayLabel(DriverManifestTrip trip) {
  final minutes = trip.delayMinutes == null ? null : '${trip.delayMinutes} min';
  final reason = trip.delayReason?.trim();
  return _joinPresent(['Delayed', ?minutes, ?reason]);
}

String _studentName(DriverManifestStudent student) {
  return _joinPresent([
    ?student.name,
    ?student.studentSystemId,
  ], fallback: 'Student');
}

String _studentManifestMeta(DriverManifestStudent student) {
  final roll = student.rollNumber == null ? null : 'Roll ${student.rollNumber}';
  final stop = student.stopName == null ? null : 'Stop ${student.stopName}';
  final sequence = student.stopSequence == null
      ? null
      : 'Seq ${student.stopSequence}';
  final emergency = _joinPresent([
    ?student.emergencyName,
    ?student.emergencyPhone,
  ], fallback: '');
  return _joinPresent([
    ?roll,
    ?stop,
    ?sequence,
    if (emergency.isNotEmpty) 'Emergency $emergency',
  ]);
}

String _studentMedicalNote(DriverManifestStudent student) {
  return _joinPresent([
    ?student.medicalConditions,
    ?student.severeAllergies,
  ], fallback: '');
}

double? _metersPerSecondToKph(double metersPerSecond) {
  if (!metersPerSecond.isFinite || metersPerSecond < 0) {
    return null;
  }
  return metersPerSecond * 3.6;
}

double? _heading(double heading) {
  if (!heading.isFinite || heading < 0) {
    return null;
  }
  return heading;
}

String _joinPresent(List<String> values, {String fallback = 'Unavailable'}) {
  final present = values.where((value) => value.trim().isNotEmpty).toList();
  if (present.isEmpty) {
    return fallback;
  }
  return present.join(' - ');
}

String _dateTimeLabel(String? isoDate) {
  if (isoDate == null || isoDate.trim().isEmpty) {
    return 'Not scheduled';
  }
  final parsed = DateTime.tryParse(isoDate);
  if (parsed == null) {
    return isoDate;
  }
  final hour = parsed.hour.toString().padLeft(2, '0');
  final minute = parsed.minute.toString().padLeft(2, '0');
  return '${_month(parsed.month)} ${parsed.day}, $hour:$minute';
}

String _month(int month) {
  const labels = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  if (month < 1 || month > labels.length) {
    return 'Date';
  }
  return labels[month - 1];
}

Color _studentStatusColor(String status) {
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

AppStatusType _studentStatusType(String status) {
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

AppStatusType _tripStatusType(String status) {
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

String _titleCase(String value) {
  final normalized = value.replaceAll('_', ' ').trim().toLowerCase();
  if (normalized.isEmpty) {
    return 'Pending';
  }
  return normalized
      .split(RegExp(r'\s+'))
      .map((part) => '${part[0].toUpperCase()}${part.substring(1)}')
      .join(' ');
}
