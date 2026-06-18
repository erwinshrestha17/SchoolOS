import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/constants/app_routes.dart';
import '../../domain/parent_portal_models.dart';
import '../widgets/parent_portal_widgets.dart';

class ParentPortalChildrenTab extends StatelessWidget {
  const ParentPortalChildrenTab({super.key, required this.data});

  final ParentPortalData data;

  @override
  Widget build(BuildContext context) {
    return ListView(
      key: const PageStorageKey('parent-children'),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
      children: [
        PortalCard(
          color: ParentPortalColors.greenSoft,
          borderColor: ParentPortalColors.green.withValues(alpha: .24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Family overview',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: ParentPortalColors.navy,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 16),
              const Row(
                children: [
                  Expanded(
                    child: SummaryMetric(
                      icon: Icons.family_restroom_rounded,
                      value: '2',
                      label: 'linked children',
                      color: ParentPortalColors.green,
                    ),
                  ),
                  SizedBox(width: 12),
                  Expanded(
                    child: SummaryMetric(
                      icon: Icons.fact_check_outlined,
                      value: '2 of 2',
                      label: 'present today',
                      color: ParentPortalColors.green,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Text(
                'Last updated ${data.lastUpdated}',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: ParentPortalColors.muted,
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
            onTap: () => context.push(AppRoutes.parentChildDetail(child.id)),
          ),
          const SizedBox(height: 14),
        ],
      ],
    );
  }
}
