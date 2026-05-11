import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { GradeCalculatorService } from './grade-calculator.service';

type ReportCardWithRelations = Prisma.ReportCardGetPayload<{
  include: {
    student: true;
    class: true;
    section: true;
    examTerm: true;
    academicYear: true;
  };
}>;

type MarkWithRelations = Prisma.MarkEntryGetPayload<{
  include: {
    subject: true;
    assessmentComponent: true;
  };
}>;

interface ReportPdfSubject {
  subject: string;
  components: Array<{
    name: string;
    type: string;
    obtained: number;
    max: number;
    weightPercent: number;
    passMarks: number | null;
    status: 'PASS' | 'FAIL';
  }>;
  totalObtained: number;
  totalMax: number;
  percentage: number;
  grade: string;
}

@Injectable()
export class ReportCardPdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gradeCalculator: GradeCalculatorService,
  ) {}

  async getReportCardPdf(reportCardId: string, actor: AuthContext) {
    const reportCard = await this.prisma.reportCard.findFirst({
      where: {
        id: reportCardId,
        tenantId: actor.tenantId,
      },
      include: {
        student: true,
        class: true,
        section: true,
        examTerm: true,
        academicYear: true,
      },
    });

    if (!reportCard) {
      throw new NotFoundException('Report card not found in this tenant');
    }

    const [tenant, marks, unpaid] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: actor.tenantId } }),
      this.prisma.markEntry.findMany({
        where: {
          tenantId: actor.tenantId,
          examTermId: reportCard.examTermId,
          studentId: reportCard.studentId,
        },
        include: {
          subject: true,
          assessmentComponent: true,
        },
        orderBy: [
          { subject: { code: 'asc' } },
          { assessmentComponent: { name: 'asc' } },
        ],
      }),
      this.prisma.invoice.count({
        where: {
          tenantId: actor.tenantId,
          studentId: reportCard.studentId,
          reportCardBlocked: true,
          status: { in: ['ISSUED', 'PARTIAL'] },
        },
      }),
    ]);

    if (unpaid > 0) {
      throw new ConflictException('Report card is blocked by unpaid fees');
    }

    return buildPolishedReportCardPdf({
      schoolName: tenant?.name ?? 'SchoolOS School',
      panNumber: tenant?.panNumber ?? null,
      reportCard,
      subjects: this.buildSubjectRows(marks),
    });
  }

  private buildSubjectRows(marks: MarkWithRelations[]) {
    const groupedMarks = new Map<string, MarkWithRelations[]>();

    for (const mark of marks) {
      const existing = groupedMarks.get(mark.subjectId) ?? [];
      existing.push(mark);
      groupedMarks.set(mark.subjectId, existing);
    }

    const rows: ReportPdfSubject[] = [];

    for (const [subjectId, subjectMarks] of groupedMarks.entries()) {
      const firstMark = subjectMarks[0];
      const result = this.gradeCalculator.calculateWeightedSubjectGrade({
        subjectId,
        components: subjectMarks.map((m) => ({
          componentId: m.assessmentComponentId,
          subjectId,
          maxMarks: Number(m.assessmentComponent.maxMarks),
          marksObtained: Number(m.marksObtained),
          status: m.status,
          passMarks: m.assessmentComponent.passMarks
            ? Number(m.assessmentComponent.passMarks)
            : null,
          weightPercent: Number(m.assessmentComponent.weightPercent),
        })),
      });

      rows.push({
        subject: `${firstMark.subject.code} / ${firstMark.subject.name}`,
        components: subjectMarks.map((m) => ({
          name: m.assessmentComponent.name,
          type: m.assessmentComponent.type,
          obtained: Number(m.marksObtained),
          max: Number(m.assessmentComponent.maxMarks),
          weightPercent: Number(m.assessmentComponent.weightPercent),
          passMarks: m.assessmentComponent.passMarks
            ? Number(m.assessmentComponent.passMarks)
            : null,
          status:
            m.assessmentComponent.passMarks === null ||
            Number(m.marksObtained) >= Number(m.assessmentComponent.passMarks)
              ? 'PASS'
              : 'FAIL',
        })),
        totalObtained: subjectMarks.reduce(
          (sum, m) => sum + Number(m.marksObtained),
          0,
        ),
        totalMax: subjectMarks.reduce(
          (sum, m) => sum + Number(m.assessmentComponent.maxMarks),
          0,
        ),
        percentage: result.percentage,
        grade: result.grade,
      });
    }

    return rows;
  }
}

