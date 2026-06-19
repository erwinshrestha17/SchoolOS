import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_provider.dart';
import '../../../core/network/connectivity_provider.dart';
import '../../../core/storage/private_read_cache.dart';
import '../data/teacher_repository.dart';
import '../domain/teacher_models.dart';

final teacherRepositoryProvider = Provider<TeacherRepository>((ref) {
  return TeacherRepository(
    ref.watch(apiClientProvider),
    cache: ref.watch(privateReadCacheProvider),
  );
});

final teacherMessagesProvider =
    FutureProvider.autoDispose<TeacherMessagesSnapshot>((ref) async {
      final repository = ref.watch(teacherRepositoryProvider);
      final snapshot = await repository.getMessages();
      final isOnline = ref.watch(connectivityProvider);
      return TeacherMessagesSnapshot(
        threads: snapshot.threads,
        availability: snapshot.availability,
        lastUpdated: snapshot.lastUpdated,
        fromCache: snapshot.fromCache || !isOnline,
      );
    });

final teacherNoticeSummaryProvider =
    FutureProvider.autoDispose<TeacherNoticeSummary>((ref) async {
      return ref.watch(teacherRepositoryProvider).getNoticeSummary();
    });

final teacherMessageDetailProvider = FutureProvider.autoDispose
    .family<TeacherMessageDetail, String>((ref, threadId) async {
      return ref.watch(teacherRepositoryProvider).getMessageDetail(threadId);
    });
