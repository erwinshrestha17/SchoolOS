/// Money as a parent reads it.
///
/// The parent screens used to print `NPR 3700`. "NPR" is the ISO code banks
/// use; a guardian in Nepal reads `Rs`. Thousands were unseparated, so a
/// four-figure school fee and a five-figure one looked alike at a glance.
///
/// Deliberately not `intl`'s NumberFormat: the app ships no `ne_NP` locale
/// data, and the grouping rule here is the plain three-digit one already used
/// on the printed receipt - not the Nepali lakh/crore grouping, which the
/// school's own invoices do not use either.
library;

/// `3700` -> `Rs 3,700`. `3700.5` -> `Rs 3,700.50`.
///
/// Whole amounts drop the decimals, because a fee of `Rs 3,700.00` reads as
/// though the precision matters when it does not.
String formatMoney(num value) => 'Rs ${formatAmount(value)}';

/// The number alone, for places that already say what the currency is.
String formatAmount(num value) {
  final negative = value < 0;
  final absolute = value.abs();
  final isWhole = absolute == absolute.roundToDouble();
  final text = isWhole
      ? absolute.round().toString()
      : absolute.toStringAsFixed(2);
  final parts = text.split('.');
  final grouped = _groupThousands(parts.first);
  final decimals = parts.length > 1 ? '.${parts[1]}' : '';
  return '${negative ? '-' : ''}$grouped$decimals';
}

String _groupThousands(String digits) {
  if (digits.length <= 3) return digits;
  final buffer = StringBuffer();
  final leading = digits.length % 3;
  if (leading > 0) {
    buffer.write(digits.substring(0, leading));
  }
  for (var index = leading; index < digits.length; index += 3) {
    if (buffer.isNotEmpty) buffer.write(',');
    buffer.write(digits.substring(index, index + 3));
  }
  return buffer.toString();
}
