import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/parent_portal_mock_repository.dart';
import '../domain/parent_portal_models.dart';

final parentPortalRepositoryProvider = Provider<ParentPortalMockRepository>(
  (ref) => const ParentPortalMockRepository(),
);

final parentPortalDataProvider = FutureProvider<ParentPortalData>((ref) {
  return ref.watch(parentPortalRepositoryProvider).load();
});
