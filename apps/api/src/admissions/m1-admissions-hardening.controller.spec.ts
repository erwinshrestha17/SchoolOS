import { AuthMethod } from '@prisma/client';
import { ENTITLEMENT_KEY } from '../auth/decorators/entitlement.decorator';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { M1AdmissionsHardeningController } from './m1-admissions-hardening.controller';

const actor: AuthContext = {
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  userId: 'user-1',
  email: 'registrar@schoolos.test',
  authMethod: AuthMethod.PASSWORD,
  roles: ['admin'],
  permissions: [
    'students:read',
    'student_documents:manage',
    'guardians:update',
  ],
};

function createController() {
  const service = {
    getOwnershipAudit: jest.fn(),
    autosaveAdmissionDraft: jest.fn(),
    recoverAdmissionDrafts: jest.fn(),
    enhancedDuplicateReview: jest.fn(),
    resolveRelationships: jest.fn(),
    removeGuardianAccess: jest.fn(),
    generateIdCard: jest.fn(),
    generateTransferCertificate: jest.fn(),
    graduateStudent: jest.fn(),
    listImportReviewQueue: jest.fn(),
    getIemisReadinessSummary: jest.fn(),
    getWorkflowLabels: jest.fn(),
  };

  return {
    controller: new M1AdmissionsHardeningController(service as never),
    service,
  };
}

