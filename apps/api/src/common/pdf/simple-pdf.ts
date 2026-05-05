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

export function buildReceiptPdf(input: {
  schoolName: string;
  panNumber?: string | null;
  receiptNumber: string;
  invoiceNumber: string;
  paymentDate: Date;
  method: string;
  cashierName: string;
  student: {
    id: string;
    name: string;
    className: string;
    sectionName?: string | null;
    rollNumber?: number | null;
  };
  lines: Array<{ name: string; amount: number }>;
  subtotal: number;
  discount: number;
  total: number;
  paidAmount: number;
  balance: number;
}) {
  const contentParts = [
    '0.5 w',
    '36 36 540 720 re S', // Outer border
    text(input.schoolName, 48, 726, 16, 'F2'),
    input.panNumber ? text(`PAN: ${input.panNumber}`, 48, 712, 10, 'F1') : '',
    text('FEE RECEIPT', 460, 726, 14, 'F2'),
    '36 696 m 576 696 l S',

    // Receipt Info
    text('Receipt No:', 48, 670, 10, 'F2'),
    text(input.receiptNumber, 120, 670, 10, 'F1'),
    text('Date:', 380, 670, 10, 'F2'),
    text(input.paymentDate.toISOString().slice(0, 10), 420, 670, 10, 'F1'),
    text('Invoice Ref:', 48, 650, 10, 'F2'),
    text(input.invoiceNumber, 120, 650, 10, 'F1'),
    text('Method:', 380, 650, 10, 'F2'),
    text(input.method, 420, 650, 10, 'F1'),

    '36 630 m 576 630 l S',

    // Student Info
    text('Student ID:', 48, 604, 10, 'F2'),
    text(input.student.id, 120, 604, 10, 'F1'),
    text('Name:', 48, 584, 10, 'F2'),
    text(input.student.name, 120, 584, 10, 'F1'),
    text('Class:', 380, 604, 10, 'F2'),
    text(input.student.className, 420, 604, 10, 'F1'),
    text('Section:', 380, 584, 10, 'F2'),
    text(input.student.sectionName ?? 'N/A', 420, 584, 10, 'F1'),

    '36 558 m 576 558 l S',

    // Line Items Header
    text('Description', 48, 532, 10, 'F2'),
    text('Amount', 500, 532, 10, 'F2'),
    '36 520 m 576 520 l S',
  ];

  let y = 496;
  for (const line of input.lines) {
    contentParts.push(
      text(line.name, 48, y, 10, 'F1'),
      text(line.amount.toFixed(2), 500, y, 10, 'F1'),
    );
    y -= 20;
  }

  y -= 10;
  contentParts.push('300 ' + (y + 16) + ' m 576 ' + (y + 16) + ' l S');

  if (input.discount > 0 || input.subtotal !== input.total) {
    contentParts.push(
      text('Subtotal:', 380, y, 10, 'F1'),
      text(input.subtotal.toFixed(2), 500, y, 10, 'F1'),
    );
    y -= 20;
    if (input.discount > 0) {
      contentParts.push(
        text('Discount:', 380, y, 10, 'F1'),
        text('-' + input.discount.toFixed(2), 500, y, 10, 'F1'),
      );
      y -= 20;
    }
  }

  contentParts.push(
    text('Total:', 380, y, 10, 'F2'),
    text(input.total.toFixed(2), 500, y, 10, 'F2'),
    text('Paid Amount:', 380, y - 20, 10, 'F2'),
    text(input.paidAmount.toFixed(2), 500, y - 20, 10, 'F1'),
  );

  y -= 40;
  if (input.balance > 0) {
    contentParts.push(
      text('Balance Due:', 380, y, 10, 'F2'),
      text(input.balance.toFixed(2), 500, y, 10, 'F2'),
    );
  }

  contentParts.push(
    '36 120 m 576 120 l S',
    text('Cashier: ' + input.cashierName, 48, 90, 10, 'F1'),
    text(
      'Printed: ' + new Date().toISOString().replace('T', ' ').slice(0, 19),
      380,
      90,
      8,
      'F1',
    ),
    text('Thank you for your payment.', 220, 60, 10, 'F2'),
  );

  return buildPdfFromContent(contentParts.filter(Boolean).join('\n'));
}

export function buildIdCardPdf(input: {
  schoolName: string;
  studentName: string;
  studentId: string;
  className: string;
  sectionName?: string | null;
  rollNumber?: number | null;
  bloodGroup?: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  academicYear?: string | null;
}) {
  // CR80 standard ID card size (2.125" x 3.375") rotated portrait: ~ 153 x 243 points
  // But since we print on A4, we'll draw a bounding box in the center of the page to represent the ID card

  const contentParts = [
    '0.5 w',
    '200 450 212 337 re S', // 2.125 * 100 x 3.375 * 100 -> roughly ID card size

    // Header
    '200 750 m 412 750 l S',
    text(input.schoolName.substring(0, 30), 210, 765, 12, 'F2'),
    text('STUDENT ID', 270, 730, 12, 'F2'),

    // Photo Placeholder
    '0.2 w',
    '256 610 100 100 re S',
    text('[ PHOTO ]', 280, 656, 10, 'F1'),

    // Student Details
    text(input.studentName, 210, 580, 14, 'F2'),
    text(`ID: ${input.studentId}`, 210, 560, 10, 'F1'),
    text(
      `Class: ${input.className} ${input.sectionName ? '- ' + input.sectionName : ''}`,
      210,
      545,
      10,
      'F1',
    ),

    ...(input.rollNumber
      ? [text(`Roll No: ${input.rollNumber}`, 210, 530, 10, 'F1')]
      : []),
    ...(input.bloodGroup
      ? [text(`Blood: ${input.bloodGroup}`, 320, 530, 10, 'F1')]
      : []),

    // Footer / Emergency
    '200 490 m 412 490 l S',
    text('Emergency Contact:', 210, 475, 8, 'F2'),
    text(input.guardianName ?? 'N/A', 210, 465, 8, 'F1'),
    text(input.guardianPhone ?? 'N/A', 310, 465, 8, 'F1'),

    // Year
    ...(input.academicYear
      ? [text(`Valid for: ${input.academicYear}`, 210, 455, 7, 'F1')]
      : []),
  ];

  return buildPdfFromContent(contentParts.filter(Boolean).join('\n'));
}

