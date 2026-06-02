import QRCode from 'qrcode';

export interface PdfImage {
  buffer: Buffer;
  width: number;
  height: number;
  format: 'jpeg';
}

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

  return buildPdfObjects(objects);
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
  logo?: PdfImage | null;
}) {
  const issuedDate = formatIsoDate(input.issuedAt);
  const contentParts = [
    ...pageFrame(
      'CERTIFICATE',
      input.schoolName,
      input.subtitle ?? 'Official school record',
      input.logo ? 'Img1' : undefined,
    ),
    pill(390, 694, 150, 34),
    text('REFERENCE', 402, 716, 7, 'F2'),
    text(input.referenceNumber, 402, 703, 9, 'F1'),
    text(`Issued: ${issuedDate}`, 402, 689, 8, 'F1'),
    text(input.title.toUpperCase(), 72, 646, 20, 'F2'),
    '72 632 m 540 632 l S',
    ...input.fields.flatMap((field, index) => {
      const x = index % 2 === 0 ? 72 : 318;
      const y = 602 - Math.floor(index / 2) * 40;

      return [
        sectionLabel(field.label, x, y),
        text(String(field.value ?? 'N/A'), x, y - 15, 11, 'F1'),
      ];
    }),
    '72 468 m 540 468 l S',
    ...input.body.flatMap((line, index) =>
      wrapPdfLine(line, 86, 438 - index * 42, 438, 11),
    ),
    '72 178 m 252 178 l S',
    text(input.signature.signerName, 72, 158, 11, 'F2'),
    text(input.signature.signerRole, 72, 143, 9, 'F1'),
    text(input.signature.verificationText, 72, 116, 8, 'F1'),
    '72 100 m 540 100 l S',
    ...input.footer.flatMap((line, index) =>
      text(line, 72, 82 - index * 12, 8, 'F1'),
    ),
  ];

  return buildPdfFromContent(
    contentParts.filter(Boolean).join('\n'),
    input.logo,
  );
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
  isReprint?: boolean;
  logo?: PdfImage | null;
}) {
  const contentParts = [
    ...pageFrame(
      'FEE RECEIPT',
      input.schoolName,
      input.panNumber ? `PAN: ${input.panNumber}` : 'Official payment receipt',
      input.logo ? 'Img1' : undefined,
    ),
    input.isReprint ? stamp('REPRINT', 456, 688) : '',
    infoBox(48, 628, 228, 54),
    sectionLabel('Receipt Details', 60, 664),
    text(`Receipt No: ${input.receiptNumber}`, 60, 648, 9, 'F1'),
    text(`Invoice Ref: ${input.invoiceNumber}`, 60, 634, 9, 'F1'),
    infoBox(336, 628, 204, 54),
    sectionLabel('Payment Details', 348, 664),
    text(`Date: ${formatIsoDate(input.paymentDate)}`, 348, 648, 9, 'F1'),
    text(`Method: ${input.method}`, 348, 634, 9, 'F1'),
    infoBox(48, 548, 492, 58),
    sectionLabel('Student', 60, 588),
    text(input.student.name, 60, 572, 12, 'F2'),
    text(`ID: ${input.student.id}`, 60, 556, 9, 'F1'),
    text(`Class: ${input.student.className}`, 314, 572, 9, 'F1'),
    text(`Section: ${input.student.sectionName ?? 'N/A'}`, 314, 558, 9, 'F1'),
    input.student.rollNumber
      ? text(`Roll No: ${input.student.rollNumber}`, 430, 558, 9, 'F1')
      : '',
    tableHeader(48, 512, ['Description', 'Amount'], [372, 120]),
  ];

  let y = 488;
  for (const line of input.lines.slice(0, 12)) {
    contentParts.push(
      text(line.name, 60, y, 9, 'F1'),
      moneyText(line.amount, 482, y, 'F1'),
    );
    y -= 18;
  }

  y = Math.max(y - 12, 236);
  contentParts.push(`336 ${y + 18} m 540 ${y + 18} l S`);

  if (input.discount > 0 || input.subtotal !== input.total) {
    contentParts.push(
      text('Subtotal', 350, y, 9, 'F1'),
      moneyText(input.subtotal, 482, y, 'F1'),
    );
    y -= 18;

    if (input.discount > 0) {
      contentParts.push(
        text('Discount', 350, y, 9, 'F1'),
        moneyText(-input.discount, 482, y, 'F1'),
      );
      y -= 18;
    }
  }

  contentParts.push(
    text('Total', 350, y, 11, 'F2'),
    moneyText(input.total, 482, y, 'F2'),
    text('Paid Amount', 350, y - 20, 10, 'F2'),
    moneyText(input.paidAmount, 482, y - 20, 'F2'),
  );

  if (input.balance > 0) {
    contentParts.push(
      text('Balance Due', 350, y - 40, 10, 'F2'),
      moneyText(input.balance, 482, y - 40, 'F2'),
    );
  }

  contentParts.push(
    '48 128 m 540 128 l S',
    text(`Cashier: ${input.cashierName}`, 48, 102, 9, 'F1'),
    text(`Printed: ${formatDateTime(new Date())}`, 342, 102, 8, 'F1'),
    text('Thank you for your payment.', 214, 72, 11, 'F2'),
    text(
      'This receipt is system generated and valid only with official SchoolOS records.',
      116,
      52,
      8,
      'F1',
    ),
  );

  return buildPdfFromContent(
    contentParts.filter(Boolean).join('\n'),
    input.logo,
  );
}

