import { sanitizeStudentProfileResponse } from './student-profile-sanitizer';

describe('sanitizeStudentProfileResponse', () => {
  it('removes legacy publicUrl and raw objectKey fields recursively', () => {
    const profile = {
      student: {
        id: 'student-1',
        fullNameEn: 'Student One',
        transferCertUrl: 'https://public.example/transfer.pdf',
      },
      documents: [
        {
          id: 'doc-1',
          fileName: 'birth.pdf',
          objectKey: 'tenant/students/documents/birth.pdf',
          publicUrl: 'https://public.example/birth.pdf',
          nested: {
            objectKey: 'nested-key',
            safe: true,
          },
        },
      ],
      activityPosts: [
        {
          id: 'post-1',
          attachments: [
            {
              id: 'attachment-1',
              objectKey: 'tenant/activity/file.jpg',
              publicUrl: 'https://public.example/file.jpg',
              previewUrl: '/api/v1/activity-feed/attachments/attachment-1/preview',
            },
          ],
        },
      ],
      generatedDocuments: [
        {
          id: 'generated-1',
          pdfUrl: 'https://public.example/generated.pdf',
          storageObjectKey: 'tenant/generated/file.pdf',
          checksumSha256: 'checksum',
        },
      ],
    };

    const sanitized = sanitizeStudentProfileResponse(profile);

    expect(JSON.stringify(sanitized)).not.toContain('objectKey');
    expect(JSON.stringify(sanitized)).not.toContain('publicUrl');
    expect(JSON.stringify(sanitized)).not.toContain('storageObjectKey');
    expect(JSON.stringify(sanitized)).not.toContain('pdfUrl');
    expect(JSON.stringify(sanitized)).not.toContain('transferCertUrl');
    expect(sanitized.documents[0]).toEqual({
      id: 'doc-1',
      fileName: 'birth.pdf',
      nested: { safe: true },
    });
    expect(sanitized.activityPosts[0].attachments[0]).toEqual({
      id: 'attachment-1',
      previewUrl: '/api/v1/activity-feed/attachments/attachment-1/preview',
    });
    expect(sanitized.generatedDocuments[0]).toEqual({
      id: 'generated-1',
      checksumSha256: 'checksum',
    });
  });

  it('preserves arrays, dates, primitives, and safe file metadata', () => {
    const now = new Date('2026-05-09T00:00:00.000Z');
    const sanitized = sanitizeStudentProfileResponse({
      uploadedAt: now,
      sizeBytes: 123,
      contentType: 'application/pdf',
      fileName: 'safe.pdf',
      values: [1, 'two', null],
    });

    expect(sanitized).toEqual({
      uploadedAt: now,
      sizeBytes: 123,
      contentType: 'application/pdf',
      fileName: 'safe.pdf',
      values: [1, 'two', null],
    });
  });
});