function buildPolishedReportCardPdf(input: {
  schoolName: string;
  panNumber?: string | null;
  reportCard: ReportCardWithRelations;
  subjects: ReportPdfSubject[];
}) {
  const { reportCard } = input;
  const fallbackName =
    `${reportCard.student.firstNameEn ?? ''} ${reportCard.student.lastNameEn ?? ''}`.trim();

  const studentName =
    fallbackName.length > 0 ? fallbackName : reportCard.student.studentSystemId;

  const parts: string[] = [
    '0.7 w',
    '36 36 540 720 re S',
    '0.25 w',
    '44 44 524 704 re S',
    text(input.schoolName, 54, 724, 18, 'F2'),
    input.panNumber ? text(`PAN: ${input.panNumber}`, 54, 708, 8, 'F1') : '',
    text('PROGRESS REPORT CARD', 382, 724, 14, 'F2'),
    text(
      `${reportCard.examTerm.name} | ${reportCard.academicYear.name}`,
      382,
      708,
      9,
      'F1',
    ),
    text(`Status: ${reportCard.status}`, 382, 692, 8, 'F2'),
    '36 680 m 576 680 l S',

    labelValue('Student', studentName, 54, 656),
    labelValue('Student ID', reportCard.student.studentSystemId, 350, 656),
    labelValue('Class', reportCard.class.name, 54, 632),
    labelValue('Section', reportCard.section?.name ?? 'N/A', 184, 632),
    labelValue(
      'Roll No.',
      String(reportCard.student.rollNumber ?? '—'),
      314,
      632,
    ),
    labelValue(
      'Generated',
      reportCard.updatedAt.toISOString().slice(0, 10),
      444,
      632,
    ),
    '36 612 m 576 612 l S',

    text('SUBJECT', 54, 594, 8, 'F2'),
    text('COMPONENTS', 206, 594, 8, 'F2'),
    text('OBTAINED', 390, 594, 8, 'F2'),
    text('MAX', 456, 594, 8, 'F2'),
    text('GRADE', 510, 594, 8, 'F2'),
    '36 584 m 576 584 l S',
  ];

  let y = 566;
  for (const subject of input.subjects.slice(0, 12)) {
    const componentText = subject.components
      .map(
        (component) =>
          `${component.name} ${component.obtained}/${component.max}`,
      )
      .join(', ');

    parts.push(
      text(truncate(subject.subject, 28), 54, y, 8, 'F1'),
      text(truncate(componentText || 'No marks entered', 34), 206, y, 8, 'F1'),
      text(subject.totalObtained.toFixed(1), 398, y, 8, 'F1'),
      text(subject.totalMax.toFixed(1), 462, y, 8, 'F1'),
      text(subject.grade, 518, y, 8, subject.grade === 'NG' ? 'F2' : 'F1'),
    );
    y -= 18;

    if (y < 290) {
      parts.push(
        text(
          'Additional subjects omitted from this one-page preview.',
          54,
          y,
          8,
          'F1',
        ),
      );
      y -= 18;
      break;
    }
  }

  if (input.subjects.length === 0) {
    parts.push(
      text('No marks available for this report card.', 54, y, 9, 'F1'),
    );
    y -= 20;
  }

  y -= 8;
  parts.push(
    `36 ${y + 12} m 576 ${y + 12} l S`,
    text('RESULT SUMMARY', 54, y - 8, 10, 'F2'),
    labelValue(
      'Total',
      `${Number(reportCard.totalMarks).toFixed(2)} / ${Number(reportCard.maxMarks).toFixed(2)}`,
      54,
      y - 34,
    ),
    labelValue(
      'Percentage',
      `${Number(reportCard.percentage).toFixed(2)}%`,
      214,
      y - 34,
    ),
    labelValue('Final Grade', reportCard.grade, 374, y - 34),
    labelValue('GPA', Number(reportCard.gpa).toFixed(2), 484, y - 34),
  );

  if (reportCard.remarks) {
    parts.push(
      text('Remarks', 54, y - 76, 9, 'F2'),
      ...wrapPdfLine(reportCard.remarks, 54, y - 92, 470, 8),
    );
  }

  parts.push(
    '54 118 m 190 118 l S',
    text('Class Teacher', 82, 102, 9, 'F1'),
    '238 118 m 374 118 l S',
    text('Exam Coordinator', 268, 102, 9, 'F1'),
    '422 118 m 540 118 l S',
    text('Principal', 460, 102, 9, 'F1'),
    '36 82 m 576 82 l S',
    text(
      'This report card is generated by SchoolOS. Verify with the school office for official use.',
      54,
      64,
      7,
      'F1',
    ),
    text(
      `Printed: ${new Date().toISOString().replace('T', ' ').slice(0, 19)}`,
      54,
      50,
      7,
      'F1',
    ),
  );

  return buildPdf(parts.filter(Boolean).join('\n'));
}

function labelValue(
  label: string,
  value: string | number | null | undefined,
  x: number,
  y: number,
) {
  return [
    text(label.toUpperCase(), x, y, 6, 'F2'),
    text(value ?? 'N/A', x, y - 12, 9, 'F1'),
  ].join('\n');
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function escapePdfText(value: string | number | null | undefined) {
  return String(value ?? 'N/A')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
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

  if (current) lines.push(current);
  return lines
    .slice(0, 4)
    .map((line, index) => text(line, x, y - index * 12, size, 'F1'));
}

function buildPdf(content: string) {
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
