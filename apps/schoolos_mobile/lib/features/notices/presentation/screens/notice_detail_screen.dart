import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../features/parent/application/parent_feature_state.dart';
import '../../../../features/parent/presentation/widgets/parent_detail_widgets.dart';
import '../../../../features/parent/presentation/widgets/parent_portal_widgets.dart';

class NoticeDetailScreen extends ConsumerWidget {
  const NoticeDetailScreen({super.key, required this.noticeId});
  final String noticeId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final read = ref.watch(
      parentFeatureControllerProvider.select((state) => state.noticeRead),
    );
    return ParentDetailScaffold(
      title: 'Notice',
      selectedIndex: 3,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
        children: [
          PortalCard(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const FeatureIcon(Icons.campaign_rounded, size: 66),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Holiday notice for Friday',
                        style: TextStyle(
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
                          const StatusBadge(
                            label: 'School-wide',
                            icon: Icons.groups_rounded,
                          ),
                          const StatusBadge(
                            label: 'Important',
                            color: ParentPortalColors.purple,
                            background: ParentPortalColors.purpleSoft,
                            icon: Icons.bookmark_rounded,
                          ),
                          StatusBadge(
                            label: read ? 'Read' : 'Published today 9:00 AM',
                            color: read
                                ? ParentPortalColors.green
                                : ParentPortalColors.muted,
                            background: read
                                ? ParentPortalColors.greenSoft
                                : ParentPortalColors.surfaceAlt,
                            icon: read
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
          const PortalCard(
            color: ParentPortalColors.greenSoft,
            child: Row(
              children: [
                FeatureIcon(
                  Icons.groups_rounded,
                  color: ParentPortalColors.green,
                  size: 42,
                ),
                SizedBox(width: 12),
                Text(
                  'Applies to both children',
                  style: TextStyle(
                    color: ParentPortalColors.green,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          const PortalCard(
            child: Text(
              'Dear Parents,\n\nThe school will remain closed this Friday for Eid and Ganatantra Diwas.\n\nClasses will resume on Sunday.',
              style: TextStyle(
                fontSize: 17,
                height: 1.6,
                color: ParentPortalColors.navy,
              ),
            ),
          ),
          const SizedBox(height: 18),
          const ParentSectionHeader(title: 'Attachment'),
          const SizedBox(height: 8),
          PortalCard(
            onTap: () => _preview(context),
            child: const Row(
              children: [
                FeatureIcon(
                  Icons.picture_as_pdf_rounded,
                  color: ParentPortalColors.red,
                ),
                SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Holiday_Notice.pdf',
                        style: TextStyle(fontWeight: FontWeight.w900),
                      ),
                      Text(
                        'PDF • 256 KB',
                        style: TextStyle(color: ParentPortalColors.muted),
                      ),
                    ],
                  ),
                ),
                Icon(Icons.download_rounded, color: ParentPortalColors.green),
              ],
            ),
          ),
          const SizedBox(height: 18),
          const ParentSectionHeader(title: 'Actions'),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: FilledButton.tonalIcon(
                  onPressed: read
                      ? null
                      : () {
                          ref
                              .read(parentFeatureControllerProvider.notifier)
                              .markNoticeRead();
                          showFeatureSnack(context, 'Notice marked as read.');
                        },
                  icon: Icon(
                    read
                        ? Icons.done_all_rounded
                        : Icons.check_circle_outline_rounded,
                  ),
                  label: Text(read ? 'Read' : 'Mark as read'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => showFeatureSnack(
                    context,
                    'Sharing is unavailable in this local preview.',
                  ),
                  icon: const Icon(Icons.share_rounded),
                  label: const Text('Share'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _preview(BuildContext context) => showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (_) => const SafeArea(
      child: Padding(
        padding: EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            FeatureIcon(
              Icons.picture_as_pdf_rounded,
              color: ParentPortalColors.red,
              size: 64,
            ),
            SizedBox(height: 12),
            Text(
              'Holiday_Notice.pdf',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
            ),
            SizedBox(height: 6),
            Text(
              'Protected local preview placeholder\nPDF • 256 KB',
              textAlign: TextAlign.center,
              style: TextStyle(color: ParentPortalColors.muted),
            ),
            SizedBox(height: 18),
          ],
        ),
      ),
    ),
  );
}
