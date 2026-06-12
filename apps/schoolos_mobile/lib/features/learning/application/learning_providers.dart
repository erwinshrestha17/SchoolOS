import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_provider.dart';
import '../data/learning_repository.dart';
import '../domain/learning_summary_models.dart';

final learningRepositoryProvider = Provider<LearningRepository>((ref) {
  return LearningRepository(ref.watch(apiClientProvider));
});

final parentLearningSummariesProvider =
    FutureProvider.family<List<LearningSummary>, String?>((ref, studentId) {
      return ref
          .watch(learningRepositoryProvider)
          .getParentLearningSummaries(studentId: studentId);
    });

final studentLearningSummaryProvider =
    FutureProvider.family<LearningSummary, String>((ref, studentId) {
      return ref
          .watch(learningRepositoryProvider)
          .getStudentLearningSummary(studentId);
    });
