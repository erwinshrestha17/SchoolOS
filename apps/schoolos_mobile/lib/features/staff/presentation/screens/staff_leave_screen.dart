import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/utils/nepali_bs_calendar.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_exception_view.dart';
import '../../../../shared/widgets/app_loading.dart';
import '../../../../shared/widgets/role_shell_scaffold.dart';
import '../../../../shared/widgets/section_header.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../application/staff_providers.dart';
import '../../domain/staff_models.dart';

class StaffLeaveScreen extends ConsumerWidget {
  const StaffLeaveScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final leaveRequests = ref.watch(staffLeaveRequestsProvider);

    return RoleShellScaffold(
      role: 'STAFF',
      selectedIndex: 2,
      title: 'My Leave',
      body: leaveRequests.when(
        loading: () => const AppLoading(message: 'Loading leave requests...'),
        error: (error, _) => AppExceptionView(
          error: error,
          onRetry: () => ref.invalidate(staffLeaveRequestsProvider),
        ),
        data: (requests) => RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(staffLeaveRequestsProvider);
            await ref.read(staffLeaveRequestsProvider.future);
          },
          child: requests.isEmpty
              ? ListView(
                  children: const [
                    SizedBox(height: AppSpacing.xxxl),
                    AppEmptyState(
                      title: 'No leave requests',
                      message:
                          'Approved, pending, and rejected leave requests will appear here.',
                      icon: Icons.edit_calendar_outlined,
                    ),
                  ],
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  itemCount: requests.length + 1,
                  separatorBuilder: (_, index) => index == 0
                      ? const SizedBox(height: AppSpacing.sm)
                      : const SizedBox(height: AppSpacing.md),
                  itemBuilder: (context, index) {
                    if (index == 0) {
                      return const SectionHeader(title: 'Leave Requests');
                    }
                    return _LeaveRequestCard(request: requests[index - 1]);
                  },
                ),
        ),
      ),
    );
  }
}

class _LeaveRequestCard extends StatelessWidget {
  const _LeaveRequestCard({required this.request});

  final StaffLeaveRequest request;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.staffAccent.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.beach_access_outlined,
                  color: AppColors.staffAccent,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _label(request.leaveType),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${_formatDate(request.startsOn)} - ${_formatDate(request.endsOn)}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.slate500,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              StatusChip(
                status: _status(request.status),
                label: _label(request.status),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            '${request.days.toStringAsFixed(request.days.truncateToDouble() == request.days ? 0 : 1)} day${request.days == 1 ? '' : 's'}',
            style: const TextStyle(
              color: AppColors.slate700,
              fontWeight: FontWeight.w700,
            ),
          ),
          if (request.reason.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              request.reason,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: AppColors.slate500, fontSize: 12),
            ),
          ],
        ],
      ),
    );
  }
}

AppStatusType _status(String status) {
  switch (status.toUpperCase()) {
    case 'APPROVED':
      return AppStatusType.approved;
    case 'REJECTED':
    case 'CANCELLED':
      return AppStatusType.rejected;
    case 'DRAFT':
      return AppStatusType.draft;
    case 'PENDING':
    default:
      return AppStatusType.pending;
  }
}

String _label(String value) {
  return value
      .split('_')
      .map(
        (part) => part.isEmpty
            ? part
            : '${part[0].toUpperCase()}${part.substring(1).toLowerCase()}',
      )
      .join(' ');
}

String _formatDate(DateTime value) {
  return NepaliBsCalendar.formatBsDate(value);
}
