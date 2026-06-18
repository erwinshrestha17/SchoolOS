import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../features/parent/presentation/widgets/parent_detail_widgets.dart';
import '../../../../features/parent/presentation/widgets/parent_portal_widgets.dart';
import '../../application/notices_providers.dart';
import '../../domain/notice_models.dart';

class NoticeDetailScreen extends ConsumerWidget {
  const NoticeDetailScreen({super.key, required this.noticeId});

  final String noticeId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(noticeDetailProvider(noticeId));
    return ParentDetailScaffold(
      title: 'Notice',
      selectedIndex: 3,
      body: detail.when(
        loading: () => const PortalLoadingState(),
        error: (_, _) => PortalErrorState(
          onRetry: () => ref.invalidate(noticeDetailProvider(noticeId)),
        ),
        data: (notice) => ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
          children: [
            PortalCard(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  FeatureIcon(
                    _categoryIcon(notice.category),
                    color: notice.isEmergency
                        ? ParentPortalColors.red
                        : ParentPortalColors.purple,
                    size: 66,
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          notice.title,
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                            color: ParentPortalColors.navy,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            StatusBadge(
                              label: notice.audience,
                              icon: Icons.groups_rounded,
                            ),
                            StatusBadge(
                              label: _categoryLabel(notice.category),
                              color: notice.isEmergency
                                  ? ParentPortalColors.red
                                  : ParentPortalColors.purple,
                              background: notice.isEmergency
                                  ? ParentPortalColors.redSoft
                                  : ParentPortalColors.purpleSoft,
                              icon: Icons.bookmark_rounded,
                            ),
                            StatusBadge(
                              label: notice.isRead ? 'Read' : 'Unread',
                              color: notice.isRead
                                  ? ParentPortalColors.green
                                  : ParentPortalColors.orange,
                              background: notice.isRead
                                  ? ParentPortalColors.greenSoft
                                  : ParentPortalColors.orangeSoft,
                              icon: notice.isRead
                                  ? Icons.done_all_rounded
                                  : Icons.schedule_rounded,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            PortalCard(
              color: ParentPortalColors.greenSoft,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const FeatureIcon(
                    Icons.campaign_rounded,
                    color: ParentPortalColors.green,
                    size: 42,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      '${notice.publishedBy} • ${_formatDate(notice.publishedAt)}',
                      style: const TextStyle(
                        color: ParentPortalColors.green,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            PortalCard(
              child: Text(
                notice.body.isEmpty ? notice.preview : notice.body,
                style: const TextStyle(
                  fontSize: 17,
                  height: 1.6,
                  color: ParentPortalColors.navy,
                ),
              ),
            ),
            if (notice.hasAttachment) ...[
              const SizedBox(height: 18),
              const ParentSectionHeader(title: 'Attachment'),
              const SizedBox(height: 8),
              PortalCard(
                onTap: () => _attachmentUnavailable(context),
                child: const Row(
                  children: [
                    FeatureIcon(
                      Icons.picture_as_pdf_rounded,
                      color: ParentPortalColors.red,
                    ),
                    SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Protected attachment download is not available in this mobile screen yet.',
                        style: TextStyle(color: ParentPortalColors.muted),
                      ),
                    ),
                    ListChevron(),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 18),
            PortalCard(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  FeatureIcon(
                    Icons.lock_outline_rounded,
                    color: ParentPortalColors.orange,
                    size: 42,
                  ),
                  SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Sharing and file actions require purpose-limited mobile endpoints before they can be enabled.',
                      style: TextStyle(color: ParentPortalColors.muted),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  IconData _categoryIcon(NoticeCategory category) {
    return switch (category) {
      NoticeCategory.emergency => Icons.warning_rounded,
      NoticeCategory.academic => Icons.school_rounded,
      NoticeCategory.fee => Icons.receipt_long_rounded,
      NoticeCategory.transport => Icons.directions_bus_rounded,
      NoticeCategory.homework => Icons.assignment_rounded,
      NoticeCategory.approval => Icons.verified_user_rounded,
      _ => Icons.campaign_rounded,
    };
  }

  String _categoryLabel(NoticeCategory category) {
    return switch (category) {
      NoticeCategory.general => 'General',
      NoticeCategory.important => 'Important',
      NoticeCategory.emergency => 'Emergency',
      NoticeCategory.academic => 'Academic',
      NoticeCategory.fee => 'Fees',
      NoticeCategory.transport => 'Transport',
      NoticeCategory.homework => 'Homework',
      NoticeCategory.approval => 'Approval',
    };
  }

  String _formatDate(DateTime value) {
    final local = value.toLocal();
    final month = const [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ][local.month - 1];
    final hour = local.hour.toString().padLeft(2, '0');
    final minute = local.minute.toString().padLeft(2, '0');
    return '$month ${local.day}, ${local.year} • $hour:$minute';
  }

  void _attachmentUnavailable(BuildContext context) {
    showUnavailableWorkflowSnack(
      context,
      'Notice attachment download needs a confirmed mobile protected-file endpoint.',
    );
  }
}
