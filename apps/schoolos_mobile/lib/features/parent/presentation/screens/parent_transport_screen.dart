import 'dart:math';
import 'package:flutter/material.dart';
import '../../domain/parent_feature_models.dart';
import '../widgets/parent_detail_widgets.dart';
import '../widgets/parent_portal_widgets.dart';

class ParentTransportScreen extends StatefulWidget {
  const ParentTransportScreen({super.key});
  @override
  State<ParentTransportScreen> createState() => _ParentTransportScreenState();
}

class _ParentTransportScreenState extends State<ParentTransportScreen> {
  ChildProfile child = parentChildren.first;
  int eta = 7;
  String updated = '6:20 AM';
  @override
  Widget build(BuildContext context) => ParentDetailScaffold(
    title: 'Transport',
    selectedIndex: 4,
    body: ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
      children: [
        ParentChildSelector(
          child: child,
          onChanged: (value) => setState(() => child = value),
        ),
        const SizedBox(height: 14),
        PortalCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const FeatureIcon(Icons.directions_bus_rounded),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      child.id == 'aarav'
                          ? 'Butwal East Route'
                          : 'Butwal Central Route',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              const Row(
                children: [
                  Expanded(child: _RouteMetric('Pickup stop', 'Jankinagar')),
                  Expanded(child: _RouteMetric('Morning pickup', '7:45 AM')),
                  Expanded(child: _RouteMetric('Return drop', '3:15 PM')),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        PortalCard(
          child: Column(
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Bus on route',
                          style: TextStyle(
                            color: ParentPortalColors.green,
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 6),
                        const Align(
                          alignment: Alignment.centerLeft,
                          child: StatusBadge(label: 'Live'),
                        ),
                        const SizedBox(height: 10),
                        const Text(
                          'ETA',
                          style: TextStyle(color: ParentPortalColors.muted),
                        ),
                        Text(
                          '$eta minutes',
                          style: const TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'Bus number',
                          style: TextStyle(color: ParentPortalColors.muted),
                        ),
                        const Text(
                          'BA 2 KHA 1234',
                          style: TextStyle(fontWeight: FontWeight.w900),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(child: _MockRouteMap()),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Last updated • $updated',
                      style: const TextStyle(
                        fontSize: 12,
                        color: ParentPortalColors.muted,
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: _refresh,
                    icon: const Icon(Icons.refresh_rounded),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        PortalCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              _contact(
                context,
                Icons.person_rounded,
                'Driver',
                'Ramesh Gurung',
              ),
              const Divider(height: 1),
              _contact(
                context,
                Icons.apartment_rounded,
                'Transport Office',
                'Greenfield Academy Transport',
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        PortalCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const ParentSectionHeader(title: 'Weekly trip schedule'),
              const SizedBox(height: 8),
              for (final day in const [
                'Monday',
                'Tuesday',
                'Wednesday',
                'Thursday',
                'Friday',
              ])
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 7),
                  child: Row(
                    children: [
                      SizedBox(
                        width: 80,
                        child: Text(
                          day,
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                      ),
                      const Expanded(
                        child: Text(
                          'Pickup 7:45 AM • Drop 3:15 PM',
                          style: TextStyle(
                            fontSize: 12,
                            color: ParentPortalColors.muted,
                          ),
                        ),
                      ),
                      const StatusBadge(label: 'Scheduled'),
                    ],
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        const PortalCard(
          color: ParentPortalColors.blueSoft,
          padding: EdgeInsets.all(12),
          child: Row(
            children: [
              Icon(Icons.info_outline_rounded, color: ParentPortalColors.blue),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Live GPS location may be delayed by a few minutes.',
                  style: TextStyle(color: ParentPortalColors.muted),
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );
  Widget _contact(
    BuildContext context,
    IconData icon,
    String title,
    String subtitle,
  ) => ListTile(
    leading: FeatureIcon(icon, color: ParentPortalColors.green, size: 42),
    title: Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
    subtitle: Text(subtitle),
    trailing: OutlinedButton.icon(
      onPressed: () =>
          showFeatureSnack(context, 'Call confirmation opened for $title.'),
      icon: const Icon(Icons.phone_rounded),
      label: const Text('Call'),
    ),
  );
  void _refresh() {
    setState(() {
      eta = 5 + Random().nextInt(5);
      updated = 'Just now';
    });
    showFeatureSnack(context, 'Live route refreshed.');
  }
}

class _RouteMetric extends StatelessWidget {
  const _RouteMetric(this.label, this.value);
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        label,
        style: const TextStyle(fontSize: 11, color: ParentPortalColors.muted),
      ),
      Text(value, style: const TextStyle(fontWeight: FontWeight.w900)),
    ],
  );
}

class _MockRouteMap extends StatelessWidget {
  const _MockRouteMap();
  @override
  Widget build(BuildContext context) => Container(
    height: 170,
    clipBehavior: Clip.antiAlias,
    decoration: BoxDecoration(
      color: const Color(0xFFF0F4F8),
      borderRadius: BorderRadius.circular(16),
    ),
    child: Stack(
      children: [
        for (final p in const [20.0, 55.0, 90.0, 125.0])
          Positioned(
            left: p,
            top: 0,
            bottom: 0,
            child: Container(width: 2, color: Colors.white),
          ),
        for (final p in const [24.0, 62.0, 100.0, 138.0])
          Positioned(
            left: 0,
            right: 0,
            top: p,
            child: Container(height: 2, color: Colors.white),
          ),
        Positioned(
          left: 28,
          top: 38,
          child: Transform.rotate(
            angle: .35,
            child: Container(
              width: 120,
              height: 5,
              decoration: BoxDecoration(
                color: ParentPortalColors.purple,
                borderRadius: BorderRadius.circular(8),
              ),
            ),
          ),
        ),
        const Positioned(
          left: 22,
          top: 30,
          child: Icon(
            Icons.location_on_rounded,
            color: ParentPortalColors.green,
            size: 28,
          ),
        ),
        const Positioned(
          left: 88,
          top: 60,
          child: FeatureIcon(Icons.directions_bus_rounded, size: 36),
        ),
        const Positioned(
          right: 18,
          bottom: 22,
          child: Icon(
            Icons.location_on_rounded,
            color: ParentPortalColors.blue,
            size: 30,
          ),
        ),
      ],
    ),
  );
}
