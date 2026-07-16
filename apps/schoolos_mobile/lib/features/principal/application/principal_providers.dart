import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_provider.dart';
import '../../../core/network/connectivity_provider.dart';
import '../data/principal_repository.dart';

final principalRepositoryProvider = Provider<PrincipalRepository>((ref) {
  return PrincipalRepository(ref.watch(apiClientProvider));
});

final principalDashboardProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
      final repository = ref.watch(principalRepositoryProvider);
      final isOnline = ref.watch(connectivityProvider);
      return withConnectivityMeta(await repository.getDashboard(), isOnline);
    });

final principalAttentionProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, String>((ref, filter) async {
      final isOnline = ref.watch(connectivityProvider);
      return withConnectivityMeta(
        await ref
            .watch(principalRepositoryProvider)
            .getAttention(filter: filter),
        isOnline,
      );
    });

final principalApprovalsProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, String>((ref, status) async {
      final isOnline = ref.watch(connectivityProvider);
      return withConnectivityMeta(
        await ref
            .watch(principalRepositoryProvider)
            .getApprovals(status: status),
        isOnline,
      );
    });

final principalEscalationsProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, String>((ref, status) async {
      final isOnline = ref.watch(connectivityProvider);
      return withConnectivityMeta(
        await ref
            .watch(principalRepositoryProvider)
            .getEscalations(status: status),
        isOnline,
      );
    });

final principalStudentSearchProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, String>((ref, query) async {
      final isOnline = ref.watch(connectivityProvider);
      return withConnectivityMeta(
        await ref
            .watch(principalRepositoryProvider)
            .searchStudents(query: query.trim().isEmpty ? null : query.trim()),
        isOnline,
      );
    });

final principalSnapshotProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, String>((ref, key) async {
      final repository = ref.watch(principalRepositoryProvider);
      final isOnline = ref.watch(connectivityProvider);
      final data = switch (key) {
        'admissions' => await repository.getAdmissionsSummary(),
        'attendance' => await repository.getAttendanceSummary(),
        'staff' => await repository.getStaffAbsence(),
        'fees' => await repository.getFeesSummary(),
        'academics' => await repository.getAcademicsReadiness(),
        'transport' => await repository.getTransportAlerts(),
        'escalations' => await repository.getEscalations(),
        'reports' => await repository.getReportsSnapshot(),
        'tasks' => await repository.getTasks(),
        'walkthroughs' => await repository.getClassroomWalkthroughs(),
        'notice' => await repository.getEmergencyNotice(),
        _ => await repository.getDashboard(),
      };
      return withConnectivityMeta(data, isOnline);
    });

Map<String, dynamic> withConnectivityMeta(
  Map<String, dynamic> data,
  bool isOnline,
) {
  return {
    ...data,
    '_mobileFromCache': data['_mobileFromCache'] == true || !isOnline,
  };
}
