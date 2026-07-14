import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../application/parent_providers.dart';
import '../../application/parent_portal_providers.dart';
import '../../domain/parent_models.dart';
import '../widgets/parent_detail_widgets.dart';
import '../widgets/parent_portal_widgets.dart';

class ParentConsentsScreen extends ConsumerWidget {
  const ParentConsentsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final portal = ref.watch(parentPortalDataProvider);
    final consents = ref.watch(parentConsentStatusProvider);
    return ParentDetailScaffold(
      title: 'Consent & Permissions',
      selectedIndex: 5,
      body: portal.when(
        loading: () => const _ConsentLoading(),
        error: (_, _) => _ConsentUnavailable(
          title: 'Could not load permission context',
          message: 'Please try again in a moment.',
          onRetry: () => ref.invalidate(parentPortalDataProvider),
        ),
        data: (data) => RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(parentPortalDataProvider);
            ref.invalidate(parentConsentStatusProvider);
            await ref.read(parentPortalDataProvider.future);
            await ref.read(parentConsentStatusProvider.future);
          },
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
            children: [
              PortalCard(
                color: ParentPortalColors.purpleSoft,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const FeatureIcon(
                      Icons.verified_user_rounded,
                      color: ParentPortalColors.purple,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        data.children.isEmpty
                            ? 'Linked-child permission workflows will appear here when enabled by the school.'
                            : 'Permission workflows for ${_childNames(data.children.map((child) => child.name).toList())} will appear here when enabled by the school.',
                        style: const TextStyle(
                          color: ParentPortalColors.muted,
                          height: 1.4,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              const _ConsentUnavailable(
                title: 'Consent decisions are append-only',
                message:
                    'Granting or declining creates a new consent record for your guardian account. Historic consent records are not edited.',
              ),
              const SizedBox(height: 12),
              _ConsentStatusSection(
                consents: consents,
                onDecision: (consentType, version, granted) =>
                    _submitConsentDecision(
                      context,
                      ref,
                      consentType: consentType,
                      version: version,
                      granted: granted,
                    ),
              ),
              const SizedBox(height: 12),
              const _ReadOnlyPermissionCard(
                icon: Icons.directions_bus_rounded,
                title: 'Trip permission',
                message:
                    'Trip permission requests are not enabled in the parent app yet. School trip approvals remain with the school office.',
                statusLabel: 'Unavailable',
              ),
              const SizedBox(height: 12),
              const _ReadOnlyPermissionCard(
                icon: Icons.group_rounded,
                title: 'Authorized pickup',
                message:
                    'Pickup contact requests need a school-approved pickup workflow before parents can submit changes. No pickup contact is activated from mobile.',
                statusLabel: 'Unavailable',
              ),
            ],
          ),
        ),
      ),
    );
  }

  static String _childNames(List<String> names) {
    if (names.isEmpty) return 'your children';
    if (names.length == 1) return names.first;
    return '${names.take(names.length - 1).join(', ')} and ${names.last}';
  }

  Future<void> _submitConsentDecision(
    BuildContext context,
    WidgetRef ref, {
    required String consentType,
    required String version,
    required bool granted,
  }) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(granted ? 'Grant consent?' : 'Decline consent?'),
        content: Text(
          'This will record your ${_labelFor(consentType).toLowerCase()} decision for version $version.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: Text(granted ? 'Grant' : 'Decline'),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;

    try {
      await ref
          .read(parentRepositoryProvider)
          .decideMyConsent(
            consentType: consentType,
            version: version,
            granted: granted,
          );
      ref.invalidate(parentConsentStatusProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Consent decision recorded.')),
        );
      }
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Consent decision could not be saved. Please retry.'),
          ),
        );
      }
    }
  }
}

class _ConsentStatusSection extends ConsumerWidget {
  const _ConsentStatusSection({
    required this.consents,
    required this.onDecision,
  });