export function buildSalarySlipPdf(input: {
  schoolName: string;
  panNumber?: string | null;
  payslipNumber: string;
  period: string;
  staff: {
    name: string;
    id: string;
    designation?: string | null;
    bankAccount?: string | null;
    panNumber?: string | null;
  };
  earnings: Array<{ name: string; amount: number }>;
  deductions: Array<{ name: string; amount: number }>;
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  attendance: {
    present: number;
    working: number;
  };
  logo?: PdfImage | null;
}) {
  const contentParts = [
    ...pageFrame(
      'SALARY SLIP',
      input.schoolName,
      input.panNumber ? `PAN: ${input.panNumber}` : input.period,
      input.logo ? 'Img1' : undefined,
    ),
    infoBox(48, 622, 492, 62),
    sectionLabel('Employee', 60, 666),
    text(input.staff.name, 60, 650, 12, 'F2'),
    text(`Employee ID: ${input.staff.id}`, 60, 634, 9, 'F1'),
    text(`Designation: ${input.staff.designation ?? 'N/A'}`, 260, 650, 9, 'F1'),
    text(`Bank A/C: ${input.staff.bankAccount ?? 'N/A'}`, 260, 634, 9, 'F1'),
    text(`PAN: ${input.staff.panNumber ?? 'N/A'}`, 420, 650, 9, 'F1'),
    text(`Payslip: ${input.payslipNumber}`, 420, 634, 9, 'F1'),
    tableHeader(
      48,
      592,
      ['Earnings', 'Amount', 'Deductions', 'Amount'],
      [170, 92, 170, 92],
    ),
    '306 580 m 306 300 l S',
  ];

  let y = 560;
  const maxRows = Math.max(input.earnings.length, input.deductions.length);
  for (let i = 0; i < maxRows && y >= 318; i++) {
    const earning = input.earnings[i] as
      | (typeof input.earnings)[number]
      | undefined;
    const deduction = input.deductions[i] as
      | (typeof input.deductions)[number]
      | undefined;

    if (earning) {
      contentParts.push(
        text(earning.name, 60, y, 9, 'F1'),
        moneyText(earning.amount, 222, y, 'F1'),
      );
    }

    if (deduction) {
      contentParts.push(
        text(deduction.name, 318, y, 9, 'F1'),
        moneyText(deduction.amount, 482, y, 'F1'),
      );
    }

    y -= 18;
  }

  contentParts.push(
    '48 300 m 540 300 l S',
    text('Gross Earnings', 60, 278, 10, 'F2'),
    moneyText(input.grossSalary, 222, 278, 'F2'),
    text('Total Deductions', 318, 278, 10, 'F2'),
    moneyText(input.totalDeductions, 482, 278, 'F2'),
    infoBox(306, 220, 234, 44),
    text('NET SALARY', 318, 248, 11, 'F2'),
    moneyText(input.netSalary, 456, 248, 'F2'),
    text(
      `Attendance: ${input.attendance.present} / ${input.attendance.working} Days`,
      60,
      248,
      10,
      'F1',
    ),
    '72 118 m 212 118 l S',
    text('Employer Signature', 86, 100, 9, 'F1'),
    '380 118 m 520 118 l S',
    text('Employee Signature', 396, 100, 9, 'F1'),
    text(
      'Computer generated document. Physical signature may be added after review.',
      118,
      54,
      8,
      'F1',
    ),
  );

  return buildPdfFromContent(
    contentParts.filter(Boolean).join('\n'),
    input.logo,
  );
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
  qrToken?: string | null;
  logo?: PdfImage | null;
}) {
  const left = 200;
  const bottom = 432;
  const width = 212;
  const height = 337;
  const contentParts = [
    '0.8 w',
    `${left} ${bottom} ${width} ${height} re S`,
    `${left + 8} ${bottom + 8} ${width - 16} ${height - 16} re S`,
    input.logo
      ? `q 40 0 0 40 ${left + 14} ${bottom + height - 54} cm /Img1 Do Q`
      : '',
    text(
      fitText(input.schoolName, 29),
      left + (input.logo ? 58 : 14),
      bottom + height - 28,
      input.logo ? 9 : 11,
      'F2',
    ),
    text('STUDENT ID CARD', left + 50, bottom + height - 48, 10, 'F2'),
    `${left + 20} ${bottom + 176} 88 96 re S`,
    text('PHOTO', left + 48, bottom + 220, 9, 'F1'),
    text(fitText(input.studentName, 24), left + 20, bottom + 152, 13, 'F2'),
    text(`ID: ${input.studentId}`, left + 20, bottom + 132, 9, 'F1'),
    text(
      `Class: ${input.className}${input.sectionName ? ' - ' + input.sectionName : ''}`,
      left + 20,
      bottom + 116,
      9,
      'F1',
    ),
    input.rollNumber
      ? text(`Roll No: ${input.rollNumber}`, left + 20, bottom + 100, 9, 'F1')
      : '',
    input.bloodGroup
      ? text(`Blood: ${input.bloodGroup}`, left + 124, bottom + 100, 9, 'F2')
      : '',
    `${left + 14} ${bottom + 76} m ${left + width - 14} ${bottom + 76} l S`,
    sectionLabel('Emergency Contact', left + 20, bottom + 60),
    text(
      fitText(input.guardianName ?? 'N/A', 22),
      left + 20,
      bottom + 45,
      8,
      'F1',
    ),
    text(input.guardianPhone ?? 'N/A', left + 122, bottom + 45, 8, 'F1'),
    input.academicYear
      ? text(
          `Valid for: ${input.academicYear}`,
          left + 20,
          bottom + 26,
          7,
          'F1',
        )
      : '',
  ];

  if (input.qrToken) {
    contentParts.push(
      renderQrTokenAsPdfBlocks(
        input.qrToken,
        left + width - 72,
        bottom + 96,
        56,
      ),
      text('SCAN ID', left + width - 68, bottom + 86, 6, 'F2'),
    );
  }

  return buildPdfFromContent(
    contentParts.filter(Boolean).join('\n'),
    input.logo,
  );
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
  logo?: PdfImage | null;
}) {
  const contentParts = [
    ...pageFrame(
      'PROGRESS REPORT',
      input.schoolName,
      input.panNumber
        ? `PAN: ${input.panNumber}`
        : `${input.examName} - ${input.academicYear}`,
      input.logo ? 'Img1' : undefined,
    ),
    infoBox(48, 626, 492, 58),
    sectionLabel('Student', 60, 666),
    text(input.student.name, 60, 650, 12, 'F2'),
    text(`ID: ${input.student.id}`, 60, 634, 9, 'F1'),
    text(`Class: ${input.student.className}`, 300, 650, 9, 'F1'),
    text(`Section: ${input.student.sectionName ?? 'N/A'}`, 300, 634, 9, 'F1'),
    text(`Roll No: ${input.student.rollNumber ?? '—'}`, 430, 634, 9, 'F1'),
    tableHeader(
      48,
      596,
      ['Subject', 'Theory', 'Practical', 'Grade', 'GP'],
      [150, 100, 110, 82, 50],
    ),
  ];

  let y = 572;
  for (const subject of input.subjects.slice(0, 18)) {
    contentParts.push(
      text(subject.name, 60, y, 9, 'F1'),
      text(
        subject.theory
          ? `${subject.theory.obtained}/${subject.theory.max}`
          : '—',
        204,
        y,
        9,
        'F1',
      ),
      text(
        subject.practical
          ? `${subject.practical.obtained}/${subject.practical.max}`
          : '—',
        304,
        y,
        9,
        'F1',
      ),
      text(subject.totalGrade, 424, y, 10, 'F2'),
      text(subject.gradePoint.toFixed(2), 506, y, 9, 'F1'),
    );
    y -= 20;
  }

  const summaryY = Math.max(y - 10, 170);
  contentParts.push(
    `48 ${summaryY + 16} m 540 ${summaryY + 16} l S`,
    text('Percentage', 344, summaryY, 10, 'F2'),
    text(`${input.summary.percentage.toFixed(2)}%`, 474, summaryY, 10, 'F1'),
    text('Final Grade', 344, summaryY - 20, 10, 'F2'),
    text(input.summary.finalGrade, 474, summaryY - 20, 12, 'F2'),
    text('GPA', 344, summaryY - 40, 10, 'F2'),
    text(input.summary.finalGpa.toFixed(2), 474, summaryY - 40, 12, 'F2'),
  );

  if (input.summary.remarks) {
    contentParts.push(
      sectionLabel('Remarks', 60, summaryY),
      ...wrapPdfLine(input.summary.remarks, 60, summaryY - 16, 250, 9),
    );
  }

  contentParts.push(
    '72 86 m 206 86 l S',
    text('Class Teacher', 92, 68, 9, 'F1'),
    '376 86 m 510 86 l S',
    text('Principal', 422, 68, 9, 'F1'),
    text(`Printed on: ${formatIsoDate(new Date())}`, 238, 36, 8, 'F1'),
  );

  return buildPdfFromContent(
    contentParts.filter(Boolean).join('\n'),
    input.logo,
  );
}

