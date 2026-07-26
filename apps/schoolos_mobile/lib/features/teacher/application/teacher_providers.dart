import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_provider.dart';
import '../../../core/network/connectivity_provider.dart';
import '../../../core/storage/private_read_cache.dart';
import '../data/teacher_repository.dart';
import '../domain/teacher_models.dart';
import '../../learning_support/domain/learning_support_models.dart';

final teacherRepositoryProvider = Provider<TeacherRepository>((ref) {
  return TeacherRepository(
    ref.watch(apiClientProvider),
    cache: ref.watch(privateReadCacheProvider),
  );
});

final teacherNoticeSummaryProvider =
    FutureProvider.autoDispose<TeacherNoticeSummary>((ref) async {
      return ref.watch(teacherRepositoryProvider).getNoticeSummary();
    });

class TeacherLearningSupportQuery {
  const TeacherLearningSupportQuery({
    required this.studentId,
    required this.academicYearId,
    required this.classId,
    this.sectionId,
  });

  final String studentId;
  final String academicYearId;
  final String classId;
  final String? sectionId;

  @override
  bool operator ==(Object other) =>
      other is TeacherLearningSupportQuery &&
      other.studentId == studentId &&
      other.academicYearId == academicYearId &&
      other.classId == classId &&
      other.sectionId == sectionId;

  @override
  int get hashCode =>
      Object.hash(studentId, academicYearId, classId, sectionId);
}

final teacherLearningSupportProvider = FutureProvider.autoDispose
    .family<TeacherStudentLearningSupport, TeacherLearningSupportQuery>((
      ref,
      query,
    ) {
      return ref
          .watch(teacherRepositoryProvider)
          .getStudentLearningSupport(
            studentId: query.studentId,
            academicYearId: query.academicYearId,
            classId: query.classId,
            sectionId: query.sectionId,
          );
    });

final teacherHomeworkProvider = FutureProvider.autoDispose
    .family<TeacherHomeworkSnapshot, TeacherHomeworkQuery>((ref, query) async {
      final snapshot = await ref
          .watch(teacherRepositoryProvider)
          .getHomework(
            status: query.status,
            classId: query.classId,
            sectionId: query.sectionId,
            subjectId: query.subjectId,
          );
      final isOnline = ref.watch(connectivityProvider);
      return TeacherHomeworkSnapshot(
        items: snapshot.items,
        scopes: snapshot.scopes,
        total: snapshot.total,
        lastUpdated: snapshot.lastUpdated,
        fromCache: snapshot.fromCache || !isOnline,
      );
    });

final teacherHomeworkSubmissionsProvider = FutureProvider.autoDispose
    .family<List<TeacherHomeworkSubmission>, String>((ref, homeworkId) {
      return ref
          .watch(teacherRepositoryProvider)
          .getHomeworkSubmissions(homeworkId);
    });

final teacherActivityProvider =
    FutureProvider.autoDispose<TeacherActivitySnapshot>((ref) async {
      final snapshot = await ref.watch(teacherRepositoryProvider).getActivity();
      final isOnline = ref.watch(connectivityProvider);
      return TeacherActivitySnapshot(
        scopes: snapshot.scopes,
        posts: snapshot.posts,
        lastUpdated: snapshot.lastUpdated,
        fromCache: snapshot.fromCache || !isOnline,
      );
    });

final teacherTimetableProvider =
    FutureProvider.autoDispose<TeacherTimetableSnapshot>((ref) async {
      final snapshot = await ref
          .watch(teacherRepositoryProvider)
          .getTimetable();
      final isOnline = ref.watch(connectivityProvider);
      return TeacherTimetableSnapshot(
        rangeStart: snapshot.rangeStart,
        rangeEnd: snapshot.rangeEnd,
        items: snapshot.items,
        substitutions: snapshot.substitutions,
        lastUpdated: snapshot.lastUpdated,
        fromCache: snapshot.fromCache || !isOnline,
      );
    });
