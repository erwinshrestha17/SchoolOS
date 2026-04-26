import { NotFoundException } from '@nestjs/common';
import {
  AuthMethod,
  StorageProvider,
  StudentDocumentKind,
} from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { StudentRecordsService } from './student-records.service';

describe('StudentRecordsService', () => {
  let prisma: any;
  let storageService: any;
  let auditService: any;
  let service: StudentRecordsService;
  let actor: AuthContext;

  beforeEach(() => {
    prisma = {
      student: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      studentDocument: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      siblingGroup: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };
    storageService = {
      saveBase64Object: jest.fn(),
    };
    auditService = {
      record: jest.fn(),
    };
    actor = {
      userId: 'user-1',
      tenantId: 'tenant-1',
      tenantSlug: 'green-valley',
      email: 'admin@school.test',
      authMethod: AuthMethod.PASSWORD,
      roles: ['admin'],
      permissions: ['student_documents:manage'],
    };

    service = new StudentRecordsService(prisma, storageService, auditService);
  });

  it('stores document metadata only after validating tenant-scoped student access', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    storageService.saveBase64Object.mockResolvedValue({
      provider: StorageProvider.LOCAL,
      objectKey: 'tenant-1/students/student-1/documents/doc.pdf',
      publicUrl: '/storage/tenant-1/students/student-1/documents/doc.pdf',
      sizeBytes: 12,
    });
    prisma.studentDocument.create.mockImplementation(async ({ data }: any) => ({
      id: 'document-1',
      ...data,
    }));

    const result = await service.uploadDocument(
      {
        studentId: 'student-1',
        kind: StudentDocumentKind.BIRTH_CERTIFICATE,
        title: 'Birth certificate',
        fileName: 'birth.pdf',
        contentType: 'application/pdf',
        base64Content: 'aGVsbG8=',
      },
      actor,
    );

    expect(prisma.student.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'student-1',
        tenantId: 'tenant-1',
      },
    });
    expect(storageService.saveBase64Object).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        prefix: 'students/student-1/documents',
      }),
    );
    expect(result.objectKey).toContain('student-1');
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'upload',
        resource: 'student_document',
        tenantId: 'tenant-1',
      }),
    );
  });

  it('rejects document uploads for students outside the tenant', async () => {
    prisma.student.findFirst.mockResolvedValue(null);

    await expect(
      service.uploadDocument(
        {
          studentId: 'student-outside',
          kind: StudentDocumentKind.OTHER,
          fileName: 'note.txt',
          contentType: 'text/plain',
          base64Content: 'aGVsbG8=',
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(storageService.saveBase64Object).not.toHaveBeenCalled();
  });
});
