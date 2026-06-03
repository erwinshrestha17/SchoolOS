import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_provider.dart';
import '../data/driver_transport_repository.dart';
import '../domain/driver_transport_models.dart';

final driverTransportRepositoryProvider = Provider<DriverTransportRepository>((
  ref,
) {
  return DriverTransportRepository(ref.watch(apiClientProvider));
});

final driverTransportDashboardProvider =
    FutureProvider<DriverTransportDashboard>((ref) {
      return ref.watch(driverTransportRepositoryProvider).getDriverDashboard();
    });

final driverTripManifestProvider =
    FutureProvider.family<DriverTripManifest, String>((ref, tripId) {
      return ref
          .watch(driverTransportRepositoryProvider)
          .getDriverTripManifest(tripId);
    });

final driverTripHistoryProvider = FutureProvider<List<DriverTransportTrip>>((
  ref,
) {
  return ref.watch(driverTransportRepositoryProvider).listDriverTripHistory();
});
