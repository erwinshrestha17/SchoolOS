import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/utils/nepali_bs_calendar.dart';
import '../../application/parent_providers.dart';
import '../../domain/parent_models.dart';
import '../widgets/parent_detail_widgets.dart';
import '../widgets/parent_portal_widgets.dart';

class ParentTransportScreen extends ConsumerWidget {
  const ParentTransportScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(parentControllerProvider);
    final controller = ref.read(parentControllerProvider.notifier);
    final child = state.selectedChild;

    return ParentDetailScaffold(
      title: 'Transport',
      selectedIndex: 5,
      body: switch (state.status) {
        ParentDataStatus.loading => const PortalLoadingState(),
        ParentDataStatus.success when child != null => RefreshIndicator(
          onRefresh: controller.load,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
            children: [
              ParentApiChildSelector(
                child: child,
                children: state.children,
                onChanged: controller.selectChild,
              ),
              const SizedBox(height: 14),
              _TransportBody(childId: child.id),
            ],
          ),
        ),
        _ => PortalErrorState(onRetry: controller.load),
      },
    );
  }
}

class _TransportBody extends ConsumerWidget {
  const _TransportBody({required this.childId});

  final String childId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final transport = ref.watch(parentTransportProvider(childId));
    return transport.when(
      loading: () => const PortalLoadingState(),
      error: (_, _) => PortalErrorState(
        onRetry: () => ref.invalidate(parentTransportProvider(childId)),
      ),
      data: (info) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _RouteCard(info: info),
          const SizedBox(height: 14),
          _TripCard(info: info),
          const SizedBox(height: 14),
          const PortalCard(
            color: ParentPortalColors.blueSoft,
            padding: EdgeInsets.all(12),
            child: Row(
              children: [
                Icon(
                  Icons.info_outline_rounded,
                  color: ParentPortalColors.blue,
                ),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Live GPS and ETA are shown only when the assigned trip publishes a latest location.',
                    style: TextStyle(color: ParentPortalColors.muted),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _RouteCard extends StatelessWidget {
  const _RouteCard({required this.info});

  final ParentTransportInfo info;

  @override
  Widget build(BuildContext context) {
    return PortalCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const FeatureIcon(Icons.directions_bus_rounded),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  info.routeName ?? info.routeCode ?? 'No route assigned',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(child: _RouteMetric('Stop', info.stopName ?? 'Not set')),
              Expanded(
                child: _RouteMetric(
                  'Assignment',
                  info.assignmentStatus ?? info.enrollmentStatus ?? 'None',
                ),
              ),
              Expanded(
                child: _RouteMetric(
                  'Direction',
                  info.pickupDirection ?? info.tripDirection ?? '-',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _TripCard extends StatelessWidget {
  const _TripCard({required this.info});

  final ParentTransportInfo info;

  @override
  Widget build(BuildContext context) {
    if (!info.hasActiveTrip) {
      return const PortalCard(
        child: Text('Trip not started. No active trip is available right now.'),
      );
    }

    return PortalCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const FeatureIcon(
                Icons.route_rounded,
                color: ParentPortalColors.green,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      info.tripStatus ?? 'Active trip',
                      style: const TextStyle(
                        color: ParentPortalColors.green,
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    Text(
                      info.vehicleLabel ?? 'Vehicle details unavailable',
                      style: const TextStyle(color: ParentPortalColors.muted),
                    ),
                  ],
                ),
              ),
              StatusBadge(
                label: info.studentStatus ?? 'Trip active',
                color: info.isDelayed
                    ? ParentPortalColors.orange
                    : ParentPortalColors.green,
                background: info.isDelayed
                    ? ParentPortalColors.orangeSoft
                    : ParentPortalColors.greenSoft,
              ),
            ],
          ),
          const Divider(height: 24),
          if (info.isDelayed)
            Text(
              'Delayed ${info.delayMinutes} min${info.delayReason == null ? '' : ': ${info.delayReason}'}',
              style: const TextStyle(
                color: ParentPortalColors.orange,
                fontWeight: FontWeight.w800,
              ),
            ),
          if (info.hasLatestLocation) ...[
            const SizedBox(height: 8),
            Text(
              _gpsStatus(info),
              style: TextStyle(
                color: info.isLocationStale || info.isLocationDelayed
                    ? ParentPortalColors.orange
                    : ParentPortalColors.green,
                fontWeight: FontWeight.w800,
              ),
            ),
            Text(
              _lastUpdated(info),
              style: const TextStyle(color: ParentPortalColors.muted),
            ),
            if (info.latitude != null && info.longitude != null)
              Text(
                '${info.latitude}, ${info.longitude}',
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
          ] else
            const Text(
              'GPS unavailable. No location has been published for this trip.',
              style: TextStyle(color: ParentPortalColors.muted),
            ),
        ],
      ),
    );
  }
}

class _RouteMetric extends StatelessWidget {
  const _RouteMetric(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        label,
        style: const TextStyle(fontSize: 11, color: ParentPortalColors.muted),
      ),
      Text(
        value,
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(fontWeight: FontWeight.w900),
      ),
    ],
  );
}

String _lastUpdated(ParentTransportInfo info) {
  final ageMinutes = info.locationAgeMinutes;
  if (ageMinutes != null) {
    if (ageMinutes < 1) return 'Last updated less than a minute ago';
    return 'Last updated $ageMinutes minute${ageMinutes == 1 ? '' : 's'} ago';
  }

  final value = info.latestLocationAt;
  final date = DateTime.tryParse(value ?? '');
  if (date == null) return 'time unavailable';
  return 'Last updated ${NepaliBsCalendar.formatBsDateTime(date)}';
}

String _gpsStatus(ParentTransportInfo info) {
  if (info.isLocationStale) return 'GPS is stale';
  if (info.isLocationDelayed) return 'GPS update delayed';
  return 'GPS updated';
}
