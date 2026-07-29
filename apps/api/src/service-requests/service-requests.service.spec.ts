import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  AuthMethod,
  SchoolServiceRequestCategory,
  SchoolServiceRequestNoteVisibility,
  SchoolServiceRequestPriority,
  SchoolServiceRequestStatus,
  SchoolServiceRequestType,
} from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { ServiceRequestsService } from './service-requests.service';

describe('ServiceRequestsService', () => {
  const parentActor: AuthContext = {
    userId: 'parent-1',
    tenantId: 'tenant-1',
    tenantSlug: 'school-one',
    email: 'parent@school.test',
    authMethod: AuthMethod.PASSWORD,
    roles: ['parent'],
    permissions: ['service_requests:create', 'service_requests:read'],
  };
  const managerActor: AuthContext = {
    ...parentActor,
    userId: 'principal-1',
    email: 'principal@school.test',
    roles: ['principal'],
    permissions: ['service_requests:read', 'service_requests:manage'],
  };

  let prisma: {
    guardian: { findFirst: jest.Mock };
    invoice: { findFirst: jest.Mock };
    schoolServiceRequest: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      updateMany: jest.Mock;
    };
    schoolServiceRequestNote: { create: jest.Mock };
    schoolServiceRequestAttachment: {
      findFirst: jest.Mock;
      create: jest.Mock;
    };
    user: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };
  let auditService: { record: jest.Mock };
  let fileRegistryService: {
    registerUploadedBase64File: jest.Mock;
    downloadLinkedFile: jest.Mock;
  };
  let service: ServiceRequestsService;

  beforeEach(() => {
    prisma = {
      guardian: { findFirst: jest.fn() },
      invoice: { findFirst: jest.fn() },
      schoolServiceRequest: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      schoolServiceRequestNote: { create: jest.fn() },
      schoolServiceRequestAttachment: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      user: { findFirst: jest.fn() },
      $transaction: jest.fn(),
    };
    auditService = { record: jest.fn() };
    fileRegistryService = {
      registerUploadedBase64File: jest.fn(),
      downloadLinkedFile: jest.fn(),
    };
    service = new ServiceRequestsService(
      prisma as never,
      auditService as never,
      fileRegistryService as never,
    );
  });

  it('creates a linked-child complaint with tenant-scoped idempotency and audit', async () => {
    prisma.guardian.findFirst.mockResolvedValue(guardianRelationshipFixture());
    prisma.schoolServiceRequest.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(parentRequestFixture());
    prisma.schoolServiceRequest.create.mockResolvedValue({ id: 'request-1' });

    const result = await service.createParentRequest(
      'student-1',
      {
        confirmStudentId: 'student-1',
        type: SchoolServiceRequestType.GENERAL_COMPLAINT,
        category: SchoolServiceRequestCategory.ATTENDANCE,
        subject: 'Attendance concern',
        description: 'Please review the attendance record for this week.',
        idempotencyKey: '0fdace11-23ef-4ea5-982e-7c81831d80da',
      },
      parentActor,
    );

    expect(result.id).toBe('request-1');
    expect(prisma.schoolServiceRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        studentId: 'student-1',
        requestedById: 'parent-1',
        confirmStudentId: 'student-1',
        type: SchoolServiceRequestType.GENERAL_COMPLAINT,
        idempotencyKey: '0fdace11-23ef-4ea5-982e-7c81831d80da',
      }),
      select: { id: true },
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'service_request_created',
        tenantId: 'tenant-1',
        userId: 'parent-1',
        resourceId: 'request-1',
      }),
    );
  });

  it('rejects a payment dispute for an invoice outside the linked child scope', async () => {
    prisma.guardian.findFirst.mockResolvedValue(guardianRelationshipFixture());
    prisma.schoolServiceRequest.findFirst.mockResolvedValue(null);
    prisma.invoice.findFirst.mockResolvedValue(null);

    await expect(
      service.createParentRequest(
        'student-1',
        {
          confirmStudentId: 'student-1',
          type: SchoolServiceRequestType.PAYMENT_DISPUTE,
          category: SchoolServiceRequestCategory.FEES_AND_PAYMENTS,
          subject: 'Payment is missing',
          description: 'The payment made yesterday is not shown on this bill.',
          invoiceId: '606a44ce-b720-4586-b273-2cf64d3a8118',
          idempotencyKey: '241f5aaa-d06d-42c4-bef6-eb019f4c5300',
        },
        parentActor,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.invoice.findFirst).toHaveBeenCalledWith({
      where: {
        id: '606a44ce-b720-4586-b273-2cf64d3a8118',
        tenantId: 'tenant-1',
        studentId: 'student-1',
      },
      select: { id: true },
    });
    expect(prisma.schoolServiceRequest.create).not.toHaveBeenCalled();
  });

  it('rejects an idempotency key replayed by another parent', async () => {
    prisma.guardian.findFirst.mockResolvedValue(guardianRelationshipFixture());
    prisma.schoolServiceRequest.findFirst.mockResolvedValue({
      id: 'existing-request',
      requestedById: 'parent-2',
      studentId: 'student-1',
      type: SchoolServiceRequestType.GENERAL_COMPLAINT,
    });

    await expect(
      service.createParentRequest(
        'student-1',
        {
          confirmStudentId: 'student-1',
        type: SchoolServiceRequestType.GENERAL_COMPLAINT,
          category: SchoolServiceRequestCategory.OTHER,
          subject: 'Existing key',
          description: 'This should not reuse another family request key.',
          idempotencyKey: '115613aa-30c1-4751-8779-d70ea7507f7c',
        },
        parentActor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.schoolServiceRequest.create).not.toHaveBeenCalled();
  });

  it('removes internal notes from the parent response as a second safety layer', async () => {
    prisma.guardian.findFirst.mockResolvedValue(guardianRelationshipFixture());
    prisma.schoolServiceRequest.findFirst.mockResolvedValue(
      parentRequestFixture({
        notes: [
          noteFixture('parent-note', SchoolServiceRequestNoteVisibility.PARENT),
          noteFixture(
            'internal-note',
            SchoolServiceRequestNoteVisibility.INTERNAL,
          ),
        ],
      }),
    );

    const result = await service.getParentRequest('request-1', parentActor);

    expect(result.notes).toEqual([
      expect.objectContaining({ id: 'parent-note' }),
    ]);
  });

  it('rejects attachment bytes that do not match the declared content type', async () => {
    prisma.guardian.findFirst.mockResolvedValue(guardianRelationshipFixture());
    prisma.schoolServiceRequest.findFirst.mockResolvedValue({
      id: 'request-1',
      tenantId: 'tenant-1',
      studentId: 'student-1',
      requestedById: 'parent-1',
      type: SchoolServiceRequestType.GENERAL_COMPLAINT,
      status: SchoolServiceRequestStatus.OPEN,
    });

    await expect(
      service.uploadParentAttachment(
        'request-1',
        {
          fileName: 'evidence.pdf',
          contentType: 'application/pdf',
          base64Content: Buffer.from('not a PDF').toString('base64'),
        },
        parentActor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(
      fileRegistryService.registerUploadedBase64File,
    ).not.toHaveBeenCalled();
  });

  it('scopes manager queues by tenant and paginates them on the server', async () => {
    prisma.schoolServiceRequest.findMany.mockResolvedValue([]);
    prisma.schoolServiceRequest.count.mockResolvedValue(0);

    const result = await service.listManagerRequests(
      {
        status: SchoolServiceRequestStatus.OPEN,
        page: 2,
        limit: 10,
      },
      managerActor,
    );

    expect(result).toEqual({
      items: [],
      total: 0,
      page: 2,
      limit: 10,
      hasNextPage: false,
    });
    expect(prisma.schoolServiceRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-1',
          status: SchoolServiceRequestStatus.OPEN,
        },
        skip: 10,
        take: 10,
      }),
    );
  });

  it('fails closed when staff lacks the service-request permission', async () => {
    await expect(
      service.listManagerRequests({}, { ...managerActor, permissions: [] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.schoolServiceRequest.findMany).not.toHaveBeenCalled();
  });

  it('does not audit a resolution when the compare-and-set update loses a race', async () => {
    prisma.schoolServiceRequest.findFirst.mockResolvedValue({
      id: 'request-1',
      tenantId: 'tenant-1',
      status: SchoolServiceRequestStatus.IN_PROGRESS,
      responseDeadline: new Date('2026-07-27T00:00:00.000Z'),
    });
    prisma.schoolServiceRequest.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.resolveRequest(
        'request-1',
        { resolutionSummary: 'The school completed the requested review.' },
        managerActor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('checks request ownership and tenant before serving a protected attachment', async () => {
    prisma.guardian.findFirst.mockResolvedValue(guardianRelationshipFixture());
    prisma.schoolServiceRequest.findFirst.mockResolvedValue({
      id: 'request-1',
      tenantId: 'tenant-1',
      studentId: 'student-1',
      requestedById: 'parent-1',
      status: SchoolServiceRequestStatus.OPEN,
    });
    prisma.schoolServiceRequestAttachment.findFirst.mockResolvedValue(null);

    await expect(
      service.downloadAttachment('request-1', 'attachment-other', parentActor),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(
      prisma.schoolServiceRequestAttachment.findFirst,
    ).toHaveBeenCalledWith({
      where: {
        id: 'attachment-other',
        tenantId: 'tenant-1',
        requestId: 'request-1',
        request: { requestedById: 'parent-1' },
      },
      select: { fileAssetId: true },
    });
    expect(fileRegistryService.downloadLinkedFile).not.toHaveBeenCalled();
  });
});

function guardianRelationshipFixture() {
  return {
    id: 'guardian-1',
    studentLinks: [
      {
        id: 'student-guardian-1',
        studentId: 'student-1',
        guardianId: 'guardian-1',
        relation: 'parent',
        capabilities: [
          'COMPLAINT_OR_CORRECTION_SUBMIT',
          'FEES_VIEW',
        ],
        effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        effectiveUntil: null,
        emergencyContactPriority: 1,
      },
    ],
  };
}

function parentRequestFixture(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'request-1',
    tenantId: 'tenant-1',
    studentId: 'student-1',
    requestedById: 'parent-1',
    type: SchoolServiceRequestType.GENERAL_COMPLAINT,
    category: SchoolServiceRequestCategory.ATTENDANCE,
    priority: SchoolServiceRequestPriority.NORMAL,
    subject: 'Attendance concern',
    description: 'Please review the attendance record for this week.',
    status: SchoolServiceRequestStatus.OPEN,
    responseDeadline: new Date('2026-07-31T00:00:00.000Z'),
    resolutionSummary: null,
    resolvedAt: null,
    closedAt: null,
    student: {
      id: 'student-1',
      firstNameEn: 'Aarav',
      lastNameEn: 'Shrestha',
      class: { name: 'Class 5' },
      sectionRef: { name: 'A' },
    },
    invoice: null,
    assignedTo: null,
    notes: [],
    attachments: [],
    createdAt: new Date('2026-07-26T00:00:00.000Z'),
    updatedAt: new Date('2026-07-26T00:00:00.000Z'),
    ...overrides,
  };
}

function noteFixture(
  id: string,
  visibility: SchoolServiceRequestNoteVisibility,
) {
  return {
    id,
    body: `${id} body`,
    visibility,
    createdAt: new Date('2026-07-26T00:00:00.000Z'),
    createdBy: { staff: null },
  };
}