export function buildReportCardPdf(input: {
  schoolName: string;
  panNumber?: string | null;
  examName: string;
  academicYear: string;
  student: {
    name: string;
    id: string;
    className: string;
    sectionName?: string | null;
    rollNumber?: number | null;
  };
  subjects: Array<{
    name: string;
    theory?: { max: number; obtained: number; grade: string };
    practical?: { max: number; obtained: number; grade: string };
    totalGrade: string;
    gradePoint: number;
  }>;
  summary: {
    totalMarks: number;
    maxMarks: number;
    percentage: number;
    finalGrade: string;
    finalGpa: number;
    remarks?: string | null;
  };
}) {
  const contentParts = [
    '0.5 w',
    '36 36 540 720 re S', // Outer border
    text(input.schoolName, 48, 726, 18, 'F2'),
    input.panNumber ? text(`PAN: ${input.panNumber}`, 48, 710, 10, 'F1') : '',
    text('PROGRESS REPORT', 420, 726, 14, 'F2'),
    text(`${input.examName} — ${input.academicYear}`, 420, 710, 10, 'F1'),
    '36 696 m 576 696 l S',

    // Student Info
    text('Student Name:', 48, 670, 10, 'F2'),
    text(input.student.name, 140, 670, 10, 'F1'),
    text('Student ID:', 380, 670, 10, 'F2'),
    text(input.student.id, 460, 670, 10, 'F1'),
    text('Class:', 48, 650, 10, 'F2'),
    text(input.student.className, 140, 650, 10, 'F1'),
    text('Section:', 240, 650, 10, 'F2'),
    text(input.student.sectionName ?? 'N/A', 300, 650, 10, 'F1'),
    text('Roll No:', 380, 650, 10, 'F2'),
    text(String(input.student.rollNumber ?? '—'), 460, 650, 10, 'F1'),

    '36 630 m 576 630 l S',

    // Table Header
    text('SUBJECT', 48, 610, 10, 'F2'),
    text('THEORY', 200, 610, 10, 'F2'),
    text('PRAC', 300, 610, 10, 'F2'),
    text('GRADE', 420, 610, 10, 'F2'),
    text('GP', 500, 610, 10, 'F2'),
    '36 600 m 576 600 l S',
  ];

  let y = 580;
  for (const sub of input.subjects) {
    contentParts.push(
      text(sub.name, 48, y, 10, 'F1'),
      sub.theory
        ? text(`${sub.theory.obtained}/${sub.theory.max}`, 200, y, 9, 'F1')
        : text('—', 200, y, 9, 'F1'),
      sub.practical
        ? text(`${sub.practical.obtained}/${sub.practical.max}`, 300, y, 9, 'F1')
        : text('—', 300, y, 9, 'F1'),
      text(sub.totalGrade, 420, y, 10, 'F2'),
      text(sub.gradePoint.toFixed(2), 500, y, 10, 'F1'),
    );
    y -= 22;

    if (y < 120) break; // Simple page break prevention for now
  }

  y -= 10;
  contentParts.push('36 ' + (y + 12) + ' m 576 ' + (y + 12) + ' l S');

  // Summary
  contentParts.push(
    text('Percentage:', 380, y - 10, 10, 'F2'),
    text(`${input.summary.percentage.toFixed(2)}%`, 500, y - 10, 10, 'F1'),
    text('Final Grade:', 380, y - 30, 10, 'F2'),
    text(input.summary.finalGrade, 500, y - 30, 12, 'F2'),
    text('GPA:', 380, y - 50, 10, 'F2'),
    text(input.summary.finalGpa.toFixed(2), 500, y - 50, 12, 'F2'),
  );

  if (input.summary.remarks) {
    contentParts.push(
      text('Remarks:', 48, y - 10, 10, 'F2'),
      ...wrapPdfLine(input.summary.remarks, 48, y - 28, 280, 10),
    );
  }

  // Footer Signatures
  contentParts.push(
    '72 80 m 200 80 l S',
    text('Class Teacher', 90, 65, 10, 'F1'),
    '380 80 m 508 80 l S',
    text('Principal', 420, 65, 10, 'F1'),
    text(
      `Printed on: ${new Date().toISOString().slice(0, 10)}`,
      240,
      20,
      8,
      'F1',
    ),
  );

  return buildPdfFromContent(contentParts.filter(Boolean).join('\n'));
}

function escapePdfText(text: string | number | null | undefined) {
  const safeText = String(text ?? 'N/A');
  return safeText
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
  value: string | number | null | undefined,
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
