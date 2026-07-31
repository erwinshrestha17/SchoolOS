import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../app/constants/app_routes.dart';
import '../../../app/design_system/app_spacing.dart';
import '../../../app/theme/app_colors.dart';
import '../../../core/auth/auth_provider.dart';
import '../../../core/auth/models/auth_session.dart';
import '../../../core/errors/app_exception.dart';
import '../../../core/storage/token_storage_service.dart';
import '../../../shared/utils/nepali_bs_calendar.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_scaffold.dart';

final _sessionsProvider = FutureProvider.autoDispose<List<AuthSession>>((
  ref,
) async {
  return ref.watch(authRepositoryProvider).listSessions();
});

class LoggedInDevicesScreen extends ConsumerStatefulWidget {
  const LoggedInDevicesScreen({super.key});

  @override
  ConsumerState<LoggedInDevicesScreen> createState() =>
      _LoggedInDevicesScreenState();
}

class _LoggedInDevicesScreenState extends ConsumerState<LoggedInDevicesScreen> {
  bool _revokingOthers = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final sessions = ref.watch(_sessionsProvider);

    return AppScaffold(
      appBar: AppBar(
        leading: IconButton(
          tooltip: 'Back',
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go(AppRoutes.profile);
            }
          },
        ),
        title: const Text('Logged-in devices'),
      ),
      body: sessions.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => _ErrorBody(
          message: _friendlyError(error),
          onRetry: () => ref.invalidate(_sessionsProvider),
        ),
        data: (items) {
          if (items.isEmpty) {
            return const Center(child: Text('No active sessions were found.'));
          }

          return ListView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            children: [
              Text(
                'Review devices signed into your SchoolOS account. Revoking a session signs that device out.',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: AppColors.slate500,
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              AppCard(
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    for (var index = 0; index < items.length; index++) ...[
                      if (index > 0) const Divider(height: 1),
                      _SessionTile(
                        session: items[index],
                        onRevoke: () => _revokeSession(items[index]),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              OutlinedButton.icon(
                onPressed: _revokingOthers || items.length < 2
                    ? null
                    : _revokeOtherSessions,
                icon: _revokingOthers
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.devices_other_rounded),
                label: Text(
                  _revokingOthers
                      ? 'Signing out other devices…'
                      : 'Sign out of all other devices',
                ),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.dangerDark,
                  minimumSize: const Size.fromHeight(48),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _revokeSession(AuthSession session) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Revoke this session?'),
        content: Text(
          'This will sign out ${session.displayName}. You may need to sign in again on that device.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Revoke'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    try {
      await ref.read(authRepositoryProvider).revokeSession(session.id);
      ref.invalidate(_sessionsProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Session revoked.')));
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(_friendlyError(error))));
    }
  }

  Future<void> _revokeOtherSessions() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Sign out other devices?'),
        content: const Text(
          'All other signed-in devices will be signed out. This device stays signed in.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Sign out others'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _revokingOthers = true);
    try {
      final refreshToken = await ref
          .read(tokenStorageServiceProvider)
          .getRefreshToken();
      if (refreshToken == null || refreshToken.isEmpty) {
        throw const AuthException(
          message:
              'Your current session could not be identified. Sign in again.',
        );
      }
      await ref
          .read(authRepositoryProvider)
          .revokeOtherSessions(refreshToken: refreshToken);
      ref.invalidate(_sessionsProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Other devices have been signed out.')),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(_friendlyError(error))));
    } finally {
      if (mounted) setState(() => _revokingOthers = false);
    }
  }
}

class _SessionTile extends StatelessWidget {
  const _SessionTile({required this.session, required this.onRevoke});

  final AuthSession session;
  final VoidCallback onRevoke;

  @override
  Widget build(BuildContext context) {
    final lastUsed = session.lastUsedAt ?? session.createdAt;
    final lastUsedLabel = NepaliBsCalendar.formatBsDateTime(lastUsed);

    return ListTile(
      contentPadding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.sm,
      ),
      leading: const Icon(Icons.devices_rounded),
      title: Text(
        session.displayName,
        style: const TextStyle(fontWeight: FontWeight.w700),
      ),
      subtitle: Text('Last active $lastUsedLabel'),
      trailing: TextButton(onPressed: onRevoke, child: const Text('Revoke')),
    );
  }
}

class _ErrorBody extends StatelessWidget {
  const _ErrorBody({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: AppSpacing.md),
            FilledButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}

String _friendlyError(Object error) {
  if (error is AppException) return error.message;
  return 'Something went wrong. Please try again.';
}
