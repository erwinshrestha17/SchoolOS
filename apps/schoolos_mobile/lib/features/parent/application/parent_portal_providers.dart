import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_provider.dart';
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

final parentPortalDataProvider = FutureProvider<ParentPortalData>((ref) {
  return ref.watch(parentPortalRepositoryProvider).load();
});
