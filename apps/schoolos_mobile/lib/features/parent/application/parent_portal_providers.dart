import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_provider.dart';
import '../../../core/storage/app_preferences_service.dart';
import '../../../core/storage/private_read_cache.dart';
import '../../notices/application/notices_providers.dart';
import '../data/parent_dashboard_snapshot_store.dart';
import '../data/parent_portal_repository.dart';
import '../domain/parent_portal_models.dart';
import 'parent_providers.dart';

/// The offline store for Today, scoped to the signed-in guardian.
///
/// Null while signed out or before the tenant is known, so a snapshot can
/// never be written or read without an identity to bind it to. It is rebuilt
/// whenever auth changes, which is what makes a user or tenant switch drop
/// the previous identity rather than inherit it.
final parentDashboardSnapshotStoreProvider =
    Provider<ParentDashboardSnapshotStore?>((ref) {
      final user = ref.watch(authProvider).user;
      if (user == null) return null;
      final identity = ParentDashboardSnapshotIdentity(
        tenantId: user.tenantId ?? '',
        guardianId: user.id,
      );
      if (!identity.isValid) return null;
      return ParentDashboardSnapshotStore(
        cache: ref.watch(privateReadCacheProvider),
        identity: identity,
      );
    });

final parentPortalRepositoryProvider = Provider<ParentPortalRepository>((ref) {
  final user = ref.watch(authProvider).user;
  return ParentPortalRepository(
    parentRepository: ref.watch(parentRepositoryProvider),
    noticesRepository: ref.watch(noticesRepositoryProvider),
    parentName: user?.name ?? 'Parent',
    schoolName: user?.tenantName ?? user?.tenantSlug ?? 'Your school',
    snapshots: ref.watch(parentDashboardSnapshotStoreProvider),
  );
});

final parentActiveChildIdProvider = StateProvider.autoDispose<String?>(
  (ref) => null,
);

final parentPortalDataProvider = FutureProvider.autoDispose<ParentPortalData>((
  ref,
) {
  final selectedChildId = ref.watch(parentActiveChildIdProvider);
  final persistedChildId = ref
      .watch(appPreferencesServiceProvider)
      .getSelectedChildId();
  return ref
      .watch(parentPortalRepositoryProvider)
      .load(activeChildId: selectedChildId ?? persistedChildId);
});
