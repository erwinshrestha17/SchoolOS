import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/platform/file_share_service.dart';
import '../../../../features/parent/application/parent_portal_providers.dart';
import '../../../../features/parent/presentation/widgets/parent_detail_widgets.dart';
import '../../../../features/parent/presentation/widgets/parent_portal_widgets.dart';
import '../../../../shared/utils/nepali_bs_calendar.dart';
import '../../application/notices_providers.dart';
import '../../domain/notice_models.dart';

class NoticeDetailScreen extends ConsumerWidget {
  const NoticeDetailScreen({super.key, required this.noticeId});

  final String noticeId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final provider = noticeDetailProvider(noticeId);
    ref.listen<AsyncValue<Notice>>(provider, (previous, next) {
      next.whenData((notice) {
        ref.read(noticesControllerProvider.notifier).markReadLocally(notice.id);
        ref.invalidate(parentNotificationsProvider);
        ref.invalidate(parentPortalDataProvider);
      });
    });
    final detail = ref.watch(provider);
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
              _NoticeAttachmentCard(
                attachment: notice.attachment,
                onDownload: notice.attachment == null
                    ? () => _attachmentUnavailable(context)
                    : () =>
                          _downloadAttachment(context, ref, notice.attachment!),
                onShare: notice.attachment == null
                    ? () => _attachmentUnavailable(context)
                    : () => _shareAttachment(context, ref, notice.attachment!),
              ),
            ],
            const SizedBox(height: 18),
            const PortalCard(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  FeatureIcon(
                    Icons.verified_user_rounded,
                    color: ParentPortalColors.green,
                    size: 42,
                  ),
                  SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'This notice is loaded through your parent-scoped mobile account. Attachments stay protected and may require internet.',
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
    return NepaliBsCalendar.formatBsDateTime(value);
  }

  void _attachmentUnavailable(BuildContext context) {
    showUnavailableWorkflowSnack(
      context,
      'This notice attachment is not available for mobile download right now.',
    );
  }

  Future<void> _downloadAttachment(
    BuildContext context,
    WidgetRef ref,
    NoticeAttachment attachment,
  ) async {
    try {
      final file = await ref
          .read(noticesRepositoryProvider)
          .downloadNoticeAttachment(attachment);
      if (!context.mounted) return;
      showFeatureSnack(context, 'Attachment downloaded: ${file.fileName}');
    } catch (_) {
      if (!context.mounted) return;
      showFeatureSnack(context, 'Attachment is not available right now.');
    }
  }

  Future<void> _shareAttachment(
    BuildContext context,
    WidgetRef ref,
    NoticeAttachment attachment,
  ) async {
    try {
      final file = await ref
          .read(noticesRepositoryProvider)
          .downloadNoticeAttachment(attachment);
      await const FileShareService().shareFile(
        filePath: file.filePath,
        mimeType: attachment.mimeType,
        subject: file.fileName,
      );
      if (!context.mounted) return;
      showFeatureSnack(context, 'Attachment ready to share.');
    } catch (_) {
      if (!context.mounted) return;
      showFeatureSnack(context, 'Could not share this attachment.');
    }
  }
}

class _NoticeAttachmentCard extends StatelessWidget {
  const _NoticeAttachmentCard({
    required this.attachment,
    required this.onDownload,
    required this.onShare,
  });

  final NoticeAttachment? attachment;
  final VoidCallback onDownload;
  final VoidCallback onShare;

  @override
  Widget build(BuildContext context) {
    final label = attachment == null
        ? 'Protected attachment unavailable'
        : attachment!.fileName;
    final detail = attachment == null
        ? 'The school has not exposed this file to parent mobile yet.'
        : '${_formatSize(attachment!.sizeBytes)} - protected download';

    return PortalCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const FeatureIcon(
                Icons.attach_file_rounded,
                color: ParentPortalColors.red,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                    Text(
                      detail,
                      style: const TextStyle(color: ParentPortalColors.muted),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onDownload,
                  icon: const Icon(Icons.download_rounded, size: 18),
                  label: const Text('Download'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onShare,
                  icon: const Icon(Icons.ios_share_rounded, size: 18),
                  label: const Text('Share'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

String _formatSize(int bytes) {
  if (bytes <= 0) return 'Size unavailable';
  if (bytes < 1024) return '$bytes B';
  if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
  return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
}