export function buildTableReportPdf(input: {
  schoolName: string;
  title: string;
  subtitle?: string | null;
  generatedAt?: Date;
  rows: Array<Record<string, unknown>>;
  maxColumns?: number;
  summaryCards?: Array<{
    label: string;
    value: string | number;
    note?: string | null;
  }>;
  logo?: PdfImage | null;
}) {
  const headers = Object.keys(input.rows[0] ?? {}).slice(
    0,
    input.maxColumns ?? 6,
  );
  const widths = headers.map(() => 492 / Math.max(headers.length, 1));
  const summaryRows = chunk(input.summaryCards ?? [], 4);
  const tableTopY = summaryRows.length
    ? 640 - summaryRows.length * 42 - 22
    : 640;
  const contentParts = [
    ...pageFrame(
      fitText(input.title.toUpperCase(), 24),
      input.schoolName,
      input.subtitle ?? 'Generated report export',
      input.logo ? 'Img1' : undefined,
    ),
    text(
      `Generated: ${formatDateTime(input.generatedAt ?? new Date())}`,
      48,
      672,
      8,
      'F1',
    ),
    ...reportSummaryCards(summaryRows),
    tableHeader(
      48,
      tableTopY,
      headers.length ? headers : ['Status'],
      widths.length ? widths : [492],
    ),
  ];

  let y = tableTopY - 24;
  const rows = input.rows.length ? input.rows : [{ Status: 'No rows found' }];
  for (const row of rows.slice(0, 30)) {
    let x = 60;
    for (const [index, header] of headers.entries()) {
      const value = row[header];
      contentParts.push(text(fitText(formatPdfCell(value), 18), x, y, 7, 'F1'));
      x += widths[index] ?? 82;
    }
    y -= 16;
  }

  contentParts.push(
    '48 76 m 540 76 l S',
    text(`Rows in export: ${input.rows.length}`, 48, 54, 8, 'F2'),
    text('Protected SchoolOS report snapshot', 360, 54, 8, 'F1'),
  );

  return buildPdfFromContent(
    contentParts.filter(Boolean).join('\n'),
    input.logo,
  );
}

