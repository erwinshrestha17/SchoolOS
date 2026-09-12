import 'package:flutter/material.dart';
import '../../app/design_system/app_spacing.dart';
import '../../app/theme/app_semantic_colors.dart';

class OfflineBanner extends StatelessWidget {
  const OfflineBanner({super.key, this.visible = false, this.message});

  final bool visible;
  final String? message;

  @override
  Widget build(BuildContext context) {
    final semantic = AppSemanticColors.of(context);
    return AnimatedSwitcher(
      duration: MediaQuery.disableAnimationsOf(context)
          ? Duration.zero
          : const Duration(milliseconds: 250),
      transitionBuilder: (child, animation) {
        return SizeTransition(
          sizeFactor: animation,
          child: FadeTransition(opacity: animation, child: child),
        );
      },
      child: visible
          ? Semantics(
              liveRegion: true,
              child: Container(
                key: const ValueKey('offline_banner_shown'),
                width: double.infinity,
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.lg,
                  vertical: AppSpacing.sm + 2,
                ),
                decoration: BoxDecoration(
                  color: semantic.warning.withValues(alpha: .12),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.cloud_off_rounded,
                      color: semantic.warning,
                      size: 18,
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Text(
                        message ??
                            'You are offline. Connect to refresh information.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: semantic.textPrimary,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            )
          : const SizedBox.shrink(key: ValueKey('offline_banner_hidden')),
    );
  }
}
