import {
  buildAdmissionDtoFromCsvRow,
  normalizeAdmissionName,
  parseAdmissionCsv,
} from './admissions.utils';

describe('admissions utils', () => {
  it('normalizes duplicate-detection names consistently', () => {
    expect(normalizeAdmissionName('  Erwin   Shrestha ')).toBe(
      'erwin shrestha',
    );
  });

  it('parses CSV rows and builds admission DTOs with row-level validation', () => {
    const [row] = parseAdmissionCsv(
      [
        'firstNameEn,lastNameEn,dateOfBirth,gender,admissionDate,academicYearId,classId,guardianFullName,guardianRelation,guardianPhone,rollNumber',
        'Asha,Tamang,2020-01-02,FEMALE,2026-04-26,ay-1,class-1,Maya Tamang,mother,9800000000,7',
      ].join('\n'),
    );

    const result = buildAdmissionDtoFromCsvRow(row, true);

    expect(result.errors).toEqual([]);
    expect(result.dto?.firstNameEn).toBe('Asha');
    expect(result.dto?.confirmDuplicate).toBe(true);
    expect(result.dto?.rollNumber).toBe(7);
  });
});
