import 'package:flutter_test/flutter_test.dart';
import 'package:schoolos_mobile/features/operational_summary/data/operational_summary_repository.dart';
import 'package:schoolos_mobile/features/operational_summary/domain/operational_summary_models.dart';

void main() {
  test('maps every persona to its dedicated mobile summary endpoint', () {
    final paths = [
      OperationalSummaryRepository.pathFor(OperationalMobilePersona.parent),
      OperationalSummaryRepository.pathFor(OperationalMobilePersona.teacher),
      OperationalSummaryRepository.pathFor(OperationalMobilePersona.principal),
      OperationalSummaryRepository.pathFor(OperationalMobilePersona.driver),
      OperationalSummaryRepository.pathFor(OperationalMobilePersona.staff),
    ];

    expect(paths, [
      '/mobile/parent/summary',
      '/mobile/teacher/summary',
      '/mobile/principal/summary',
      '/mobile/driver/summary',
      '/mobile/staff/summary',
    ]);
    expect(paths.where((path) => path.contains('/dashboard/')), isEmpty);
  });

  test('parses a bounded persona summary without private fields', () {
    final summary = OperationalMobileSummary.fromJson(
      OperationalMobilePersona.parent,
      {
        'generatedAt': '2026-06-20T00:00:00.000Z',
        'schoolDay': '2026-06-20',
        'status': 'partial',
        'summary': {'linkedChildren': 1, 'unpaidInvoices': 2},
        'attentionItems': [
          {
            'key': 'unpaidInvoices',
            'label': 'Review unpaid invoices',
            'count': 2,
            'severity': 'warning',
          },
        ],
      },
    );

    expect(summary.status, OperationalSummaryStatus.partial);
    expect(summary.metrics['linkedChildren'], 1);
    expect(summary.attentionItems.single.count, 2);
  });
}