function reportSummaryCards(
  rows: Array<
    Array<{ label: string; value: string | number; note?: string | null }>
  >,
) {
  if (rows.length === 0) {
    return [];
  }

  const parts = [text('CONTROL TOTALS', 48, 656, 8, 'F2')];
  rows.forEach((row, rowIndex) => {
    const cardWidth = 492 / Math.max(row.length, 1);
    const topY = 644 - rowIndex * 42;

    row.forEach((card, index) => {
      const x = 48 + index * cardWidth;
      parts.push(
        infoBox(x, topY - 32, cardWidth - 8, 34),
        text(fitText(card.label.toUpperCase(), 20), x + 8, topY - 10, 7, 'F1'),
        text(
          fitText(formatPdfCell(card.value), 20),
          x + 8,
          topY - 23,
          10,
          'F2',
        ),
      );
      if (card.note) {
        parts.push(
          text(fitText(card.note, 18), x + cardWidth - 96, topY - 23, 7, 'F1'),
        );
      }
    });
  });

  return parts;
}

function chunk<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

export function buildRosterPdf(input: {
  schoolName: string;
  className?: string | null;
  sectionName?: string | null;
  academicYear?: string | null;
  headers: string[];
  rows: Array<Record<string, unknown>>;
  logo?: PdfImage | null;
}) {
  return buildTableReportPdf({
    schoolName: input.schoolName,
    title: 'STUDENT ROSTER',
    subtitle:
      `${input.className ?? ''} ${input.sectionName ? '(' + input.sectionName + ')' : ''} ${input.academicYear ? '- ' + input.academicYear : ''}`.trim(),
    rows: input.rows,
    logo: input.logo,
  });
}

