import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_error_view.dart';
import '../../../../shared/widgets/app_loading.dart';
import '../../../../shared/widgets/app_scaffold.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../application/notices_providers.dart';
import '../widgets/notice_helpers.dart';

class NoticeDetailScreen extends ConsumerWidget {
  const NoticeDetailScreen({super.key, required this.noticeId});

  final String noticeId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notice = ref.watch(noticeDetailProvider(noticeId));

    return AppScaffold(
      appBar: AppBar(title: const Text('Notice detail')),
      body: notice.when(
        loading: () => const AppLoading(message: 'Opening notice...'),
        error: (_, _) => AppErrorView(
          title: 'Could not open notice',
          message: 'Please try again in a moment.',
          onRetry: () => ref.invalidate(noticeDetailProvider(noticeId)),
        ),
        data: (item) => ListView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          children: [
            AppCard(
              color: item.isEmergency
                  ? AppColors.dangerLight.withValues(alpha: 0.45)
                  : null,
              border: Border.all(
                color: item.isEmergency
                    ? AppColors.danger.withValues(alpha: 0.35)
                    : AppColors.slate100,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(item.category.icon, color: item.category.color),
                      const SizedBox(width: AppSpacing.sm),
                      StatusChip(
                        status: item.isEmergency
                            ? AppStatusType.due
                            : AppStatusType.published,
                        label: item.category.label,
                      ),
                      const Spacer(),
                      StatusChip(
                        status: item.isRead
                            ? AppStatusType.completed
                            : AppStatusType.pending,
                        label: item.isRead ? 'Read' : 'Unread',
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  Text(
                    item.title,
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Text(
                    item.body,
                    style: Theme.of(
                      context,
                    ).textTheme.bodyLarge?.copyWith(height: 1.55),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            AppCard(
              child: Column(
                children: [
                  _DetailRow(label: 'Published by', value: item.publishedBy),
                  const Divider(),
                  _DetailRow(
                    label: 'Date',
                    value: DateFormat(
                      'MMM d, yyyy • h:mm a',
                    ).format(item.publishedAt),
                  ),
                  const Divider(),
                  _DetailRow(label: 'Audience', value: item.audience),
                  if (item.hasAttachment) ...[
                    const Divider(),
                    const _DetailRow(
                      label: 'Attachments',
                      value: '1 file available',
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: AppColors.slate500,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );
  }
}
