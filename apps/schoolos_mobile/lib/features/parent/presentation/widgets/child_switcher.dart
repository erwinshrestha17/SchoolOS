import 'package:flutter/material.dart';

import '../../../../app/design_system/app_radius.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/widgets/user_avatar.dart';
import '../../domain/parent_models.dart';

class ChildSwitcher extends StatelessWidget {
  const ChildSwitcher({
    super.key,
    required this.children,
    required this.selectedChildId,
    required this.onSelected,
  });

  final List<GuardianChild> children;
  final String? selectedChildId;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return SizedBox(
      height: 78,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: children.length,
        separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.md),
        itemBuilder: (context, index) {
          final child = children[index];
          final selected = child.id == selectedChildId;

          return Semantics(
            button: true,
            selected: selected,
            label: 'Select ${child.name}',
            child: InkWell(
              borderRadius: BorderRadius.circular(AppRadius.xl),
              onTap: () => onSelected(child.id),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                width: 220,
                padding: const EdgeInsets.all(AppSpacing.sm),
                decoration: BoxDecoration(
                  color: selected
                      ? AppColors.parentAccent.withValues(
                          alpha: isDark ? 0.18 : 0.08,
                        )
                      : (isDark ? AppColors.slate900 : Colors.white),
                  borderRadius: BorderRadius.circular(AppRadius.xl),
                  border: Border.all(
                    color: selected
                        ? AppColors.parentAccent
                        : (isDark ? AppColors.slate800 : AppColors.slate200),
                    width: selected ? 2 : 1,
                  ),
                ),
                child: Row(
                  children: [
                    UserAvatar(
                      name: child.name,
                      radius: 22,
                      borderColor: selected ? AppColors.parentAccent : null,
                      borderWidth: selected ? 1.5 : 0,
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            child.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: isDark ? Colors.white : AppColors.slate900,
                              fontWeight: FontWeight.w800,
                              fontSize: 13,
                            ),
                          ),
                          Text(
                            child.classSection,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: AppColors.slate500,
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
