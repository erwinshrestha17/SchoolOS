import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_provider.dart';
import '../../../core/storage/app_preferences_service.dart';
import '../../notices/application/notices_providers.dart';
import '../data/parent_portal_repository.dart';
import '../domain/parent_portal_models.dart';
import 'parent_providers.dart';

final parentPortalRepositoryProvider = Provider<ParentPortalRepository>((ref) {
  final user = ref.watch(authProvider).user;
  return ParentPortalRepository(
    parentRepository: ref.watch(parentRepositoryProvider),
    noticesRepository: ref.watch(noticesRepositoryProvider),
    parentName: user?.name ?? 'Parent',
    schoolName: user?.tenantSlug ?? 'Your school',
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
