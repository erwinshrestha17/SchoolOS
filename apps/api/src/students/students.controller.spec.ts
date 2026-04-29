import { StreamableFile } from '@nestjs/common';
import { AuthMethod } from '@prisma/client';
import { StudentsController } from './students.controller';

const actor = {
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  userId: 'user-1',
  email: 'admin@schoolos.test',
  authMethod: AuthMethod.PASSWORD,
  roles: ['admin'],
  permissions: ['student_documents:manage'],
};

describe('StudentsController PDF responses', () => {
  it('streams generated student documents as application/pdf', async () => {
    const service = {
      generateStudentDocumentPdf: jest
        .fn()
        .mockResolvedValue(Buffer.from('%PDF-1.4\n%%EOF')),
    };
    const controller = new StudentsController(service as never);

    const result = await controller.getGeneratedDocument(
      'student-1',
      'id-card',
      actor,
    );

    expect(result).toBeInstanceOf(StreamableFile);
    expect(result.getHeaders()).toEqual(
      expect.objectContaining({
        type: 'application/pdf',
        disposition: 'inline; filename="student-1-id-card.pdf"',
      }),
    );
  });
});
