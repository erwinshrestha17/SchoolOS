import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_provider.dart';
import '../data/staff_repository.dart';
import '../domain/staff_models.dart';

final staffRepositoryProvider = Provider<StaffRepository>((ref) {
  return StaffRepository(ref.watch(apiClientProvider));
});

// autoDispose: staff self-service reads are user/tenant-sensitive. Without
// it, these providers stay cached in the root ProviderContainer after
// logout, so a same-device account switch (login as a different staff
// member without a full app restart) could briefly show the previous
// user's cached attendance/leave/payslip data before a manual refetch.
// autoDispose lets Riverpod drop the cache once the authenticated screens
// that watch them unmount, matching the convention already used by
// attendance/principal/notices/parent/teacher providers.
final staffProfileProvider = FutureProvider.autoDispose<StaffProfile>((ref) {
  return ref.watch(staffRepositoryProvider).getProfile();
});

final staffAttendanceProvider =
    FutureProvider.autoDispose<List<StaffAttendanceRecord>>((ref) {
      return ref.watch(staffRepositoryProvider).getAttendance();
    });

final staffLeaveRequestsProvider =
    FutureProvider.autoDispose<List<StaffLeaveRequest>>((ref) {
      return ref.watch(staffRepositoryProvider).getLeaveRequests();
    });

final staffPayslipsProvider = FutureProvider.autoDispose<List<StaffPayslip>>((
  ref,
) {
  return ref.watch(staffRepositoryProvider).getPayslips();
});
