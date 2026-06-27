enum OperationalMobilePersona { parent, teacher, principal, driver, staff }

enum OperationalSummaryStatus {
  ready,
  empty,
  partial,
  locked,
  permissionDenied,
}

class OperationalSummaryAttentionItem {
  const OperationalSummaryAttentionItem({
    required this.key,
    required this.label,
    required this.count,
    required this.severity,
  });

  final String key;
  final String label;
  final int count;
  final String severity;

  factory OperationalSummaryAttentionItem.fromJson(Map<String, dynamic> json) {
    return OperationalSummaryAttentionItem(
      key: json['key'] as String? ?? '',
      label: json['label'] as String? ?? 'School item',
      count: (json['count'] as num?)?.toInt() ?? 0,
      severity: json['severity'] as String? ?? 'info',
    );
  }
}

class OperationalMobileSummary {
  const OperationalMobileSummary({
    required this.persona,
    required this.generatedAt,
    required this.schoolDay,
    required this.status,
    required this.metrics,
    required this.attentionItems,
  });

  final OperationalMobilePersona persona;
  final String generatedAt;
  final String schoolDay;
  final OperationalSummaryStatus status;
  final Map<String, Object?> metrics;
  final List<OperationalSummaryAttentionItem> attentionItems;

  factory OperationalMobileSummary.fromJson(
    OperationalMobilePersona persona,
    Map<String, dynamic> json,
  ) {
    final rawSummary = json['summary'];
    final rawAttention = json['attentionItems'];
    return OperationalMobileSummary(
      persona: persona,
      generatedAt: json['generatedAt'] as String? ?? '',
      schoolDay: json['schoolDay'] as String? ?? '',
      status: _parseStatus(json['status'] as String?),
      metrics: rawSummary is Map<String, dynamic>
          ? Map<String, Object?>.from(rawSummary)
          : const {},
      attentionItems: rawAttention is List<dynamic>
          ? rawAttention
                .whereType<Map<String, dynamic>>()
                .map(OperationalSummaryAttentionItem.fromJson)
                .toList(growable: false)
          : const [],
    );
  }

  bool get hasAttention => attentionItems.any((item) => item.count > 0);
}

OperationalSummaryStatus _parseStatus(String? value) {
  return switch (value) {
    'ready' => OperationalSummaryStatus.ready,
    'empty' => OperationalSummaryStatus.empty,
    'partial' => OperationalSummaryStatus.partial,
    'locked' => OperationalSummaryStatus.locked,
    'permissionDenied' => OperationalSummaryStatus.permissionDenied,
    _ => OperationalSummaryStatus.partial,
  };
}
