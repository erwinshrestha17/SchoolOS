import 'package:flutter_test/flutter_test.dart';
import 'package:schoolos_mobile/features/operational_summary/data/operational_summary_repository.dart';
import 'package:schoolos_mobile/features/operational_summary/domain/operational_summary_models.dart';

void main() {
  test('maps every persona to its dedicated mobile summary endpoint', () {
    expect(
      OperationalSummaryRepository.pathFor(OperationalMobilePersona.parent),
      '/mobile/parent/summary',
    );
    expect(
      OperationalSummaryRepository.pathFor(OperationalMobilePersona.teacher),
      '/mobile/teacher/summary',
    );
    expect(
      OperationalSummaryRepository.pathFor(OperationalMobilePersona.principal),
      '/mobile/principal/summary',
    );
    expect(
      OperationalSummaryRepository.pathFor(OperationalMobilePersona.driver),
      '/mobile/driver/summary',
    );
    expect(
      OperationalSummaryRepository.pathFor(OperationalMobilePersona.staff),
      '/mobile/staff/summary',
    );
    expect(
      OperationalSummaryRepository.pathFor(OperationalMobilePersona.student),
      '/mobile/student/summary',
    );
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