function escapePdfText(input: string | number | null | undefined) {
  const safeText = String(input ?? 'N/A');
  return safeText
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function buildPdfFromContent(content: string, logo?: PdfImage | null) {
  const objects: Array<string | Buffer> = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> ${
      logo ? '/XObject << /Img1 7 0 R >>' : ''
    } >> /Contents 4 0 R >>`,
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
  ];

  if (logo) {
    objects.push(
      `<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.buffer.length} >>\nstream\n`,
      logo.buffer,
      '\nendstream',
    );
  }

  return buildPdfObjects(objects);
}

function buildPdfObjects(objects: Array<string | Buffer>) {
  const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n')];
  const offsets: number[] = [0];
  let currentOffset = chunks[0].length;

  for (const [index, obj] of objects.entries()) {
    offsets.push(currentOffset);
    const header = Buffer.from(`${index + 1} 0 obj\n`);
    const body = typeof obj === 'string' ? Buffer.from(obj) : obj;
    const footer = Buffer.from('\nendobj\n');

    chunks.push(header, body, footer);
    currentOffset += header.length + body.length + footer.length;
  }

  const xrefOffset = currentOffset;
  chunks.push(Buffer.from(`xref\n0 ${objects.length + 1}\n`));
  chunks.push(Buffer.from('0000000000 65535 f \n'));

  for (const offset of offsets.slice(1)) {
    chunks.push(Buffer.from(`${String(offset).padStart(10, '0')} 00000 n \n`));
  }

  chunks.push(
    Buffer.from(
      `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
    ),
  );

  return Buffer.concat(chunks);
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