  final AsyncValue<List<ParentConsentStatus>> consents;
  final Future<void> Function(String consentType, String version, bool granted)
  onDecision;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return consents.when(
      loading: () => const PortalCard(
        child: Text(
          'Loading consent status...',
          style: TextStyle(color: ParentPortalColors.muted),
        ),
      ),
      error: (_, _) => _ConsentUnavailable(
        title: 'Could not load consent status',
        message: 'Please try again in a moment.',
        onRetry: () => ref.invalidate(parentConsentStatusProvider),
      ),
      data: (items) => Column(
        children: [
          _ReadOnlyPermissionCard(
            icon: Icons.camera_alt_rounded,
            title: 'Media consent',
            message:
                _messageFor(items, 'PHOTO_USAGE') ??
                'No media consent record is available yet.',
            statusLabel: _statusFor(items, 'PHOTO_USAGE'),
            version: _find(items, 'PHOTO_USAGE')?.version,
            onDecision: (version, granted) =>
                onDecision('PHOTO_USAGE', version, granted),
          ),
          const SizedBox(height: 12),
          _ReadOnlyPermissionCard(
            icon: Icons.forum_rounded,
            title: 'Notification consent',
            message:
                _messageFor(items, 'MESSAGING') ??
                'No notification consent record is available yet.',
            statusLabel: _statusFor(items, 'MESSAGING'),
            version: _find(items, 'MESSAGING')?.version,
            onDecision: (version, granted) =>
                onDecision('MESSAGING', version, granted),
          ),
          const SizedBox(height: 12),
          _ReadOnlyPermissionCard(
            icon: Icons.privacy_tip_rounded,
            title: 'Data processing consent',
            message:
                _messageFor(items, 'DATA_PROCESSING') ??
                'No data-processing consent record is available yet.',
            statusLabel: _statusFor(items, 'DATA_PROCESSING'),
            version: _find(items, 'DATA_PROCESSING')?.version,
            onDecision: (version, granted) =>
                onDecision('DATA_PROCESSING', version, granted),
          ),
        ],
      ),
    );
  }

  static ParentConsentStatus? _find(
    List<ParentConsentStatus> items,
    String type,
  ) {
    for (final item in items) {
      if (item.consentType == type) return item;
    }
    return null;
  }

  static String _statusFor(List<ParentConsentStatus> items, String type) {
    final consent = _find(items, type);
    if (consent == null) return 'Not recorded';
    return consent.granted ? 'Granted' : 'Not granted';
  }

  static String? _messageFor(List<ParentConsentStatus> items, String type) {
    final consent = _find(items, type);
    if (consent == null) return null;
    final date = _date(consent.revokedAt ?? consent.capturedAt);
    if (consent.granted) {
      return date == null
          ? 'School records show this consent as granted.'
          : 'School records show this consent as granted on $date.';
    }
    return date == null
        ? 'School records show this consent is not granted.'
        : 'School records show this consent is not granted as of $date.';
  }

  static String? _date(String? value) {
    final parsed = DateTime.tryParse(value ?? '');
    if (parsed == null) return null;
    return '${parsed.year}-${parsed.month.toString().padLeft(2, '0')}-${parsed.day.toString().padLeft(2, '0')}';
  }
}

class _ReadOnlyPermissionCard extends StatelessWidget {
  const _ReadOnlyPermissionCard({
    required this.icon,
    required this.title,
    required this.message,
    required this.statusLabel,
    this.version,
    this.onDecision,
  });

  final IconData icon;
  final String title;
  final String message;
  final String statusLabel;
  final String? version;
  final Future<void> Function(String version, bool granted)? onDecision;

  @override
  Widget build(BuildContext context) => PortalCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            FeatureIcon(icon, color: ParentPortalColors.green),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    message,
                    style: const TextStyle(
                      color: ParentPortalColors.muted,
                      height: 1.4,
                    ),
                  ),
                  if (version != null && version!.trim().isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(
                      'Version $version',
                      style: const TextStyle(
                        color: ParentPortalColors.muted,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            StatusBadge(
              label: statusLabel,
              color: statusLabel == 'Granted'
                  ? ParentPortalColors.green
                  : ParentPortalColors.orange,
              background: statusLabel == 'Granted'
                  ? ParentPortalColors.greenSoft
                  : ParentPortalColors.orangeSoft,
            ),
          ],
        ),
        if (onDecision != null &&
            version != null &&
            version!.trim().isNotEmpty) ...[
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              OutlinedButton.icon(
                onPressed: () => onDecision!(version!, false),
                icon: const Icon(Icons.close_rounded),
                label: const Text('Decline'),
              ),
              FilledButton.icon(
                onPressed: () => onDecision!(version!, true),
                icon: const Icon(Icons.check_rounded),
                label: const Text('Grant'),
              ),
            ],
          ),
        ] else if (onDecision != null) ...[
          const SizedBox(height: 12),
          const Text(
            'A school-published consent version is required before mobile decisions are enabled.',
            style: TextStyle(
              color: ParentPortalColors.muted,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ],
    ),
  );
}

String _labelFor(String type) {
  return switch (type) {
    'PHOTO_USAGE' => 'Media consent',
    'MESSAGING' => 'Notification consent',
    'DATA_PROCESSING' => 'Data processing consent',
    _ => 'Consent',
  };
}

class _ConsentUnavailable extends StatelessWidget {
  const _ConsentUnavailable({
    required this.title,
    required this.message,
    this.onRetry,
  });

  final String title;
  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) => PortalCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const FeatureIcon(
              Icons.lock_outline_rounded,
              color: ParentPortalColors.orange,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    message,
                    style: const TextStyle(
                      color: ParentPortalColors.muted,
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        if (onRetry != null) ...[
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh_rounded),
            label: const Text('Retry'),
          ),
        ],
      ],
    ),
  );
}

class _ConsentLoading extends StatelessWidget {
  const _ConsentLoading();

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
    children: const [
      PortalCard(
        child: Row(
          children: [
            FeatureIcon(Icons.verified_user_rounded),
            SizedBox(width: 12),
            Expanded(
              child: Text(
                'Loading linked-child permission context...',
                style: TextStyle(color: ParentPortalColors.muted),
              ),
            ),
          ],
        ),
      ),
    ],
  );
}
