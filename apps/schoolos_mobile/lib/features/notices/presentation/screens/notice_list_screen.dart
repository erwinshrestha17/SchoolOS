import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/constants/app_routes.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_error_view.dart';
import '../../../../shared/widgets/app_skeleton.dart';
import '../../../../shared/widgets/app_scaffold.dart';
import '../../../../shared/widgets/section_header.dart';
import '../../../parent/presentation/widgets/last_updated_label.dart';
import '../../application/notices_providers.dart';
import '../widgets/notice_card.dart';
import '../widgets/notice_helpers.dart';

class NoticeListScreen extends ConsumerWidget {
  const NoticeListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(noticesControllerProvider);
    final controller = ref.read(noticesControllerProvider.notifier);

    return AppScaffold(
      appBar: AppBar(title: const Text('Notices')),
      body: state.isLoading
          ? const Padding(
              padding: EdgeInsets.all(AppSpacing.lg),
              child: Column(
                children: [
                  AppSkeleton(width: double.infinity, height: 52),
                  SizedBox(height: AppSpacing.md),
                  AppSkeleton(width: double.infinity, height: 132),
                  SizedBox(height: AppSpacing.md),
                  AppSkeleton(width: double.infinity, height: 132),
                ],
              ),
            )
          : state.message != null && state.notices.isEmpty
          ? AppErrorView(
              title: 'Could not load notices',
              message: state.message!,
              onRetry: controller.load,
            )
          : RefreshIndicator(
              onRefresh: controller.load,
              child: ListView(
                padding: const EdgeInsets.all(AppSpacing.lg),
                children: [
                  Row(
                    children: [
                      const Expanded(
                        child: SectionHeader(title: 'School notices'),
                      ),
                      LastUpdatedLabel(
                        lastUpdated: state.lastUpdated,
                        isOffline: state.isOffline,
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  SizedBox(
                    height: 42,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemBuilder: (context, index) {
                        final filter = NoticeFilter.values[index];
                        return ChoiceChip(
                          label: Text(filter.label),
                          selected: state.filter == filter,
                          onSelected: (_) => controller.setFilter(filter),
                        );
                      },
                      separatorBuilder: (_, _) =>
                          const SizedBox(width: AppSpacing.sm),
                      itemCount: NoticeFilter.values.length,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  if (state.visibleNotices.isEmpty)
                    const AppEmptyState(
                      title: 'No notices yet',
                      message:
                          'School notices will appear here as soon as they are published.',
                      icon: Icons.campaign_outlined,
                    )
                  else
                    for (final notice in state.visibleNotices) ...[
                      NoticeCard(
                        notice: notice,
                        onTap: () =>
                            context.go(AppRoutes.noticeDetail(notice.id)),
                      ),
                      const SizedBox(height: AppSpacing.md),
                    ],
                ],
              ),
            ),
    );
  }
}
