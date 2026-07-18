import { AuthMethod } from '@prisma/client';
import { DECORATORS } from '@nestjs/swagger/dist/constants';
import type { AuthContext } from '../auth/auth.types';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import {
  DuplicateStudentReviewMutationResponseDto,
  ListDuplicateStudentCandidatesResponseDto,
} from './dto/duplicate-student-review-response.dto';
import { ListDuplicateStudentCandidatesDto } from './dto/list-duplicate-student-candidates.dto';
import { MarkDuplicateStudentPairNotDuplicateDto } from './dto/mark-duplicate-student-pair-not-duplicate.dto';
import { ReopenDuplicateStudentReviewDto } from './dto/reopen-duplicate-student-review.dto';
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
    getIemisReadiness: jest.fn(),
    getStudentIdentity: jest.fn(),
    generateStudentIdentity: jest.fn(),
    revokeStudentIdentity: jest.fn(),
  };
  const duplicateReviewService = {
    listCandidates: jest.fn(),
    markNotDuplicate: jest.fn(),
    reopenReview: jest.fn(),
  };

  return {
    controller: new StudentsController(
      service as never,
      duplicateReviewService as never,
    ),
    service,
    duplicateReviewService,
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

  it('keeps student readiness and correction routes permission protected', () => {
    const readinessPermissions = Reflect.getMetadata(
      PERMISSIONS_KEY,
      StudentsController.prototype.getIemisReadiness,
    );
    const correctionPermissions = Reflect.getMetadata(
      PERMISSIONS_KEY,
      StudentsController.prototype.updateStudent,
    );

    expect(readinessPermissions).toEqual(['students:read']);
    expect(correctionPermissions).toEqual(['students:update']);
  });

  it('delegates student readiness with tenant-scoped actor context', () => {
    const { controller, service } = createController();
    service.getIemisReadiness.mockReturnValue({ status: 'BLOCKED' });

    const result = controller.getIemisReadiness('student-1', actor);

    expect(service.getIemisReadiness).toHaveBeenCalledWith('student-1', actor);
    expect(result).toEqual({ status: 'BLOCKED' });
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
    const { controller, duplicateReviewService } = createController();
    const query = { studentId: 'student-1', limit: 10 };
    duplicateReviewService.listCandidates.mockReturnValue({ candidates: [] });

    const result = controller.listDuplicateStudentCandidates(
      query as never,
      actor,
    );

    expect(duplicateReviewService.listCandidates).toHaveBeenCalledWith(
      query,
      actor,
    );
    expect(result).toEqual({ candidates: [] });
  });

  it('delegates not-duplicate review with tenant-scoped actor context', () => {
    const { controller, duplicateReviewService } = createController();
    const dto = {
      studentOneId: 'student-1',
      studentTwoId: 'student-2',
      reason: 'Confirmed siblings with separate admission records',
    };
    duplicateReviewService.markNotDuplicate.mockReturnValue({
      reviewState: 'NOT_DUPLICATE',
    });

    const result = controller.markDuplicateStudentPairNotDuplicate(
      dto as never,
      actor,
    );

    expect(duplicateReviewService.markNotDuplicate).toHaveBeenCalledWith(
      dto,
      actor,
    );
    expect(result).toEqual({ reviewState: 'NOT_DUPLICATE' });
  });

  it('delegates reopening a duplicate review through lifecycle permission', () => {
    const { controller, duplicateReviewService } = createController();
    const dto = { reason: 'New guardian contact now matches both records' };
    duplicateReviewService.reopenReview.mockReturnValue({
      reviewState: 'PENDING',
    });

    const result = controller.reopenDuplicateStudentReview(
      'review-1',
      dto as never,
      actor,
    );

    expect(duplicateReviewService.reopenReview).toHaveBeenCalledWith(
      'review-1',
      dto,
      actor,
    );
    expect(result).toEqual({ reviewState: 'PENDING' });
  });

  it('publishes duplicate-review query, request, and response OpenAPI metadata', () => {
    expect(
      Reflect.getMetadata(
        DECORATORS.API_MODEL_PROPERTIES_ARRAY,
        ListDuplicateStudentCandidatesDto.prototype,
      ),
    ).toEqual(
      expect.arrayContaining([
        ':studentId',
        ':page',
        ':limit',
        ':search',
        ':confidence',
        ':status',
      ]),
    );
    expect(
      Reflect.getMetadata(
        DECORATORS.API_MODEL_PROPERTIES_ARRAY,
        MarkDuplicateStudentPairNotDuplicateDto.prototype,
      ),
    ).toEqual(
      expect.arrayContaining([':studentOneId', ':studentTwoId', ':reason']),
    );
    expect(
      Reflect.getMetadata(
        DECORATORS.API_MODEL_PROPERTIES_ARRAY,
        ReopenDuplicateStudentReviewDto.prototype,
      ),
    ).toEqual(expect.arrayContaining([':reason']));

    const listResponses = Reflect.getMetadata(
      DECORATORS.API_RESPONSE,
      StudentsController.prototype.listDuplicateStudentCandidates,
    );
    const markResponses = Reflect.getMetadata(
      DECORATORS.API_RESPONSE,
      StudentsController.prototype.markDuplicateStudentPairNotDuplicate,
    );
    const reopenResponses = Reflect.getMetadata(
      DECORATORS.API_RESPONSE,
      StudentsController.prototype.reopenDuplicateStudentReview,
    );

    expect(listResponses['200'].type).toBe(
      ListDuplicateStudentCandidatesResponseDto,
    );
    expect(markResponses['201'].type).toBe(
      DuplicateStudentReviewMutationResponseDto,
    );
    expect(reopenResponses['201'].type).toBe(
      DuplicateStudentReviewMutationResponseDto,
    );
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

  it('returns protected File Registry metadata for generated student documents', async () => {
    const { controller, service } = createController();
    service.generateStudentDocumentPdf.mockResolvedValue({
      fileAssetId: 'file-id-card-1',
      fileName: 'STU-001-id-card.pdf',
      mimeType: 'application/pdf',
      fileAvailable: true,
    });

    const result = await controller.getGeneratedDocument(
      'student-1',
      'id-card',
      actor,
    );

    expect(service.generateStudentDocumentPdf).toHaveBeenCalledWith(
      'student-1',
      'id-card',
      actor,
    );
    expect(result).toEqual({
      fileAssetId: 'file-id-card-1',
      fileName: 'STU-001-id-card.pdf',
      mimeType: 'application/pdf',
      fileAvailable: true,
    });
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
