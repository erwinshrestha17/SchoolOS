import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../app/theme/app_colors.dart';

class UserAvatar extends StatelessWidget {
  const UserAvatar({
    super.key,
    this.imageUrl,
    this.name = '',
    this.radius = 24.0,
    this.borderWidth = 0.0,
    this.borderColor,
  });

  final String? imageUrl;
  final String name;
  final double radius;
  final double borderWidth;
  final Color? borderColor;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    final defaultBorderColor = borderColor ?? AppColors.primary;

    final String initials = name
        .trim()
        .split(RegExp(r'\s+'))
        .take(2)
        .map((s) => s.isEmpty ? '' : s[0].toUpperCase())
        .join();

    Widget avatarChild;

    if (imageUrl != null && imageUrl!.isNotEmpty) {
      avatarChild = CachedNetworkImage(
        imageUrl: imageUrl!,
        imageBuilder: (context, imageProvider) => Container(
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            image: DecorationImage(image: imageProvider, fit: BoxFit.cover),
          ),
        ),
        placeholder: (context, url) => Container(
          decoration: const BoxDecoration(
            color: AppColors.slate200,
            shape: BoxShape.circle,
          ),
          child: const Center(
            child: SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor: AlwaysStoppedAnimation(AppColors.primary),
              ),
            ),
          ),
        ),
        errorWidget: (context, url, error) =>
            _buildInitialsFallback(isDark, initials),
      );
    } else {
      avatarChild = _buildInitialsFallback(isDark, initials);
    }

    if (borderWidth > 0) {
      return Container(
        width: radius * 2,
        height: radius * 2,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: defaultBorderColor, width: borderWidth),
        ),
        padding: const EdgeInsets.all(2),
        child: Container(
          decoration: const BoxDecoration(shape: BoxShape.circle),
          child: avatarChild,
        ),
      );
    }

    return SizedBox(width: radius * 2, height: radius * 2, child: avatarChild);
  }

  Widget _buildInitialsFallback(bool isDark, String initials) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: isDark
              ? [AppColors.slate800, AppColors.slate700]
              : [AppColors.slate200, AppColors.slate300],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        shape: BoxShape.circle,
      ),
      child: Center(
        child: Text(
          initials.isEmpty ? '?' : initials,
          style: TextStyle(
            color: isDark ? Colors.white : AppColors.slate700,
            fontSize: radius * 0.75,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.0,
          ),
        ),
      ),
    );
  }
}
