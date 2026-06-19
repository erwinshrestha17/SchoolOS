import { StreamableFile } from '@nestjs/common';
import { AuthMethod } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { StudentsController } from './students.controller';

const actor: AuthContext = {
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  userId: 'user-1',
  email: 'admin@schoolos.test',
  authMethod: AuthMethod.PASSWORD,
  roles: ['admin'],
  permissions: ['student_documents:manage'],
};

function createController() {
  const service = {
    listStudents: jest.fn(),
    getStudentModuleSummary: jest.fn(),
    getStudentProfile: jest.fn(),
    createStudent: jest.fn(),
    updateStudent: jest.fn(),
    updateStudentGuardian: jest.fn(),
    exportIemis: jest.fn(),
    exportRoster: jest.fn(),
    listDuplicateStudentCandidates: jest.fn(),
    mergeDuplicateStudent: jest.fn(),
    getFeeClearance: jest.fn(),
    requestTransfer: jest.fn(),
    archiveStudent: jest.fn(),
    archiveAlumni: jest.fn(),
    deleteStudent: jest.fn(),
    inviteGuardians: jest.fn(),
    listGuardianIdentityVerifications: jest.fn(),
    createGuardianIdentityVerification: jest.fn(),
    reviewGuardianIdentityVerification: jest.fn(),
    generateStudentDocumentPdf: jest.fn(),
    revokeGeneratedStudentDocument: jest.fn(),
    getAttendanceHistory: jest.fn(),
    getStudentIdentity: jest.fn(),
    generateStudentIdentity: jest.fn(),
    revokeStudentIdentity: jest.fn(),
  };

  return {
    controller: new StudentsController(service as never),
    service,
  };
}

describe('StudentsController M1 contracts', () => {
  it('delegates student module summary filters to the backend service', () => {
    const { controller, service } = createController();
    const query = {
      academicYearId: 'academic-year-1',
      classId: 'class-1',
      sectionId: 'section-1',
      search: 'Maya',
    };
    service.getStudentModuleSummary.mockReturnValue({ activeStudents: 2 });

    const result = controller.getStudentModuleSummary(query as never, actor);

    expect(service.getStudentModuleSummary).toHaveBeenCalledWith(query, actor);
    expect(result).toEqual({ activeStudents: 2 });
  });

  it('sanitizes student profile response before returning it', async () => {
    const { controller, service } = createController();
    service.getStudentProfile.mockResolvedValue({
      student: { id: 'student-1' },
      documents: [
        {
          id: 'doc-1',
          objectKey: 'private/key.pdf',
          publicUrl: 'https://public.example/key.pdf',
          fileName: 'key.pdf',
        },
      ],
    });

    const result = await controller.getStudentProfile('student-1', actor);

    expect(service.getStudentProfile).toHaveBeenCalledWith('student-1', actor);
    expect(JSON.stringify(result)).not.toContain('objectKey');
    expect(JSON.stringify(result)).not.toContain('publicUrl');
    expect(result).toEqual({
      student: { id: 'student-1' },
      documents: [{ id: 'doc-1', fileName: 'key.pdf' }],
    });
  });

  it('delegates iEMIS export with tenant-scoped actor context', () => {
    const { controller, service } = createController();
    service.exportIemis.mockReturnValue('csv');

    const result = controller.exportIemis(actor);

    expect(service.exportIemis).toHaveBeenCalledWith(actor);
    expect(result).toBe('csv');
  });

  it('passes roster export filters to service without dropping class or section scope', () => {
    const { controller, service } = createController();
    service.exportRoster.mockReturnValue('roster-csv');

    const result = controller.exportRoster(
      'academic-year-1',
      'class-1',
      'section-1',
      actor,
    );

    expect(service.exportRoster).toHaveBeenCalledWith(
      {
        academicYearId: 'academic-year-1',
        classId: 'class-1',
        sectionId: 'section-1',
      },
      actor,
    );
    expect(result).toBe('roster-csv');
  });

  it('delegates duplicate merge workflow through lifecycle permission route', () => {
    const { controller, service } = createController();
    const dto = {
      sourceStudentId: 'student-duplicate',
      targetStudentId: 'student-canonical',
      reason: 'Duplicate admission record',
    };
    service.mergeDuplicateStudent.mockReturnValue({ success: true });

    const result = controller.mergeDuplicateStudent(dto as never, actor);

    expect(service.mergeDuplicateStudent).toHaveBeenCalledWith(dto, actor);
    expect(result).toEqual({ success: true });
  });

  it('delegates duplicate candidate review through lifecycle permission route', () => {
    const { controller, service } = createController();
    const query = { studentId: 'student-1', limit: 10 };
    service.listDuplicateStudentCandidates.mockReturnValue({ candidates: [] });

    const result = controller.listDuplicateStudentCandidates(
      query as never,
      actor,
    );

    expect(service.listDuplicateStudentCandidates).toHaveBeenCalledWith(
      query,
      actor,
    );
    expect(result).toEqual({ candidates: [] });
  });

  it('delegates transfer lifecycle action with reason-bearing payload', () => {
    const { controller, service } = createController();
    const dto = {
      reason: 'Family relocation',
      destinationSchool: 'New School',
    };
    service.requestTransfer.mockReturnValue({ lifecycleStatus: 'TRANSFERRED' });

    const result = controller.requestTransfer('student-1', dto as never, actor);

    expect(service.requestTransfer).toHaveBeenCalledWith(
      'student-1',
      dto,
      actor,
    );
    expect(result).toEqual({ lifecycleStatus: 'TRANSFERRED' });
  });

  it('delegates archive lifecycle action with audit-ready payload', () => {
    const { controller, service } = createController();
    const dto = { reason: 'Completed records retention review' };
    service.archiveStudent.mockReturnValue({ lifecycleStatus: 'ARCHIVED' });

    const result = controller.archiveStudent('student-1', dto as never, actor);

    expect(service.archiveStudent).toHaveBeenCalledWith(
      'student-1',
      dto,
      actor,
    );
    expect(result).toEqual({ lifecycleStatus: 'ARCHIVED' });
  });

  it('streams generated student documents as application/pdf', async () => {
    const { controller, service } = createController();
    service.generateStudentDocumentPdf.mockResolvedValue(
      Buffer.from('%PDF-1.4\n%%EOF'),
    );

    const result = await controller.getGeneratedDocument(
      'student-1',
      'id-card',
      undefined,
      actor,
    );

    expect(service.generateStudentDocumentPdf).toHaveBeenCalledWith(
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

  it('delegates generated document revocation with reason payload', () => {
    const { controller, service } = createController();
    const dto = { reason: 'Incorrect student detail' };
    service.revokeGeneratedStudentDocument.mockReturnValue({
      revokedAt: 'now',
    });

    const result = controller.revokeGeneratedDocument(
      'student-1',
      'document-1',
      dto as never,
      actor,
    );

    expect(service.revokeGeneratedStudentDocument).toHaveBeenCalledWith(
      'student-1',
      'document-1',
      dto,
      actor,
    );
    expect(result).toEqual({ revokedAt: 'now' });
  });
});
