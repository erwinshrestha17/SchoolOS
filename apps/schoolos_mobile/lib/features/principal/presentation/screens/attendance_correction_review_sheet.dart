import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../../../core/auth/auth_provider.dart';
import '../../../../core/errors/app_exception.dart';
import '../../../../core/network/connectivity_provider.dart';
import '../../../../shared/widgets/app_exception_view.dart';
import '../../application/principal_providers.dart';
import '../../domain/attendance_correction_detail.dart';

final principalCorrectionDetailProvider = FutureProvider.autoDispose
    .family<AttendanceCorrectionDetail, String>((ref, id) {
      final user = ref.watch(authProvider).user;
      if (user == null) throw const SessionExpiredException();
      if (!ref.watch(connectivityProvider)) throw const NetworkException();
      return ref.watch(principalRepositoryProvider).getAttendanceCorrection(id);
    });

class AttendanceCorrectionReviewSheet extends ConsumerStatefulWidget {
  const AttendanceCorrectionReviewSheet({super.key, required this.requestId});
  final String requestId;
  @override
  ConsumerState<AttendanceCorrectionReviewSheet> createState() =>
      _AttendanceCorrectionReviewSheetState();
}

class _AttendanceCorrectionReviewSheetState
    extends ConsumerState<AttendanceCorrectionReviewSheet> {
  final _reason = TextEditingController();
  bool _saving = false;
  bool _requiresRefresh = false;
  String? _message;
  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    final online = ref.watch(connectivityProvider);
    final provider = principalCorrectionDetailProvider(widget.requestId);
    final detail = ref.watch(provider);
    void refresh() {
      setState(() {
        _requiresRefresh = false;
        _message = null;
      });
      ref.invalidate(provider);
    }

    return PopScope(
      canPop: !_saving,
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          AppSpacing.lg,
          AppSpacing.lg,
          AppSpacing.lg,
          MediaQuery.viewInsetsOf(context).bottom + AppSpacing.lg,
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Review attendance correction',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: AppSpacing.md),
              if (user == null)
                const AppExceptionView(error: SessionExpiredException())
              else
                detail.when(
                  skipLoadingOnRefresh: false,
                  skipLoadingOnReload: false,
                  skipError: false,
                  loading: () =>
                      const Center(child: CircularProgressIndicator()),
                  error: (error, _) =>
                      AppExceptionView(error: error, onRetry: refresh),
                  data: (data) {
                    final independent =
                        data.requestedById != user.id &&
                        data.markedById != user.id;
                    final permitted = user.permissions.contains(
                      'attendance:review_conflicts',
                    );
                    final canDecide =
                        online &&
                        independent &&
                        permitted &&
                        data.status == 'PENDING' &&
                        !_requiresRefresh;
                    Future<void> decide(String status) async {
                      if (_saving || !canDecide) return;
                      final reason = _reason.text.trim();
                      if (reason.isEmpty || reason.length > 500) {
                        setState(
                          () => _message =
                              'Enter a decision reason of up to 500 characters.',
                        );
                        return;
                      }
                      final identity = '${user.tenantId}:${user.id}';
                      setState(() {
                        _saving = true;
                        _message = null;
                      });
                      try {
                        await ref
                            .read(principalRepositoryProvider)
                            .reviewAttendanceCorrection(
                              id: data.id,
                              status: status,
                              reason: reason,
                            );
                        if (!mounted) return;
                        final current = ref.read(authProvider).user;
                        if ('${current?.tenantId}:${current?.id}' != identity) {
                          return;
                        }
                        for (final tab in ['pending', 'approved', 'rejected']) {
                          ref.invalidate(principalApprovalsProvider(tab));
                        }
                        ref.invalidate(principalDashboardProvider);
                        ref.invalidate(principalAttentionProvider('all'));
                        if (context.mounted) Navigator.pop(context, true);
                      } catch (error) {
                        if (!mounted) return;
                        setState(() {
                          _requiresRefresh = true;
                          _message = error is ValidationException
                              ? error.message
                              : 'Decision not confirmed. Refresh the current request before trying again.';
                        });
                      } finally {
                        if (mounted) setState(() => _saving = false);
                      }
                    }

                    String label(String value) =>
                        value.toLowerCase().replaceAll('_', ' ');
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          data.studentName,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        Text('${data.date} (AD) · ${label(data.status)}'),
                        const SizedBox(height: AppSpacing.md),
                        Text(
                          'Current attendance: ${label(data.currentStatus)}',
                        ),
                        Text(
                          'Requested attendance: ${label(data.requestedStatus)}',
                        ),
                        Text('Request reason: ${data.reason}'),
                        const SizedBox(height: AppSpacing.md),
                        if (!online)
                          const Text('Reconnect to review this correction.')
                        else if (!permitted)
                          const Text(
                            'Attendance review permission is required.',
                          )
                        else if (!independent)
                          const Text(
                            'An independent reviewer must decide this request.',
                          )
                        else if (data.status != 'PENDING')
                          const Text(
                            'This request has already been decided or cancelled.',
                          ),
                        if (canDecide) ...[
                          TextField(
                            controller: _reason,
                            enabled: !_saving,
                            minLines: 2,
                            maxLines: 4,
                            maxLength: 500,
                            decoration: const InputDecoration(
                              labelText: 'Decision reason',
                              helperText:
                                  'Required for approval and rejection. School policy may require a minimum length.',
                            ),
                          ),
                          const Text(
                            'Approve changes the official attendance to the requested status. Reject keeps the current attendance.',
                          ),
                          const SizedBox(height: AppSpacing.md),
                          Wrap(
                            spacing: AppSpacing.md,
                            runSpacing: AppSpacing.sm,
                            children: [
                              OutlinedButton(
                                onPressed: _saving
                                    ? null
                                    : () => decide('REJECTED'),
                                child: const Text('Reject correction'),
                              ),
                              FilledButton(
                                onPressed: _saving
                                    ? null
                                    : () => decide('APPROVED'),
                                child: Text(
                                  _saving
                                      ? 'Submitting…'
                                      : 'Approve correction',
                                ),
                              ),
                            ],
                          ),
                        ],
                        if (_message != null)
                          Semantics(liveRegion: true, child: Text(_message!)),
                        if (_requiresRefresh)
                          TextButton(
                            onPressed: _saving ? null : refresh,
                            child: const Text('Refresh request'),
                          ),
                      ],
                    );
                  },
                ),
              TextButton(
                onPressed: _saving ? null : () => Navigator.pop(context),
                child: const Text('Close'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