function pageFrame(
  title: string,
  schoolName: string,
  subtitle: string,
  logoKey?: string,
) {
  const parts = [
    '0.6 w',
    '36 36 540 720 re S',
    '44 44 524 704 re S',
    logoKey ? `q 42 0 0 42 58 696 cm /${logoKey} Do Q` : '',
    text(fitText(schoolName, 46), logoKey ? 108 : 58, 724, 17, 'F2'),
    text(subtitle, logoKey ? 108 : 58, 706, 9, 'F1'),
    text(title, 390, 724, 15, 'F2'),
    '58 690 m 540 690 l S',
  ];
  return parts;
}

function infoBox(x: number, y: number, width: number, height: number) {
  return `${x} ${y} ${width} ${height} re S`;
}

function pill(x: number, y: number, width: number, height: number) {
  return `${x} ${y} ${width} ${height} re S`;
}

function stamp(value: string, x: number, y: number) {
  return [`${x} ${y} 82 22 re S`, text(value, x + 16, y + 7, 9, 'F2')].join(
    '\n',
  );
}

function sectionLabel(value: string, x: number, y: number) {
  return text(value.toUpperCase(), x, y, 7, 'F2');
}

function tableHeader(x: number, y: number, labels: string[], widths: number[]) {
  const width = widths.reduce((sum, current) => sum + current, 0);
  const parts = [`${x} ${y - 12} ${width} 26 re S`];
  let currentX = x + 12;

  labels.forEach((label, index) => {
    parts.push(text(label.toUpperCase(), currentX, y, 8, 'F2'));
    currentX += widths[index] ?? 100;
  });

  return parts;
}

function moneyText(amount: number, x: number, y: number, font: 'F1' | 'F2') {
  return text(formatMoney(amount), x, y, font === 'F2' ? 10 : 9, font);
}

function formatMoney(amount: number) {
  const sign = amount < 0 ? '-' : '';
  return `${sign}Rs. ${Math.abs(amount).toFixed(2)}`;
}

function formatIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatDateTime(value: Date) {
  return value.toISOString().replace('T', ' ').slice(0, 19);
}

function formatPdfCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (value instanceof Date) {
    return formatIsoDate(value);
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }

  if (typeof value === 'object') {
    // Handle Prisma Decimal-like objects
    const obj = value as Record<string, unknown>;
    if (typeof obj.toNumber === 'function') {
      const val: unknown = (obj as { toNumber: () => unknown }).toNumber();
      if (typeof val === 'number' || typeof val === 'string') {
        return String(val);
      }
    }
    if (
      typeof obj.toString === 'function' &&
      obj.toString !== Object.prototype.toString
    ) {
      const val: unknown = (obj as { toString: () => unknown }).toString();
      if (typeof val === 'string') {
        return val;
      }
    }
    try {
      return JSON.stringify(value);
    } catch {
      return '[Object]';
    }
  }

  return 'N/A';
}

