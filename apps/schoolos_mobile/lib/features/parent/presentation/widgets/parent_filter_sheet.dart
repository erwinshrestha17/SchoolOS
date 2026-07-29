import 'package:flutter/material.dart';

import '../../../../app/design_system/app_radius.dart';
import '../../../../app/design_system/app_spacing.dart';
import 'parent_portal_widgets.dart';

Future<T?> showParentFilterSheet<T>({
  required BuildContext context,
  required Widget child,
  double heightFactor = .86,
}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    barrierColor: Colors.black.withValues(alpha: .46),
    builder: (_) => FractionallySizedBox(
      heightFactor: heightFactor,
      alignment: Alignment.bottomCenter,
      child: child,
    ),
  );
}

class ParentFilterSheet extends StatelessWidget {
  const ParentFilterSheet({
    super.key,
    required this.title,
    required this.body,
    required this.onReset,
    required this.onClearAll,
    required this.onApply,
    this.applyLabel = 'Apply filters',
  });

  final String title;
  final Widget body;
  final VoidCallback onReset;
  final VoidCallback onClearAll;
  final VoidCallback onApply;
  final String applyLabel;

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    return Material(
      color: Theme.of(context).colorScheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppRadius.xxl),
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          const SizedBox(height: AppSpacing.md),
          Container(
            width: 48,
            height: 5,
            decoration: BoxDecoration(
              color: ParentPortalColors.border,
              borderRadius: AppRadius.borderRadiusMax,
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.md,
              AppSpacing.sm,
              AppSpacing.sm,
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    title,
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      color: ParentPortalColors.navy,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
                TextButton(onPressed: onReset, child: const Text('Reset')),
                IconButton(
                  tooltip: 'Close filters',
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close_rounded),
                  color: ParentPortalColors.muted,
                ),
              ],
            ),
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.sm,
                AppSpacing.lg,
                AppSpacing.xl,
              ),
              child: body,
            ),
          ),
          const Divider(height: 1, color: ParentPortalColors.border),
          AnimatedPadding(
            duration: const Duration(milliseconds: 180),
            padding: EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.lg + bottomInset,
            ),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    key: const ValueKey('parent-filter-clear-all'),
                    onPressed: onClearAll,
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size.fromHeight(54),
                      foregroundColor: ParentPortalColors.green,
                      side: const BorderSide(
                        color: ParentPortalColors.green,
                        width: 1.4,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: AppRadius.borderRadiusLG,
                      ),
                    ),
                    child: const Text(
                      'Clear all',
                      style: TextStyle(fontWeight: FontWeight.w800),
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.lg),
                Expanded(
                  flex: 2,
                  child: FilledButton(
                    key: const ValueKey('parent-filter-apply'),
                    onPressed: onApply,
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(54),
                      backgroundColor: ParentPortalColors.green,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: AppRadius.borderRadiusLG,
                      ),
                    ),
                    child: Text(
                      applyLabel,
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class ParentFilterSection extends StatelessWidget {
  const ParentFilterSection({
    super.key,
    required this.label,
    required this.child,
  });

  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
            color: ParentPortalColors.navy,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        child,
      ],
    );
  }
}

class ParentFilterOption<T> {
  const ParentFilterOption({required this.value, required this.label});

  final T value;
  final String label;
}

class ParentFilterChoiceGroup<T> extends StatelessWidget {
  const ParentFilterChoiceGroup({
    super.key,
    required this.options,
    required this.selected,
    required this.onSelected,
    this.maxColumns = 4,
  });

  final List<ParentFilterOption<T>> options;
  final T? selected;
  final ValueChanged<T> onSelected;
  final int maxColumns;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final textScale = MediaQuery.textScalerOf(context).scale(1);
        final compact =
            constraints.maxWidth < 340 || textScale > 1.25 || maxColumns < 3;
        final columns = compact ? maxColumns.clamp(1, 2) : maxColumns;
        const gap = AppSpacing.sm;
        final optionWidth =
            (constraints.maxWidth - gap * (columns - 1)) / columns;

        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            for (final option in options)
              SizedBox(
                width: optionWidth,
                child: _ParentFilterChoice(
                  label: option.label,
                  selected: option.value == selected,
                  onTap: () => onSelected(option.value),
                ),
              ),
          ],
        );
      },
    );
  }
}

class _ParentFilterChoice extends StatelessWidget {
  const _ParentFilterChoice({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      child: Material(
        color: selected ? ParentPortalColors.greenSoft : Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.borderRadiusMD,
          side: BorderSide(
            color: selected
                ? ParentPortalColors.green
                : ParentPortalColors.border,
            width: selected ? 1.4 : 1,
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 50),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.sm,
                vertical: AppSpacing.sm,
              ),
              child: Center(
                child: Text(
                  label,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: selected
                        ? ParentPortalColors.green
                        : ParentPortalColors.navy,
                    fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class ParentFilterSelectField<T extends Object> extends StatelessWidget {
  const ParentFilterSelectField({
    super.key,
    required this.label,
    required this.value,
    required this.options,
    required this.onChanged,
  });

  final String label;
  final T value;
  final List<ParentFilterOption<T>> options;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    return ParentFilterSection(
      label: label,
      child: DropdownButtonFormField<T>(
        initialValue: value,
        isExpanded: true,
        icon: const Icon(Icons.keyboard_arrow_down_rounded),
        decoration: const InputDecoration(
          isDense: true,
          contentPadding: EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: 15,
          ),
        ),
        items: [
          for (final option in options)
            DropdownMenuItem<T>(
              value: option.value,
              child: Text(
                option.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
        ],
        onChanged: (next) {
          if (next != null) onChanged(next);
        },
      ),
    );
  }
}

class ParentFilterToolbar extends StatelessWidget {
  const ParentFilterToolbar({
    super.key,
    required this.title,
    required this.onFilter,
    this.activeFilterCount = 0,
  });

  final String title;
  final VoidCallback onFilter;
  final int activeFilterCount;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            title,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              color: ParentPortalColors.navy,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
        TextButton.icon(
          onPressed: onFilter,
          icon: Badge.count(
            count: activeFilterCount,
            isLabelVisible: activeFilterCount > 0,
            child: const Icon(Icons.tune_rounded),
          ),
          label: const Text('Filter'),
        ),
      ],
    );
  }
}
