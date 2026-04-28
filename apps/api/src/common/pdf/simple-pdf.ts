export function buildSimplePdf(lines: string[]) {
  const content = [
    'BT',
    '/F1 16 Tf',
    '72 770 Td',
    ...lines.flatMap((line, index) => [
      `(${escapePdfText(line)}) Tj`,
      index === 0 ? '/F1 11 Tf' : '',
      '0 -24 Td',
    ]),
    'ET',
  ]
    .filter(Boolean)
    .join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  const chunks = ['%PDF-1.4\n'];
  const offsets = [0];

  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(chunks.join('')));
    chunks.push(`${index + 1} 0 obj\n${object}\nendobj\n`);
  }

  const xrefOffset = Buffer.byteLength(chunks.join(''));
  chunks.push(`xref\n0 ${objects.length + 1}\n`);
  chunks.push('0000000000 65535 f \n');

  for (const offset of offsets.slice(1)) {
    chunks.push(`${String(offset).padStart(10, '0')} 00000 n \n`);
  }

  chunks.push(
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
  );

  return Buffer.from(chunks.join(''));
}

export function buildCertificatePdf(input: {
  schoolName: string;
  title: string;
  subtitle?: string;
  referenceNumber: string;
  issuedAt: Date;
  fields: Array<{ label: string; value: string | number | null | undefined }>;
  body: string[];
  footer: string[];
  signature: {
    signerName: string;
    signerRole: string;
    verificationText: string;
  };
}) {
  const contentParts = [
    '0.12 w',
    '44 44 524 704 re S',
    '52 52 508 688 re S',
    text(input.schoolName, 72, 716, 18, 'F2'),
    text(input.title.toUpperCase(), 72, 690, 15, 'F2'),
    ...(input.subtitle ? [text(input.subtitle, 72, 670, 10, 'F1')] : []),
    text(`Reference: ${input.referenceNumber}`, 386, 716, 9, 'F1'),
    text(
      `Issued: ${input.issuedAt.toISOString().slice(0, 10)}`,
      386,
      702,
      9,
      'F1',
    ),
    '72 650 m 540 650 l S',
    ...input.fields.flatMap((field, index) => {
      const x = index % 2 === 0 ? 72 : 318;
      const y = 622 - Math.floor(index / 2) * 32;

      return [
        text(field.label.toUpperCase(), x, y, 7, 'F2'),
        text(String(field.value ?? 'N/A'), x, y - 14, 10, 'F1'),
      ];
    }),
    ...input.body.flatMap((line, index) =>
      wrapPdfLine(line, 72, 462 - index * 38, 468, 10),
    ),
    '72 178 m 250 178 l S',
    text(input.signature.signerName, 72, 160, 10, 'F2'),
    text(input.signature.signerRole, 72, 146, 9, 'F1'),
    text(input.signature.verificationText, 72, 116, 8, 'F1'),
    '72 100 m 540 100 l S',
    ...input.footer.flatMap((line, index) =>
      text(line, 72, 82 - index * 12, 8, 'F1'),
    ),
  ];

  return buildPdfFromContent(contentParts.join('\n'));
}

function escapePdfText(text: string) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function buildPdfFromContent(content: string) {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
  ];

  const chunks = ['%PDF-1.4\n'];
  const offsets = [0];

  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(chunks.join('')));
    chunks.push(`${index + 1} 0 obj\n${object}\nendobj\n`);
  }

  const xrefOffset = Buffer.byteLength(chunks.join(''));
  chunks.push(`xref\n0 ${objects.length + 1}\n`);
  chunks.push('0000000000 65535 f \n');

  for (const offset of offsets.slice(1)) {
    chunks.push(`${String(offset).padStart(10, '0')} 00000 n \n`);
  }

  chunks.push(
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
  );

  return Buffer.from(chunks.join(''));
}

function text(
  value: string,
  x: number,
  y: number,
  size: number,
  font: 'F1' | 'F2',
) {
  return `BT /${font} ${size} Tf ${x} ${y} Td (${escapePdfText(value)}) Tj ET`;
}

function wrapPdfLine(
  value: string,
  x: number,
  y: number,
  width: number,
  size: number,
) {
  const maxChars = Math.max(32, Math.floor(width / (size * 0.52)));
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;

    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
      continue;
    }

    current = next;
  }

  if (current) {
    lines.push(current);
  }

  return lines.map((line, index) => text(line, x, y - index * 14, size, 'F1'));
}
