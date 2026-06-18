import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../application/parent_portal_providers.dart';
import '../../domain/parent_portal_models.dart';
import '../widgets/parent_detail_widgets.dart';
import '../widgets/parent_portal_widgets.dart';

class ParentCalendarScreen extends ConsumerWidget {
  const ParentCalendarScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final portal = ref.watch(parentPortalDataProvider);
    return ParentDetailScaffold(
      title: 'School Calendar',
      selectedIndex: 4,
      body: portal.when(
        loading: () => const _CalendarLoading(),
        error: (_, _) => _CalendarUnavailable(
          title: 'Could not load calendar updates',
          message: 'Please try again in a moment.',
          onRetry: () => ref.invalidate(parentPortalDataProvider),
        ),
        data: (data) {
          final events = data.updates
              .where((item) => item.category == ParentUpdateCategory.event)
              .toList();
          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(parentPortalDataProvider);
              await ref.read(parentPortalDataProvider.future);
            },
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
              children: [
                PortalCard(
                  color: ParentPortalColors.blueSoft,
                  child: Row(
                    children: [
                      const FeatureIcon(
                        Icons.calendar_month_rounded,
                        color: ParentPortalColors.blue,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'School events',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            Text(
                              'Latest event updates from ${data.schoolName}.',
                              style: const TextStyle(
                                color: ParentPortalColors.muted,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                const ParentSectionHeader(title: 'Upcoming'),
                const SizedBox(height: 8),
                if (events.isEmpty)
                  const _CalendarUnavailable(
                    title: 'No calendar events available',
                    message:
                        'School calendar events will appear here when the school publishes them.',
                  )
                else
                  for (final event in events) ...[
                    _CalendarEventCard(event: event),
                    const SizedBox(height: 10),
                  ],
                const SizedBox(height: 14),
                const PortalCard(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      FeatureIcon(
                        Icons.sync_disabled_rounded,
                        color: ParentPortalColors.orange,
                        size: 42,
                      ),
                      SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Phone calendar sync is not enabled for this school app yet.',
                          style: TextStyle(color: ParentPortalColors.muted),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _CalendarEventCard extends StatelessWidget {
  const _CalendarEventCard({required this.event});

  final ParentPortalUpdate event;

  @override
  Widget build(BuildContext context) {
    return PortalCard(
      onTap: () => _eventSheet(context),
      child: Row(
        children: [
          const FeatureIcon(
            Icons.event_available_rounded,
            color: ParentPortalColors.green,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  event.title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w900,
                    fontSize: 16,
                  ),
                ),
                Text(
                  event.body,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: ParentPortalColors.muted),
                ),
                const SizedBox(height: 4),
                Text(
                  event.metadata,
                  style: const TextStyle(
                    color: ParentPortalColors.green,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
          const ListChevron(),
        ],
      ),
    );
  }

  void _eventSheet(BuildContext context) => showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (_) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const FeatureIcon(
              Icons.event_available_rounded,
              color: ParentPortalColors.green,
              size: 60,
            ),
            const SizedBox(height: 12),
            Text(
              event.title,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 8),
            Text(
              event.body,
              textAlign: TextAlign.center,
              style: const TextStyle(color: ParentPortalColors.muted),
            ),
            const SizedBox(height: 10),
            Text(
              event.metadata,
              style: const TextStyle(
                color: ParentPortalColors.green,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _CalendarUnavailable extends StatelessWidget {
  const _CalendarUnavailable({
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
          children: [
            const FeatureIcon(
              Icons.event_busy_rounded,
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
                  Text(
                    message,
                    style: const TextStyle(color: ParentPortalColors.muted),
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

class _CalendarLoading extends StatelessWidget {
  const _CalendarLoading();

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
    children: const [
      PortalCard(
        child: Row(
          children: [
            FeatureIcon(Icons.calendar_month_rounded),
            SizedBox(width: 12),
            Expanded(
              child: Text(
                'Loading school calendar updates...',
                style: TextStyle(color: ParentPortalColors.muted),
              ),
            ),
          ],
        ),
      ),
    ],
  );
}
