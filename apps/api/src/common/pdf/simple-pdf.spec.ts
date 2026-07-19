import { buildReportCardPdf } from './simple-pdf';

const baseInput = {
  schoolName: 'Everest Academy',
  panNumber: null,
  examName: 'Term 1',
  academicYear: '2026-2027',
  student: {
    id: 'ST-001',
    name: 'Test Student',
    className: 'Class 5',
    sectionName: 'A',
    rollNumber: 12,
  },
  subjects: [
    {
      name: 'Mathematics',
      theory: { max: 100, obtained: 80, grade: 'A' },
      totalGrade: 'A',
      gradePoint: 3.6,
    },
  ],
  summary: {
    totalMarks: 80,
    maxMarks: 100,
    percentage: 80,
    finalGrade: 'A',
    finalGpa: 3.6,
  },
};

describe('buildReportCardPdf footer text', () => {
  it('embeds a configured footer as a visible text operator', () => {
    const pdf = buildReportCardPdf({
      ...baseInput,
      footerText: 'Estd. 2050 B.S. | Affiliated to NEB',
    });

    expect(pdf.toString('latin1')).toContain(
      '(Estd. 2050 B.S. | Affiliated to NEB) Tj',
    );
  });

  it('omits the footer text operator entirely when no footer is configured', () => {
    const withoutFooter = buildReportCardPdf({
      ...baseInput,
      footerText: null,
    });
    const withFooter = buildReportCardPdf({
      ...baseInput,
      footerText: 'Configured footer',
    });

    expect(withoutFooter.toString('latin1')).not.toContain(
      '(Configured footer) Tj',
    );
    expect(withFooter.toString('latin1')).toContain('(Configured footer) Tj');
  });

  it('truncates an overlong footer instead of overflowing the fixed line', () => {
    const longFooter = 'A'.repeat(200);
    const pdf = buildReportCardPdf({ ...baseInput, footerText: longFooter });
    const content = pdf.toString('latin1');

    expect(content).not.toContain(`(${longFooter}) Tj`);
    expect(content).toMatch(/\(A{80,95}\.\.\.\) Tj/);
  });
});
