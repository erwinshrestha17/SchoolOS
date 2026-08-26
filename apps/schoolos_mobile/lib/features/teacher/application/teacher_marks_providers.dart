import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_provider.dart';
import '../../../core/sync/school_authority_discovery.dart';
import '../data/teacher_marks_repository.dart';

final teacherMarksRepositoryProvider = Provider<TeacherMarksRepository>((ref) {
  return TeacherMarksRepository(
    ref.watch(apiClientProvider),
    authorityDiscovery: ref.watch(schoolAuthorityDiscoveryProvider),
  );
});

final teacherAssessmentComponentsProvider =
    FutureProvider.autoDispose<List<TeacherAssessmentComponent>>((ref) {
      return ref.watch(teacherMarksRepositoryProvider).listComponents();
    });

final teacherComponentMarksProvider = FutureProvider.autoDispose
    .family<List<TeacherMarkEntry>, TeacherAssessmentComponent>((
      ref,
      component,
    ) {
      return ref
          .watch(teacherMarksRepositoryProvider)
          .listMarks(
            assessmentComponentId: component.id,
            classId: component.classId,
            examTermId: component.examTermId,
          );
    });
