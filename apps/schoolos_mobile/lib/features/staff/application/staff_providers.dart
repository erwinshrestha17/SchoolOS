import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_provider.dart';
import '../data/staff_repository.dart';
import '../domain/staff_models.dart';

final staffRepositoryProvider = Provider<StaffRepository>((ref) {
  return StaffRepository(ref.watch(apiClientProvider));
});

final staffProfileProvider = FutureProvider<StaffProfile>((ref) {
  return ref.watch(staffRepositoryProvider).getProfile();
});

final staffAttendanceProvider = FutureProvider<List<StaffAttendanceRecord>>((
  ref,
) {
  return ref.watch(staffRepositoryProvider).getAttendance();
});

final staffLeaveRequestsProvider = FutureProvider<List<StaffLeaveRequest>>((
  ref,
) {
  return ref.watch(staffRepositoryProvider).getLeaveRequests();
});

final staffPayslipsProvider = FutureProvider<List<StaffPayslip>>((ref) {
  return ref.watch(staffRepositoryProvider).getPayslips();
});
