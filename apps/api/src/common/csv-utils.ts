/**
 * Converts an array of objects into a CSV string.
 * @param data Array of objects to convert
 * @returns CSV string
 */
export function convertToCsv(data: Array<Record<string, unknown>>): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const rows = data.map((obj) =>
    headers
      .map((header) => {
        const val = obj[header];
        if (val === null || val === undefined) return '""';

        // Handle Date objects
        if (val instanceof Date) {
          return `"${val.toISOString().split('T')[0]}"`;
        }

        const stringVal =
          val !== null && typeof val === 'object'
            ? JSON.stringify(val)
            : String(val); // eslint-disable-line @typescript-eslint/no-base-to-string
        const escapedVal = stringVal.replace(/"/g, '""');
        return `"${escapedVal}"`;
      })
      .join(','),
  );

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Formats a decimal value for CSV export, ensuring it's deterministic and NPR-safe.
 * @param value Number or decimal-like object to format
 * @returns Formatted string
 */
export function formatCsvDecimal(value: unknown): string {
  if (value === null || value === undefined) return '0.00';

  // If it's a decimal-like object (e.g. Prisma.Decimal), it will have a toFixed method
  if (
    typeof value === 'object' &&
    value !== null &&
    'toFixed' in value &&
    typeof value.toFixed === 'function'
  ) {
    return (value as { toFixed: (p: number) => string }).toFixed(2);
  }

  const num = Number(value);
  return isNaN(num) ? '0.00' : num.toFixed(2);
}