describe('M1AdmissionsHardeningController contracts', () => {
  it('keeps all M1 hardening routes behind the students module entitlement', () => {
    expect(
      Reflect.getMetadata(ENTITLEMENT_KEY, M1AdmissionsHardeningController),
    ).toBe('module.students');
  });

  it('keeps high-risk M1 routes protected by route-specific permissions', () => {
    expect(getRoutePermissions('getOwnershipAudit')).toEqual([
      'students:read',
      'student_documents:manage',
    ]);
    expect(getRoutePermissions('autosaveAdmissionDraft')).toEqual([
      'enrollments:create',
      'students:create',
      'guardians:create',
    ]);
    expect(getRoutePermissions('removeGuardianAccess')).toEqual([
      'guardians:update',
      'student_documents:manage',
    ]);
    expect(getRoutePermissions('generateIdCard')).toEqual([
      'student_documents:manage',
    ]);
    expect(getRoutePermissions('generateTransferCertificate')).toEqual([
      'students:manage_lifecycle',
      'student_documents:manage',
    ]);
    expect(getRoutePermissions('graduateStudent')).toEqual([
      'students:manage_lifecycle',
    ]);
  });

  it('delegates ownership audit with the authenticated tenant context', () => {
    const { controller, service } = createController();
    service.getOwnershipAudit.mockReturnValue({
      policy: { tenantScoped: true },
    });

    const result = controller.getOwnershipAudit('student-1', actor);

    expect(service.getOwnershipAudit).toHaveBeenCalledWith('student-1', actor);
    expect(result).toEqual({ policy: { tenantScoped: true } });
  });

  it('delegates admission draft autosave and recovery without accepting tenant input from the route body', () => {
    const { controller, service } = createController();
    const dto = {
      draftKey: 'front-desk-1',
      firstNameEn: 'Asha',
      lastNameEn: 'Tamang',
      payload: { tenantId: 'malicious-other-tenant' },
    };
    const query = { draftKey: 'front-desk-1', limit: 5 };
    service.autosaveAdmissionDraft.mockReturnValue({ id: 'application-1' });
    service.recoverAdmissionDrafts.mockReturnValue({ items: [] });

    expect(controller.autosaveAdmissionDraft(dto, actor)).toEqual({
      id: 'application-1',
    });
    expect(controller.recoverAdmissionDrafts(query, actor)).toEqual({
      items: [],
    });
    expect(service.autosaveAdmissionDraft).toHaveBeenCalledWith(dto, actor);
    expect(service.recoverAdmissionDrafts).toHaveBeenCalledWith(query, actor);
  });

  it('delegates duplicate and relationship resolution with tenant-owned actor context', () => {
    const { controller, service } = createController();
    const duplicateDto = {
      firstNameEn: 'Asha',
      lastNameEn: 'Tamang',
      firstNameNp: 'आशा',
      lastNameNp: 'तामाङ',
      dateOfBirth: '2020-01-02',
      guardianPhones: ['9800000000'],
      previousSchool: 'Sunrise School',
      siblingStudentSystemId: 'SCH-2026-0012',
    };
    const relationshipDto = {
      guardianPhones: ['9800000000'],
      siblingStudentSystemId: 'SCH-2026-0012',
    };
    service.enhancedDuplicateReview.mockReturnValue({ hasWarnings: true });
    service.resolveRelationships.mockReturnValue({ guardians: [] });

    expect(controller.enhancedDuplicateReview(duplicateDto, actor)).toEqual({
      hasWarnings: true,
    });
    expect(controller.resolveRelationships(relationshipDto, actor)).toEqual({
      guardians: [],
    });
    expect(service.enhancedDuplicateReview).toHaveBeenCalledWith(
      duplicateDto,
      actor,
    );
    expect(service.resolveRelationships).toHaveBeenCalledWith(
      relationshipDto,
      actor,
    );
  });

  it('delegates guardian removal with explicit file-access review payload', () => {
    const { controller, service } = createController();
    const dto = {
      confirmFileAccessReview: true,
      reason: 'Guardian changed after admission review',
    };
    service.removeGuardianAccess.mockReturnValue({
      accessReview: { canAccessStudentFiles: false },
    });

    const result = controller.removeGuardianAccess(
      'student-1',
      'guardian-1',
      dto,
      actor,
    );

    expect(service.removeGuardianAccess).toHaveBeenCalledWith(
      'student-1',
      'guardian-1',
      dto,
      actor,
    );
    expect(result).toEqual({
      accessReview: { canAccessStudentFiles: false },
    });
  });

  it('delegates generated documents and alumni lifecycle routes through M1 service boundaries', () => {
    const { controller, service } = createController();
    const transferDto = {
      reason: 'Family relocation',
      destinationSchool: 'New School',
    };
    const graduateDto = { reason: 'SEE completed', graduatedAt: '2026-04-30' };
    service.generateIdCard.mockReturnValue({ kind: 'ID_CARD' });
    service.generateTransferCertificate.mockReturnValue({
      kind: 'TRANSFER_CERTIFICATE',
    });
    service.graduateStudent.mockReturnValue({ alumniState: 'ALUMNI' });

    expect(controller.generateIdCard('student-1', actor)).toEqual({
      kind: 'ID_CARD',
    });
    expect(
      controller.generateTransferCertificate('student-1', transferDto, actor),
    ).toEqual({ kind: 'TRANSFER_CERTIFICATE' });
    expect(controller.graduateStudent('student-1', graduateDto, actor)).toEqual(
      {
        alumniState: 'ALUMNI',
      },
    );
    expect(service.generateIdCard).toHaveBeenCalledWith('student-1', actor);
    expect(service.generateTransferCertificate).toHaveBeenCalledWith(
      'student-1',
      transferDto,
      actor,
    );
    expect(service.graduateStudent).toHaveBeenCalledWith(
      'student-1',
      graduateDto,
      actor,
    );
  });

  it('delegates import-review, iEMIS readiness, and workflow label read routes', () => {
    const { controller, service } = createController();
    const importQuery = { status: 'FAILED', limit: 10 };
    const iemisQuery = { classId: 'class-1', sectionId: 'section-1' };
    service.listImportReviewQueue.mockReturnValue({ items: [] });
    service.getIemisReadinessSummary.mockReturnValue({ total: 0 });
    service.getWorkflowLabels.mockReturnValue({
      application: { INQUIRY: 'Inquiry received' },
    });

    expect(controller.listImportReviewQueue(importQuery, actor)).toEqual({
      items: [],
    });
    expect(controller.getIemisReadinessSummary(iemisQuery, actor)).toEqual({
      total: 0,
    });
    expect(controller.getWorkflowLabels()).toEqual({
      application: { INQUIRY: 'Inquiry received' },
    });
    expect(service.listImportReviewQueue).toHaveBeenCalledWith(
      importQuery,
      actor,
    );
    expect(service.getIemisReadinessSummary).toHaveBeenCalledWith(
      iemisQuery,
      actor,
    );
  });
});

function getRoutePermissions(
  methodName: keyof M1AdmissionsHardeningController,
) {
  return Reflect.getMetadata(
    PERMISSIONS_KEY,
    M1AdmissionsHardeningController.prototype[methodName],
  );
}
