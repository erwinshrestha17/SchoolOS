import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/constants/app_routes.dart';
import '../../application/parent_dashboard_view_model.dart';
import '../../domain/parent_portal_models.dart';
import '../widgets/last_updated_label.dart';
import '../widgets/parent_portal_widgets.dart';

class ParentPortalChildrenTab extends StatelessWidget {
  const ParentPortalChildrenTab({super.key, required this.data, this.now});

  final ParentPortalData data;
  final DateTime? now;

  @override
  Widget build(BuildContext context) {
    final linkedCount = data.children.length;
    final now = this.now ?? DateTime.now();
    return ListView(
      key: const PageStorageKey('parent-children'),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
      children: [
        PortalCard(
          color: ParentPortalColors.greenSoft,
          borderColor: ParentPortalColors.green.withValues(alpha: .24),
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: const BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.family_restroom_rounded,
                  color: ParentPortalColors.green,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '$linkedCount linked ${linkedCount == 1 ? 'child' : 'children'}',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: ParentPortalColors.navy,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    Text(
                      data.schoolName,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: ParentPortalColors.muted,
                      ),
                    ),
                    const SizedBox(height: 6),
                    LastUpdatedLabel(
                      lastUpdated: data.lastUpdated,
                      isOffline: data.fromCache,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        const ParentSectionHeader(title: 'Linked children'),
        const SizedBox(height: 10),
        for (final child in data.children) ...[
          ParentChildCard(
            child: child,
            schoolName: data.schoolName,
            actionCount: priorityActionsFor(
              child,
              overdueHomeworkCount: overdueHomeworkCountFor(
                data,
                childId: child.id,
                now: now,
              ),
            ).length,
            overdueHomeworkCount: overdueHomeworkCountFor(
              data,
              childId: child.id,
              now: now,
            ),
            nextHomeworkDueAt: nextHomeworkDueAtFor(
              data,
              childId: child.id,
              now: now,
            ),
            onTap: () => context.push(AppRoutes.parentChildDetail(child.id)),
          ),
          const SizedBox(height: 14),
        ],
      ],
    );
  }
}
