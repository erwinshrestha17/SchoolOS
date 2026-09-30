import {
  admissionApplicationReference,
  publicDuplicateReview,
} from './admissions.service';

describe('Admission application public projection (Phase 5B)', () => {
  it('keeps only duplicate matches from case metadata', () => {
    const projected = publicDuplicateReview({
      duplicateRisk: true,
      duplicateCandidates: [
        {
          studentId: 's1',
          studentSystemId: 'STU-1',
          fullNameEn: 'Twin',
          className: '5',
        },
      ],
      medicalConditions: 'asthma',
      emergencyPhone: '9800000009',
      nationalStudentId: 'NID-1',
      review: { notes: [{ reason: 'private' }] },
      followUps: [{ code: 'DOCUMENTS_PENDING' }],
    });
    expect(projected).toEqual({
      hasWarnings: true,
      matches: [
        {
          studentId: 's1',
          studentSystemId: 'STU-1',
          fullNameEn: 'Twin',
          matchTypes: [],
        },
      ],
    });
  });

  it('keeps legacy match types and returns null when there is nothing to show', () => {
    expect(
      publicDuplicateReview({
        hasWarnings: false,
        matches: [
          {
            studentId: 's2',
            studentSystemId: 'STU-2',
            fullNameEn: 'A',
            matchTypes: ['NAME_DOB', 7],
          },
        ],
      }),
    ).toEqual({
      hasWarnings: true,
      matches: [
        {
          studentId: 's2',
          studentSystemId: 'STU-2',
          fullNameEn: 'A',
          matchTypes: ['NAME_DOB'],
        },
      ],
    });
    expect(publicDuplicateReview(null)).toBeNull();
    expect(publicDuplicateReview({ medicalConditions: 'x' })).toBeNull();
  });

  it('derives a stable short reference', () => {
    expect(
      admissionApplicationReference('5e4ed406-e375-4153-bac6-6decd55930cf'),
    ).toBe('APP-5E4ED406');
  });
});