function fitText(value: string, maxLength: number) {
  return value.length > maxLength
    ? `${value.slice(0, Math.max(0, maxLength - 1))}...`
    : value;
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

interface QrCodeMatrix {
  modules: {
    size: number;
    data: ArrayLike<boolean | number>;
  };
}

function renderQrTokenAsPdfBlocks(
  token: string,
  x: number,
  y: number,
  size: number,
) {
  const qr = QRCode.create(token, {
    errorCorrectionLevel: 'M',
  }) as unknown as QrCodeMatrix;

  const matrixSize = qr.modules.size;
  const cell = size / matrixSize;
  const parts = ['0 g', `${x} ${y} ${size} ${size} re S`, '0 0 0 rg'];

  for (let row = 0; row < matrixSize; row++) {
    for (let col = 0; col < matrixSize; col++) {
      const isDark = Boolean(qr.modules.data[row * matrixSize + col]);

      if (!isDark) {
        continue;
      }

      const px = x + col * cell;
      const py = y + size - (row + 1) * cell;

      parts.push(
        `${px.toFixed(2)} ${py.toFixed(2)} ${cell.toFixed(
          2,
        )} ${cell.toFixed(2)} re f`,
      );
    }
  }

  return parts.join('\n');
}

export function getJpegDimensions(buffer: Buffer): {
  width: number;
  height: number;
} {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    throw new Error('Invalid JPEG: Missing SOI marker');
  }

  let offset = 2;
  while (offset < buffer.length) {
    const marker = buffer.readUInt16BE(offset);
    offset += 2;

    if (marker === 0xffc0 || marker === 0xffc2) {
      // SOF0 or SOF2
      offset += 3; // Skip length and precision
      const height = buffer.readUInt16BE(offset);
      offset += 2;
      const width = buffer.readUInt16BE(offset);
      return { width, height };
    }

    offset += buffer.readUInt16BE(offset);
  }

  throw new Error('Invalid JPEG: SOF marker not found');
}

