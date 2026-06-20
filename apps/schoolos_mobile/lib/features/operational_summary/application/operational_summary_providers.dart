import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_provider.dart';
import '../data/operational_summary_repository.dart';
import '../domain/operational_summary_models.dart';

final operationalSummaryRepositoryProvider =
    Provider<OperationalSummaryRepository>((ref) {
  return OperationalSummaryRepository(ref.watch(apiClientProvider));
});

final operationalSummaryProvider = FutureProvider.autoDispose
    .family<OperationalMobileSummary, OperationalMobilePersona>((ref, persona) {
  return ref.watch(operationalSummaryRepositoryProvider).getSummary(persona);
});
