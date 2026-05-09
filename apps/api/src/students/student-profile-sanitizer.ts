const PRIVATE_FILE_FIELDS = new Set([
  'objectKey',
  'publicUrl',
  'storageObjectKey',
  'pdfUrl',
  'transferCertUrl',
]);

export function sanitizeStudentProfileResponse<T>(value: T): T {
  return sanitizeValue(value) as T;
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date) {
    return value;
  }

  const output: Record<string, unknown> = {};

  for (const [key, childValue] of Object.entries(value)) {
    if (PRIVATE_FILE_FIELDS.has(key)) {
      continue;
    }

    output[key] = sanitizeValue(childValue);
  }

  return output;
}
