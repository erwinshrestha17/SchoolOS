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
    },
    admissionPolicyVersion: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
    },
    admissionPolicyDocumentRequirement: {
      findMany: jest.fn().mockResolvedValue([]),
      createMany: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    approvalPolicy: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    admissionApplication: { count: jest.fn().mockResolvedValue(0) },
    academicYear: { findFirst: jest.fn().mockResolvedValue({ id: 'year-a' }) },
    class: { findFirst: jest.fn().mockResolvedValue({ id: 'class-a' }) },
    auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-a' }) },
    ...overrides,
  };
  return prisma;
}

function buildService(prisma: any, auditService = { record: jest.fn() }) {
  return new AdmissionPolicyService(prisma, auditService as any);
}

describe('AdmissionPolicyService', () => {
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
    prisma.admissionPolicy.findFirst.mockResolvedValue({
      id: 'policy-a',
      currentVersionId: 'version-old',
      versions: [
        { id: 'version-old', status: 'ACTIVE' },
        { id: 'version-new', status: 'DRAFT' },
      ],
    });
    const service = buildService(prisma);
    jest.spyOn(service, 'get').mockResolvedValue({ id: 'policy-a' } as any);

    await service.activate('policy-a', 'version-new', actor);

    expect(prisma.admissionPolicyVersion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'version-new' },
        data: expect.objectContaining({ status: 'ACTIVE' }),
      }),
    );
    expect(prisma.admissionPolicyVersion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'version-old' },
        data: { status: 'EXPIRED' },
      }),
    );
    expect(prisma.admissionPolicy.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'policy-a' },
        data: expect.objectContaining({
          currentVersionId: 'version-new',
          status: 'ACTIVE',
        }),
      }),
    );
  });

  it('rejects activating a version that is not a draft', async () => {
    const prisma = buildPrisma();
    prisma.admissionPolicy.findFirst.mockResolvedValue({
      id: 'policy-a',
      currentVersionId: 'version-old',
      versions: [{ id: 'version-old', status: 'ACTIVE' }],
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
      currentVersionId: 'version-old',
      versions: [{ id: 'version-old', status: 'ACTIVE' }],
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

    await expect(service.archive('policy-a', actor)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.admissionPolicy.update).not.toHaveBeenCalled();
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
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admission_policy_duplicate',
        resourceId: 'policy-copy',
        after: expect.objectContaining({ duplicatedFromPolicyId: 'policy-a' }),
      }),
    );
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

  describe('approval chain', () => {
    it('creates an ApprovalPolicy on the first save and links it to the draft version', async () => {
      const prisma = buildPrisma();
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
      expect(prisma.admissionPolicyVersion.update).toHaveBeenCalledWith({
        where: { id: 'version-draft' },
        data: { approvalPolicyId: 'approval-policy-a' },
      });
      expect(prisma.approvalPolicy.update).not.toHaveBeenCalled();
    });

    it('replaces the existing ApprovalPolicy in place on a second save (no duplicate rows)', async () => {
      const prisma = buildPrisma();
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
      expect(prisma.approvalPolicy.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'approval-policy-a' },
          data: expect.objectContaining({
            minApprovals: 1,
            approverRoles: ['principal'],
          }),
        }),
      );
    });

    it('rejects editing the approval chain on a non-draft version', async () => {
      const prisma = buildPrisma();
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
      prisma.admissionPolicyVersion.findFirst.mockResolvedValue({
        id: 'version-draft',
        policyId: 'policy-a',
        status: 'DRAFT',
        approvalPolicyId: 'approval-policy-a',
      });
      const service = buildService(prisma);
      jest.spyOn(service, 'get').mockResolvedValue({ id: 'policy-a' } as any);

      await service.deleteApprovalChain('policy-a', 'version-draft', actor);

      expect(prisma.admissionPolicyVersion.update).toHaveBeenCalledWith({
        where: { id: 'version-draft' },
        data: { approvalPolicyId: null },
      });
      expect(prisma.approvalPolicy.delete).toHaveBeenCalledWith({
        where: { id: 'approval-policy-a' },
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
