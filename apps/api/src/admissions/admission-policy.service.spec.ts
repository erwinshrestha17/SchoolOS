/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AdmissionPolicyService } from './admission-policy.service';

const actor = {
  tenantId: 'tenant-a',
  userId: 'user-a',
  roles: ['admin'],
  permissions: ['admission_policy:manage'],
} as any;

function buildPrisma(overrides: Record<string, any> = {}) {
  const prisma: any = {
    admissionPolicy: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    admissionPolicyVersion: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    admissionPolicyDocumentRequirement: {
      findMany: jest.fn().mockResolvedValue([]),
      createMany: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    approvalPolicy: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      delete: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    admissionApplication: { count: jest.fn().mockResolvedValue(0) },
    academicYear: { findFirst: jest.fn().mockResolvedValue({ id: 'year-a' }) },
    class: { findFirst: jest.fn().mockResolvedValue({ id: 'class-a' }) },
    auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-a' }) },
    ...overrides,
  };
  prisma.$transaction ??= jest.fn(async (callback) => callback(prisma));
  return prisma;
}

function buildService(prisma: any, auditService = { record: jest.fn() }) {
  return new AdmissionPolicyService(prisma, auditService as any);
}

describe('AdmissionPolicyService', () => {
  it('returns the backend-owned policy template catalog', () => {
    const service = buildService(buildPrisma());

    const templates = service.listTemplates();

    expect(templates.map((template) => template.id)).toEqual([
      'grade-1-10-new',
      'grade-1-10-transfer',
      'grade-11-12',
      'scholarship-quota',
    ]);
    expect(templates.find((template) => template.id === 'grade-11-12')).toEqual(
      expect.objectContaining({
        gradeBand: 'GRADE_11_12',
        version: expect.objectContaining({
          admissionMode: 'REVIEW_REQUIRED',
          requireInterview: true,
          requirePriorMarksheet: true,
          requireStreamOrMarksReview: true,
        }),
        documents: expect.arrayContaining([
          expect.objectContaining({
            documentKind: 'SEE_MARKSHEET',
            timing: 'BEFORE_REVIEW',
          }),
        ]),
      }),
    );
  });

  it('creates a policy with a first draft version', async () => {
    const prisma = buildPrisma();
    prisma.admissionPolicy.create.mockResolvedValue({
      id: 'policy-a',
      name: 'Grade 5 Transfer',
    });
    prisma.admissionPolicyVersion.create.mockResolvedValue({
      id: 'version-a',
      version: 1,
    });
    prisma.admissionPolicy.findFirst.mockResolvedValue({
      id: 'policy-a',
      name: 'Grade 5 Transfer',
      currentVersionId: null,
      versions: [{ id: 'version-a', status: 'DRAFT' }],
    });
    const service = buildService(prisma);

    await service.create({ name: 'Grade 5 Transfer' }, actor);

    expect(prisma.admissionPolicy.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Grade 5 Transfer',
          status: 'DRAFT',
        }),
      }),
    );
    expect(prisma.admissionPolicyVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          policyId: 'policy-a',
          version: 1,
          status: 'DRAFT',
        }),
      }),
    );
  });

  it('creates a complete template-backed draft and its audit in one transaction', async () => {
    const prisma = buildPrisma();
    prisma.admissionPolicy.create.mockResolvedValue({
      id: 'policy-template',
      name: 'Grade 11 Science Admission 2083',
    });
    prisma.admissionPolicyVersion.create.mockResolvedValue({
      id: 'version-template',
      version: 1,
    });
    prisma.admissionPolicy.findFirst.mockResolvedValue({
      id: 'policy-template',
      name: 'Grade 11 Science Admission 2083',
      currentVersionId: null,
      versions: [{ id: 'version-template', status: 'DRAFT' }],
    });
    const auditService = { record: jest.fn().mockResolvedValue(undefined) };
    const service = buildService(prisma, auditService);

    await service.create(
      {
        name: 'Grade 11 Science Admission 2083',
        templateId: 'grade-11-12',
        academicYearId: 'year-a',
        classId: 'class-a',
      },
      actor,
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.admissionPolicy.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-a',
          gradeBand: 'GRADE_11_12',
          applicantType: 'NEW',
        }),
      }),
    );
    expect(prisma.admissionPolicyVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          policyId: 'policy-template',
          admissionMode: 'REVIEW_REQUIRED',
          requireDocumentReview: true,
          requireInterview: true,
          requirePrincipalApproval: true,
          requirePriorMarksheet: true,
          requireStreamOrMarksReview: true,
        }),
      }),
    );
    expect(
      prisma.admissionPolicyDocumentRequirement.createMany,
    ).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          tenantId: 'tenant-a',
          policyVersionId: 'version-template',
          documentKind: 'SEE_MARKSHEET',
          timing: 'BEFORE_REVIEW',
        }),
      ]),
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admission_policy_create',
        resourceId: 'policy-template',
        after: expect.objectContaining({
          templateId: 'grade-11-12',
          versionId: 'version-template',
          documentRequirementCount: 5,
        }),
      }),
      prisma,
    );
  });

  it('rejects an unknown template before creating policy records', async () => {
    const prisma = buildPrisma();
    const service = buildService(prisma);

    await expect(
      service.create(
        { name: 'Unknown template', templateId: 'made-up-template' },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.admissionPolicy.create).not.toHaveBeenCalled();
  });

  it('rejects a blank policy name before creating policy records', async () => {
    const prisma = buildPrisma();
    const service = buildService(prisma);

    await expect(service.create({ name: '   ' }, actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a policy scoped to a class outside the tenant', async () => {
    const prisma = buildPrisma({
      class: { findFirst: jest.fn().mockResolvedValue(null) },
    });
    const service = buildService(prisma);

    await expect(
      service.create({ name: 'Bad scope', classId: 'class-other' }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.admissionPolicy.create).not.toHaveBeenCalled();
  });

  it('rejects editing version content when no draft version exists', async () => {
    const prisma = buildPrisma();
    prisma.admissionPolicy.findFirst.mockResolvedValue({
      id: 'policy-a',
      versions: [{ id: 'version-a', status: 'ACTIVE' }],
    });
    const service = buildService(prisma);

    await expect(
      service.updateDraftVersion('policy-a', { requireInterview: true }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('activate promotes the target draft and expires the previous active version', async () => {
    const prisma = buildPrisma();
    const updatedAt = new Date('2026-07-22T04:00:00.000Z');
    prisma.admissionPolicy.findFirst.mockResolvedValue({
      id: 'policy-a',
      updatedAt,
      currentVersionId: 'version-old',
      versions: [
        { id: 'version-old', status: 'ACTIVE', requiredFields: [] },
        {
          id: 'version-new',
          version: 2,
          status: 'DRAFT',
          requiredFields: ['guardianEmail'],
        },
      ],
    });
    const auditService = { record: jest.fn() };
    const service = buildService(prisma, auditService);
    jest.spyOn(service, 'get').mockResolvedValue({ id: 'policy-a' } as any);

    await service.activate('policy-a', 'version-new', actor);

    expect(prisma.admissionPolicy.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'policy-a',
          tenantId: 'tenant-a',
          updatedAt,
        }),
        data: expect.objectContaining({
          currentVersionId: 'version-new',
          status: 'ACTIVE',
        }),
      }),
    );
    expect(prisma.admissionPolicyVersion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'version-new',
          tenantId: 'tenant-a',
          policyId: 'policy-a',
          status: 'DRAFT',
        }),
        data: expect.objectContaining({ status: 'ACTIVE' }),
      }),
    );
    expect(prisma.admissionPolicyVersion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'version-old', status: 'ACTIVE' }),
        data: { status: 'EXPIRED' },
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admission_policy_activate' }),
      prisma,
    );
  });

  it('rejects a draft with an unsupported required field before activation writes', async () => {
    const prisma = buildPrisma();
    prisma.admissionPolicy.findFirst.mockResolvedValue({
      id: 'policy-a',
      updatedAt: new Date('2026-07-22T04:00:00.000Z'),
      currentVersionId: null,
      versions: [
        {
          id: 'version-new',
          version: 1,
          status: 'DRAFT',
          requiredFields: ['customFieldThatNoCaseCanStore'],
        },
      ],
    });

    await expect(
      buildService(prisma).activate('policy-a', 'version-new', actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.admissionPolicy.updateMany).not.toHaveBeenCalled();
  });

  it('fails closed when another activation changes the policy first', async () => {
    const prisma = buildPrisma();
    prisma.admissionPolicy.findFirst.mockResolvedValue({
      id: 'policy-a',
      updatedAt: new Date('2026-07-22T04:00:00.000Z'),
      currentVersionId: null,
      versions: [
        {
          id: 'version-new',
          version: 1,
          status: 'DRAFT',
          requiredFields: [],
        },
      ],
    });
    prisma.admissionPolicy.updateMany.mockResolvedValue({ count: 0 });
    const auditService = { record: jest.fn() };

    await expect(
      buildService(prisma, auditService).activate(
        'policy-a',
        'version-new',
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.admissionPolicyVersion.updateMany).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('rejects activating a version that is not a draft', async () => {
    const prisma = buildPrisma();
    prisma.admissionPolicy.findFirst.mockResolvedValue({
      id: 'policy-a',
      updatedAt: new Date('2026-07-22T04:00:00.000Z'),
      currentVersionId: 'version-old',
      versions: [{ id: 'version-old', status: 'ACTIVE', requiredFields: [] }],
    });
    const service = buildService(prisma);

    await expect(
      service.activate('policy-a', 'version-old', actor),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws not found when activating a version id that does not belong to the policy', async () => {
    const prisma = buildPrisma();
    prisma.admissionPolicy.findFirst.mockResolvedValue({
      id: 'policy-a',
      updatedAt: new Date('2026-07-22T04:00:00.000Z'),
      currentVersionId: 'version-old',
      versions: [{ id: 'version-old', status: 'ACTIVE', requiredFields: [] }],
    });
    const service = buildService(prisma);

    await expect(
      service.activate('policy-a', 'version-missing', actor),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses to archive the school default policy', async () => {
    const prisma = buildPrisma();
    prisma.admissionPolicy.findFirst.mockResolvedValue({
      id: 'policy-a',
      isDefault: true,
    });
    const service = buildService(prisma);

    await expect(
      service.archive(
        'policy-a',
        { reason: 'Replaced by a newer policy.' },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.admissionPolicy.updateMany).not.toHaveBeenCalled();
  });

  it('archives a non-default policy atomically with a bounded audit reason', async () => {
    const prisma = buildPrisma();
    const updatedAt = new Date('2026-07-22T05:00:00.000Z');
    prisma.admissionPolicy.findFirst.mockResolvedValue({
      id: 'policy-a',
      tenantId: 'tenant-a',
      status: 'ACTIVE',
      archivedAt: null,
      updatedAt,
      currentVersionId: 'version-active',
      isDefault: false,
    });
    const auditService = { record: jest.fn() };
    const service = buildService(prisma, auditService);
    jest.spyOn(service, 'get').mockResolvedValue({ id: 'policy-a' } as any);

    await service.archive(
      'policy-a',
      { reason: 'Replaced by the 2084 policy.' },
      actor,
    );

    expect(prisma.admissionPolicy.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'policy-a',
          tenantId: 'tenant-a',
          updatedAt,
          archivedAt: null,
        }),
        data: expect.objectContaining({ status: 'ARCHIVED' }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admission_policy_archive',
        after: expect.objectContaining({
          status: 'ARCHIVED',
          reason: 'Replaced by the 2084 policy.',
        }),
      }),
      prisma,
    );
  });

  it('rejects an unbounded archive reason before lifecycle writes', async () => {
    const prisma = buildPrisma();
    prisma.admissionPolicy.findFirst.mockResolvedValue({
      id: 'policy-a',
      tenantId: 'tenant-a',
      status: 'ACTIVE',
      archivedAt: null,
      updatedAt: new Date('2026-07-22T05:00:00.000Z'),
      currentVersionId: 'version-active',
      isDefault: false,
    });

    await expect(
      buildService(prisma).archive('policy-a', { reason: '  ' }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('keeps archived policies read-only instead of creating another draft', async () => {
    const prisma = buildPrisma();
    prisma.admissionPolicy.findFirst.mockResolvedValue({
      id: 'policy-a',
      tenantId: 'tenant-a',
      status: 'ARCHIVED',
      archivedAt: new Date('2026-07-22T05:00:00.000Z'),
      updatedAt: new Date('2026-07-22T05:00:00.000Z'),
      currentVersionId: 'version-active',
      versions: [],
    });

    await expect(
      buildService(prisma).startDraftVersion('policy-a', actor),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.admissionPolicyVersion.create).not.toHaveBeenCalled();
  });

  it('does not create a second draft version when one already exists', async () => {
    const prisma = buildPrisma();
    prisma.admissionPolicy.findFirst.mockResolvedValue({
      id: 'policy-a',
      currentVersionId: 'version-old',
      versions: [
        { id: 'version-old', status: 'ACTIVE' },
        { id: 'version-draft', status: 'DRAFT' },
      ],
    });
    const service = buildService(prisma);
    jest.spyOn(service, 'get').mockResolvedValue({ id: 'policy-a' } as any);

    await service.startDraftVersion('policy-a', actor);

    expect(prisma.admissionPolicyVersion.create).not.toHaveBeenCalled();
  });

  it('duplicates a policy with its current version fields and document requirements, but never its scope', async () => {
    const prisma = buildPrisma();
    prisma.admissionPolicy.findFirst.mockResolvedValue({
      id: 'policy-a',
      name: 'Grade 5 Transfer 2083',
      applicantType: 'TRANSFER',
      currentVersionId: 'version-active',
      versions: [
        {
          id: 'version-active',
          status: 'ACTIVE',
          admissionMode: 'REVIEW_REQUIRED',
          requirePrincipalApproval: true,
          requiredFields: ['previousSchool'],
          documentRequirements: [
            {
              documentKind: 'TRANSFER_CERTIFICATE',
              label: 'Transfer certificate',
              isRequired: true,
              sortOrder: 0,
            },
          ],
        },
      ],
    });
    prisma.admissionPolicy.create.mockResolvedValue({ id: 'policy-copy' });
    prisma.admissionPolicyVersion.create.mockResolvedValue({
      id: 'version-copy',
      version: 1,
    });
    const auditService = { record: jest.fn() };
    const service = buildService(prisma, auditService);
    jest.spyOn(service, 'get').mockResolvedValue({ id: 'policy-copy' } as any);

    await service.duplicate('policy-a', {}, actor);

    expect(prisma.admissionPolicy.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Grade 5 Transfer 2083 (Copy)',
          applicantType: 'TRANSFER',
          isDefault: false,
          status: 'DRAFT',
        }),
      }),
    );
    expect(
      prisma.admissionPolicy.create.mock.calls[0][0].data,
    ).not.toHaveProperty('classId');
    expect(
      prisma.admissionPolicy.create.mock.calls[0][0].data,
    ).not.toHaveProperty('academicYearId');
    expect(prisma.admissionPolicyVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          policyId: 'policy-copy',
          version: 1,
          status: 'DRAFT',
          admissionMode: 'REVIEW_REQUIRED',
          requirePrincipalApproval: true,
          requiredFields: ['previousSchool'],
        }),
      }),
    );
    expect(
      prisma.admissionPolicyDocumentRequirement.createMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            policyVersionId: 'version-copy',
            documentKind: 'TRANSFER_CERTIFICATE',
          }),
        ],
      }),
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admission_policy_duplicate',
        resourceId: 'policy-copy',
        after: expect.objectContaining({ duplicatedFromPolicyId: 'policy-a' }),
      }),
      prisma,
    );
  });

  it('does not audit a partial duplicate when copying requirements fails', async () => {
    const prisma = buildPrisma();
    prisma.admissionPolicy.findFirst.mockResolvedValue({
      id: 'policy-a',
      name: 'Grade 5 Transfer 2083',
      applicantType: 'TRANSFER',
      currentVersionId: 'version-active',
      versions: [
        {
          id: 'version-active',
          status: 'ACTIVE',
          documentRequirements: [
            {
              documentKind: 'TRANSFER_CERTIFICATE',
              label: 'Transfer certificate',
              isRequired: true,
              sortOrder: 0,
            },
          ],
        },
      ],
    });
    prisma.admissionPolicy.create.mockResolvedValue({ id: 'policy-copy' });
    prisma.admissionPolicyVersion.create.mockResolvedValue({
      id: 'version-copy',
      version: 1,
    });
    prisma.admissionPolicyDocumentRequirement.createMany.mockRejectedValue(
      new Error('write failed'),
    );
    const auditService = { record: jest.fn() };
    const service = buildService(prisma, auditService);

    await expect(service.duplicate('policy-a', {}, actor)).rejects.toThrow(
      'write failed',
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('uses a custom name when duplicating a policy', async () => {
    const prisma = buildPrisma();
    prisma.admissionPolicy.findFirst.mockResolvedValue({
      id: 'policy-a',
      name: 'Grade 5 Transfer 2083',
      applicantType: 'BOTH',
      currentVersionId: null,
      versions: [],
    });
    prisma.admissionPolicy.create.mockResolvedValue({ id: 'policy-copy' });
    prisma.admissionPolicyVersion.create.mockResolvedValue({
      id: 'version-copy',
      version: 1,
    });
    const service = buildService(prisma);
    jest.spyOn(service, 'get').mockResolvedValue({ id: 'policy-copy' } as any);

    await service.duplicate(
      'policy-a',
      { name: 'Grade 5 Transfer 2084' },
      actor,
    );

    expect(prisma.admissionPolicy.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Grade 5 Transfer 2084' }),
      }),
    );
  });

  describe('document requirements', () => {
    const editablePolicy = {
      id: 'policy-a',
      tenantId: 'tenant-a',
      status: 'ACTIVE',
      archivedAt: null,
      updatedAt: new Date('2026-07-22T05:00:00.000Z'),
    };

    it('commits a draft checklist change with its audit record', async () => {
      const prisma = buildPrisma();
      prisma.admissionPolicy.findFirst.mockResolvedValue(editablePolicy);
      prisma.admissionPolicyVersion.findFirst.mockResolvedValue({
        id: 'version-draft',
        policyId: 'policy-a',
        status: 'DRAFT',
      });
      prisma.admissionPolicyDocumentRequirement.upsert.mockResolvedValue({
        id: 'requirement-a',
        documentKind: 'TRANSFER_CERTIFICATE',
      });
      const auditService = { record: jest.fn() };

      await buildService(prisma, auditService).upsertDocumentRequirement(
        'policy-a',
        'version-draft',
        {
          documentKind: 'TRANSFER_CERTIFICATE',
          label: 'Transfer certificate',
        },
        actor,
      );

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'admission_policy_upsert_document_requirement',
          after: expect.objectContaining({
            requirementId: 'requirement-a',
            documentKind: 'TRANSFER_CERTIFICATE',
          }),
        }),
        prisma,
      );
    });

    it('deletes a tenant-owned draft requirement with audit evidence', async () => {
      const prisma = buildPrisma();
      prisma.admissionPolicy.findFirst.mockResolvedValue(editablePolicy);
      prisma.admissionPolicyVersion.findFirst.mockResolvedValue({
        id: 'version-draft',
        policyId: 'policy-a',
        status: 'DRAFT',
      });
      const auditService = { record: jest.fn() };

      await buildService(prisma, auditService).deleteDocumentRequirement(
        'policy-a',
        'version-draft',
        'requirement-a',
        actor,
      );

      expect(
        prisma.admissionPolicyDocumentRequirement.deleteMany,
      ).toHaveBeenCalledWith({
        where: {
          id: 'requirement-a',
          tenantId: 'tenant-a',
          policyVersionId: 'version-draft',
        },
      });
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'admission_policy_delete_document_requirement',
        }),
        prisma,
      );
    });
  });

  describe('approval chain', () => {
    const editablePolicy = {
      id: 'policy-a',
      tenantId: 'tenant-a',
      status: 'ACTIVE',
      archivedAt: null,
      updatedAt: new Date('2026-07-22T05:00:00.000Z'),
    };

    it('creates an ApprovalPolicy on the first save and links it to the draft version', async () => {
      const prisma = buildPrisma();
      prisma.admissionPolicy.findFirst.mockResolvedValue(editablePolicy);
      prisma.admissionPolicyVersion.findFirst.mockResolvedValue({
        id: 'version-draft',
        policyId: 'policy-a',
        status: 'DRAFT',
        approvalPolicyId: null,
      });
      prisma.approvalPolicy.create.mockResolvedValue({
        id: 'approval-policy-a',
      });
      const service = buildService(prisma);
      jest.spyOn(service, 'get').mockResolvedValue({ id: 'policy-a' } as any);

      await service.replaceApprovalChain(
        'policy-a',
        'version-draft',
        {
          stages: [
            { approverRole: 'vice_principal' },
            { approverRole: 'principal' },
          ],
        },
        actor,
      );

      expect(prisma.approvalPolicy.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            workflowType: 'ADMISSION_CASE',
            name: 'admission-policy-version:version-draft',
            minApprovals: 2,
            approverRoles: ['vice_principal', 'principal'],
            approverPermissions: ['', ''],
          }),
        }),
      );
      expect(prisma.admissionPolicyVersion.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'version-draft',
            tenantId: 'tenant-a',
            status: 'DRAFT',
          }),
          data: { approvalPolicyId: 'approval-policy-a' },
        }),
      );
      expect(prisma.approvalPolicy.updateMany).not.toHaveBeenCalled();
    });

    it('replaces the existing ApprovalPolicy in place on a second save (no duplicate rows)', async () => {
      const prisma = buildPrisma();
      prisma.admissionPolicy.findFirst.mockResolvedValue(editablePolicy);
      prisma.admissionPolicyVersion.findFirst.mockResolvedValue({
        id: 'version-draft',
        policyId: 'policy-a',
        status: 'DRAFT',
        approvalPolicyId: 'approval-policy-a',
      });
      const service = buildService(prisma);
      jest.spyOn(service, 'get').mockResolvedValue({ id: 'policy-a' } as any);

      await service.replaceApprovalChain(
        'policy-a',
        'version-draft',
        { minApprovals: 1, stages: [{ approverRole: 'principal' }] },
        actor,
      );

      expect(prisma.approvalPolicy.create).not.toHaveBeenCalled();
      expect(prisma.approvalPolicy.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'approval-policy-a', tenantId: 'tenant-a' },
          data: expect.objectContaining({
            minApprovals: 1,
            approverRoles: ['principal'],
          }),
        }),
      );
    });

    it('rejects editing the approval chain on a non-draft version', async () => {
      const prisma = buildPrisma();
      prisma.admissionPolicy.findFirst.mockResolvedValue(editablePolicy);
      prisma.admissionPolicyVersion.findFirst.mockResolvedValue({
        id: 'version-active',
        policyId: 'policy-a',
        status: 'ACTIVE',
        approvalPolicyId: null,
      });
      const service = buildService(prisma);

      await expect(
        service.replaceApprovalChain(
          'policy-a',
          'version-active',
          { stages: [{ approverRole: 'principal' }] },
          actor,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.approvalPolicy.create).not.toHaveBeenCalled();
    });

    it('clears the FK and deletes the ApprovalPolicy row on delete', async () => {
      const prisma = buildPrisma();
      prisma.admissionPolicy.findFirst.mockResolvedValue(editablePolicy);
      prisma.admissionPolicyVersion.findFirst.mockResolvedValue({
        id: 'version-draft',
        policyId: 'policy-a',
        status: 'DRAFT',
        approvalPolicyId: 'approval-policy-a',
      });
      const service = buildService(prisma);
      jest.spyOn(service, 'get').mockResolvedValue({ id: 'policy-a' } as any);

      await service.deleteApprovalChain('policy-a', 'version-draft', actor);

      expect(prisma.admissionPolicyVersion.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'version-draft',
            approvalPolicyId: 'approval-policy-a',
          }),
          data: { approvalPolicyId: null },
        }),
      );
      expect(prisma.approvalPolicy.deleteMany).toHaveBeenCalledWith({
        where: { id: 'approval-policy-a', tenantId: 'tenant-a' },
      });
    });

    it('clones the approval chain into a new ApprovalPolicy row when starting a new draft', async () => {
      const prisma = buildPrisma();
      prisma.admissionPolicy.findFirst.mockResolvedValue({
        id: 'policy-a',
        currentVersionId: 'version-active',
        versions: [
          {
            id: 'version-active',
            status: 'ACTIVE',
            approvalPolicy: {
              id: 'approval-policy-source',
              minApprovals: 1,
              approverRoles: ['principal'],
              approverPermissions: [''],
            },
          },
        ],
      });
      prisma.admissionPolicyVersion.create.mockResolvedValue({
        id: 'version-draft',
        version: 2,
      });
      prisma.approvalPolicy.create.mockResolvedValue({
        id: 'approval-policy-clone',
      });
      const service = buildService(prisma);
      jest.spyOn(service, 'get').mockResolvedValue({ id: 'policy-a' } as any);

      await service.startDraftVersion('policy-a', actor);

      expect(prisma.approvalPolicy.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'admission-policy-version:version-draft',
            minApprovals: 1,
            approverRoles: ['principal'],
          }),
        }),
      );
      expect(prisma.admissionPolicyVersion.update).toHaveBeenCalledWith({
        where: { id: 'version-draft' },
        data: { approvalPolicyId: 'approval-policy-clone' },
      });
    });
  });
});