export function buildCashierClosePdf(input: {
  schoolName: string;
  closeNumber: string;
  openedAt: Date;
  closedAt: Date;
  collectorName: string;
  paymentMethod: string | null;
  methodBreakdown: Array<{
    method: string;
    grossCollected: number;
    totalRefunded: number;
    netCollected: number;
    paymentCount: number;
    refundCount: number;
  }>;
  grossCollected: number;
  totalRefunded: number;
  netCollected: number;
  expectedCashAmount: number;
  actualCashAmount: number | null;
  varianceAmount: number | null;
  varianceReason: string | null;
  paymentCount: number;
  refundCount: number;
  firstReceiptNumber: string | null;
  lastReceiptNumber: string | null;
  notes: string | null;
  closedByName: string;
  logo?: PdfImage | null;
}) {
  const contentParts = [
    ...pageFrame(
      'CASHIER WINDOW CLOSE REPORT',
      input.schoolName,
      `Close Number: ${input.closeNumber}`,
      input.logo ? 'Img1' : undefined,
    ),
    infoBox(48, 620, 240, 62),
    sectionLabel('Window Identification', 60, 668),
    text(`Close Number: ${input.closeNumber}`, 60, 654, 9, 'F2'),
    text(`Collector: ${input.collectorName}`, 60, 640, 9, 'F1'),
    text(
      `Method Scope: ${input.paymentMethod ?? 'ALL METHODS'}`,
      60,
      626,
      9,
      'F1',
    ),

    infoBox(304, 620, 240, 62),
    sectionLabel('Time Boundaries', 316, 668),
    text(`Opened At: ${formatDateTime(input.openedAt)}`, 316, 654, 9, 'F1'),
    text(`Closed At: ${formatDateTime(input.closedAt)}`, 316, 640, 9, 'F1'),
    text(`Closed By: ${input.closedByName}`, 316, 626, 9, 'F1'),

    infoBox(48, 510, 496, 96),
    sectionLabel('Financial Summary', 60, 592),
    text('Gross Collected:', 60, 574, 10, 'F1'),
    moneyText(input.grossCollected, 210, 574, 'F1'),

    text('Total Refunded:', 60, 556, 10, 'F1'),
    moneyText(-input.totalRefunded, 210, 556, 'F1'),

    '60 546 m 250 546 l S',
    text('Net Collected:', 60, 532, 10, 'F2'),
    moneyText(input.netCollected, 210, 532, 'F2'),

    // Cash Reconciliation
    sectionLabel('Cash Reconciliation', 316, 592),
    text('Expected Cash:', 316, 574, 10, 'F1'),
    moneyText(input.expectedCashAmount, 450, 574, 'F1'),

    text('Actual Cash:', 316, 556, 10, 'F1'),
    input.actualCashAmount !== null
      ? moneyText(input.actualCashAmount, 450, 556, 'F1')
      : text('N/A', 450, 556, 10, 'F1'),

    '316 546 m 500 546 l S',
    text('Variance:', 316, 532, 10, 'F2'),
    input.varianceAmount !== null
      ? moneyText(input.varianceAmount, 450, 532, 'F2')
      : text('N/A', 450, 532, 10, 'F2'),

    // Method breakdown
    infoBox(48, 386, 496, 110),
    sectionLabel('Payment Method Breakdown', 60, 482),
    text('Method', 60, 462, 8, 'F2'),
    text('Gross', 190, 462, 8, 'F2'),
    text('Refunds', 300, 462, 8, 'F2'),
    text('Net', 430, 462, 8, 'F2'),
    '60 454 m 500 454 l S',
    ...input.methodBreakdown.slice(0, 5).flatMap((row, index) => {
      const y = 438 - index * 14;
      return [
        text(
          `${row.method} (${row.paymentCount} pay / ${row.refundCount} ref)`,
          60,
          y,
          8,
          'F1',
        ),
        moneyText(row.grossCollected, 212, y, 'F1'),
        moneyText(-row.totalRefunded, 322, y, 'F1'),
        moneyText(row.netCollected, 464, y, 'F2'),
      ];
    }),
    ...(input.methodBreakdown.length === 0
      ? [text('No payments or refunds in this close window.', 60, 438, 9, 'F1')]
      : []),

    // Activity summary box
    infoBox(48, 306, 496, 66),
    sectionLabel('Receipt Activity', 60, 358),
    text(`Total Payments Count: ${input.paymentCount}`, 60, 340, 9, 'F1'),
    text(`Total Refunds Count: ${input.refundCount}`, 60, 324, 9, 'F1'),
    text(
      `First Receipt: ${input.firstReceiptNumber ?? '—'}`,
      304,
      340,
      9,
      'F1',
    ),
    text(`Last Receipt: ${input.lastReceiptNumber ?? '—'}`, 304, 324, 9, 'F1'),

    // Variance Reason & Notes
    infoBox(48, 184, 496, 108),
    sectionLabel('Auditable Explanations & Notes', 60, 278),
    text('Variance Reason:', 60, 260, 9, 'F2'),
    ...(input.varianceReason
      ? wrapPdfLine(input.varianceReason, 60, 246, 460, 9).slice(0, 2)
      : [text('None recorded', 60, 246, 9, 'F1')]),
    text('General Handoff Notes:', 60, 214, 9, 'F2'),
    ...(input.notes
      ? wrapPdfLine(input.notes, 60, 200, 460, 9).slice(0, 2)
      : [text('No notes provided', 60, 200, 9, 'F1')]),

    '72 138 m 220 138 l S',
    text('Cashier Signature', 108, 122, 9, 'F1'),
    '360 138 m 508 138 l S',
    text('Supervisor Signature', 390, 122, 9, 'F1'),

    text('Confidential day-end cashier close summary.', 176, 72, 10, 'F2'),
    text(
      'This document is an official financial close record and must be retained in audit history.',
      106,
      54,
      8,
      'F1',
    ),
  ];

  return buildPdfFromContent(
    contentParts.filter(Boolean).join('\n'),
    input.logo,
  );
}
