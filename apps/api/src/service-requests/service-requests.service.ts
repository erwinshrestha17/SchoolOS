import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GuardianCapability,
  Prisma,
  SchoolServiceRequestCategory,
  SchoolServiceRequestNoteVisibility,
  SchoolServiceRequestPriority,
  SchoolServiceRequestStatus,
  SchoolServiceRequestType,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import {
  isParentOnly,
  requireGuardianCapability,
} from '../common/security/parent-scope';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AddSchoolServiceRequestNoteDto,
  CreateSchoolServiceRequestDto,
  EscalateSchoolServiceRequestDto,
  ListSchoolServiceRequestsDto,
  ReasonedSchoolServiceRequestDto,
  ResolveSchoolServiceRequestDto,
  TriageSchoolServiceRequestDto,
  UploadSchoolServiceRequestAttachmentDto,
} from './dto/service-request.dto';

const ACTIVE_REQUEST_STATUSES: readonly SchoolServiceRequestStatus[] = [
  SchoolServiceRequestStatus.OPEN,
  SchoolServiceRequestStatus.ASSIGNED,
  SchoolServiceRequestStatus.IN_PROGRESS,
  SchoolServiceRequestStatus.REOPENED,
] as const;
const MAX_PARENT_OPEN_REQUESTS = 20;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const REOPEN_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

@Injectable()
export class ServiceRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly fileRegistryService: FileRegistryService,
  ) {}

  async createParentRequest(
    studentId: string,
    dto: CreateSchoolServiceRequestDto,
    actor: AuthContext,
  ) {
    await this.assertParentStudent(studentId, actor);
    const existing = await this.prisma.schoolServiceRequest.findFirst({
      where: {
        tenantId: actor.tenantId,
        idempotencyKey: dto.idempotencyKey,
      },
      select: {
        id: true,
        requestedById: true,
        studentId: true,
        type: true,
      },
    });
    if (existing) {
      if (
        existing.requestedById !== actor.userId ||
        existing.studentId !== studentId ||
        existing.type !== dto.type
      ) {
        throw new ConflictException(
          'Service-request idempotency key was already used.',
        );
      }
      return this.getParentRequest(existing.id, actor);
    }

    const openCount = await this.prisma.schoolServiceRequest.count({
      where: {
        tenantId: actor.tenantId,
        requestedById: actor.userId,
        status: { in: [...ACTIVE_REQUEST_STATUSES] },
      },
    });
    if (openCount >= MAX_PARENT_OPEN_REQUESTS) {
      throw new ConflictException(
        'Please wait for the school to review existing requests before opening another.',
      );
    }

    const invoiceId = await this.validateRequestContext(studentId, dto, actor);
    if (
      dto.type === SchoolServiceRequestType.PAYMENT_DISPUTE &&
      (await this.prisma.schoolServiceRequest.findFirst({
        where: {
          tenantId: actor.tenantId,
          requestedById: actor.userId,
          invoiceId,
          type: SchoolServiceRequestType.PAYMENT_DISPUTE,
          status: { in: [...ACTIVE_REQUEST_STATUSES] },
        },
        select: { id: true },
      }))
    ) {
      throw new ConflictException(
        'An open payment dispute already exists for this invoice.',
      );
    }

    // P0-11: dedupe active general complaints for the same child + category.
    if (dto.type === SchoolServiceRequestType.GENERAL_COMPLAINT) {
      const duplicate = await this.prisma.schoolServiceRequest.findFirst({
        where: {
          tenantId: actor.tenantId,
          studentId,
          type: SchoolServiceRequestType.GENERAL_COMPLAINT,
          category: dto.category,
          status: { in: [...ACTIVE_REQUEST_STATUSES] },
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException(
          'An open request already exists for this child and category. Update that case or wait for the school to close it.',
        );
      }
    }

    const priority = dto.priority ?? SchoolServiceRequestPriority.NORMAL;
    const now = new Date();
    const responseDeadline = new Date(
      now.getTime() +
        (priority === SchoolServiceRequestPriority.HIGH ? 48 : 120) *
          60 *
          60 *
          1000,
    );

    let request: { id: string };
    try {
      request = await this.prisma.schoolServiceRequest.create({
        data: {
          tenantId: actor.tenantId,
          studentId,
          invoiceId,
          requestedById: actor.userId,
          type: dto.type,
          category: dto.category,
          priority,
          subject: dto.subject.trim(),
          description: dto.description.trim(),
          idempotencyKey: dto.idempotencyKey,
          responseDeadline,
        },
        select: { id: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const raced = await this.prisma.schoolServiceRequest.findFirst({
          where: {
            tenantId: actor.tenantId,
            idempotencyKey: dto.idempotencyKey,
          },
          select: {
            id: true,
            requestedById: true,
            studentId: true,
            type: true,
          },
        });
        if (
          raced &&
          raced.requestedById === actor.userId &&
          raced.studentId === studentId &&
          raced.type === dto.type
        ) {
          return this.getParentRequest(raced.id, actor);
        }
        throw new ConflictException(
          'Service-request idempotency key was already used.',
        );
      }
      throw error;
    }

    await this.auditService.record({
      action: 'service_request_created',
      resource: 'school_service_request',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: request.id,
      after: {
        type: dto.type,
        category: dto.category,
        priority,
        studentId,
        invoiceId,
        responseDeadline: responseDeadline.toISOString(),
      },
    });
    return this.getParentRequest(request.id, actor);
  }

  async listParentRequests(
    studentId: string,
    actor: AuthContext,
    status?: SchoolServiceRequestStatus,
  ) {
    await this.assertParentStudent(studentId, actor);
    const items = await this.prisma.schoolServiceRequest.findMany({
      where: {
        tenantId: actor.tenantId,
        studentId,
        requestedById: actor.userId,
        ...(status ? { status } : {}),
      },
      include: parentRequestInclude,
      orderBy: [{ updatedAt: 'desc' }],
      take: 50,
    });
    return {
      items: items.map((item) => this.toParentView(item)),
      total: items.length,
    };
  }

  async getParentRequest(requestId: string, actor: AuthContext) {
    this.assertParent(actor);
    const request = await this.prisma.schoolServiceRequest.findFirst({
      where: {
        id: requestId,
        tenantId: actor.tenantId,
        requestedById: actor.userId,
      },
      include: parentRequestInclude,
    });
    if (!request) {
      throw new NotFoundException('Service request not found.');
    }
    await this.assertParentStudent(request.studentId, actor);
    return this.toParentView(request);
  }

  async cancelParentRequest(
    requestId: string,
    dto: ReasonedSchoolServiceRequestDto,
    actor: AuthContext,
  ) {
    const request = await this.getParentOwnedRequest(requestId, actor);
    if (request.status === SchoolServiceRequestStatus.CANCELLED) {
      return this.getParentRequest(request.id, actor);
    }
    if (request.status !== SchoolServiceRequestStatus.OPEN) {
      throw new ConflictException(
        'Only an unassigned open request can be cancelled.',
      );
    }
    const now = new Date();
    const updated = await this.prisma.schoolServiceRequest.updateMany({
      where: {
        id: request.id,
        tenantId: actor.tenantId,
        requestedById: actor.userId,
        status: SchoolServiceRequestStatus.OPEN,
      },
      data: {
        status: SchoolServiceRequestStatus.CANCELLED,
        cancelledAt: now,
        cancellationReason: dto.reason.trim(),
      },
    });
    if (updated.count !== 1) {
      throw new ConflictException('Service request state changed. Refresh.');
    }
    await this.auditLifecycle(
      request,
      actor,
      'service_request_cancelled',
      SchoolServiceRequestStatus.CANCELLED,
      dto.reason,
    );
    return this.getParentRequest(request.id, actor);
  }

  async confirmParentResolution(requestId: string, actor: AuthContext) {
    const request = await this.getParentOwnedRequest(requestId, actor);
    if (request.status === SchoolServiceRequestStatus.CLOSED) {
      return this.getParentRequest(request.id, actor);
    }
    if (request.status !== SchoolServiceRequestStatus.RESOLVED) {
      throw new ConflictException(
        'Only a resolved request can be confirmed closed.',
      );
    }
    const now = new Date();
    const result = await this.prisma.schoolServiceRequest.updateMany({
      where: {
        id: request.id,
        tenantId: actor.tenantId,
        requestedById: actor.userId,
        status: SchoolServiceRequestStatus.RESOLVED,
      },
      data: {
        status: SchoolServiceRequestStatus.CLOSED,
        parentConfirmedAt: now,
        closedAt: now,
        closedById: actor.userId,
      },
    });
    if (result.count !== 1) {
      throw new ConflictException('Service request state changed. Refresh.');
    }
    await this.auditLifecycle(
      request,
      actor,
      'service_request_resolution_confirmed',
      SchoolServiceRequestStatus.CLOSED,
    );
    return this.getParentRequest(request.id, actor);
  }

  async reopenParentRequest(
    requestId: string,
    dto: ReasonedSchoolServiceRequestDto,
    actor: AuthContext,
  ) {
    const request = await this.getParentOwnedRequest(requestId, actor);
    if (request.status === SchoolServiceRequestStatus.REOPENED) {
      return this.getParentRequest(request.id, actor);
    }
    if (
      request.status !== SchoolServiceRequestStatus.RESOLVED &&
      request.status !== SchoolServiceRequestStatus.CLOSED
    ) {
      throw new ConflictException(
        'Only a resolved or recently closed request can be reopened.',
      );
    }
    const resolutionTime = request.closedAt ?? request.resolvedAt;
    if (
      !resolutionTime ||
      Date.now() - resolutionTime.getTime() > REOPEN_WINDOW_MS
    ) {
      throw new ConflictException(
        'The reopening window has ended. Submit a new request if help is still needed.',
      );
    }
    const now = new Date();
    const result = await this.prisma.schoolServiceRequest.updateMany({
      where: {
        id: request.id,
        tenantId: actor.tenantId,
        requestedById: actor.userId,
        status: request.status,
      },
      data: {
        status: SchoolServiceRequestStatus.REOPENED,
        reopenedAt: now,
        reopenReason: dto.reason.trim(),
        responseDeadline: new Date(now.getTime() + 72 * 60 * 60 * 1000),
        parentConfirmedAt: null,
        closedAt: null,
        closedById: null,
      },
    });
    if (result.count !== 1) {
      throw new ConflictException('Service request state changed. Refresh.');
    }
    await this.auditLifecycle(
      request,
      actor,
      'service_request_reopened',
      SchoolServiceRequestStatus.REOPENED,
      dto.reason,
    );
    return this.getParentRequest(request.id, actor);
  }

  async uploadParentAttachment(
    requestId: string,
    dto: UploadSchoolServiceRequestAttachmentDto,
    actor: AuthContext,
  ) {
    const request = await this.getParentOwnedRequest(requestId, actor);
    if (
      request.status === SchoolServiceRequestStatus.CANCELLED ||
      request.status === SchoolServiceRequestStatus.CLOSED
    ) {
      throw new ConflictException(
        'Attachments cannot be added to a closed request.',
      );
    }
    const base64 = dto.base64Content.replace(/\s/g, '');
    const bytes = Buffer.from(base64, 'base64');
    if (bytes.length === 0 || bytes.length > MAX_ATTACHMENT_BYTES) {
      throw new BadRequestException(
        'Evidence must be a non-empty image or PDF up to 5 MB.',
      );
    }
    if (!hasExpectedFileSignature(bytes, dto.contentType)) {
      throw new BadRequestException(
        'Evidence content does not match the selected file type.',
      );
    }
    const fileName = dto.fileName.trim().split(/[\\/]/).pop() ?? '';
    if (
      !fileName ||
      /\.(exe|bat|cmd|com|scr|js|mjs|sh|ps1|php|jar)$/i.test(fileName)
    ) {
      throw new BadRequestException('Evidence file name is not allowed.');
    }
    const asset = await this.fileRegistryService.registerUploadedBase64File({
      tenantId: actor.tenantId,
      uploadedByUserId: actor.userId,
      originalFilename: fileName,
      mimeType: dto.contentType,
      base64Content: base64,
      module: 'service-requests',
      entityId: request.id,
      metadata: {
        source: 'parent_mobile',
        requestType: request.type,
      },
    });
    const attachment = await this.prisma.schoolServiceRequestAttachment.create({
      data: {
        tenantId: actor.tenantId,
        requestId: request.id,
        fileAssetId: asset.id,
        createdById: actor.userId,
        label: dto.label?.trim() || null,
      },
      select: { id: true },
    });
    await this.auditService.record({
      action: 'service_request_attachment_added',
      resource: 'school_service_request',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: request.id,
      after: { attachmentId: attachment.id, fileAssetId: asset.id },
    });
    return this.getParentRequest(request.id, actor);
  }

  async downloadAttachment(
    requestId: string,
    attachmentId: string,
    actor: AuthContext,
  ) {
    const parent = isParentOnly(actor);
    if (parent) {
      await this.getParentOwnedRequest(requestId, actor);
    } else {
      this.assertManager(actor, true);
    }
    const attachment =
      await this.prisma.schoolServiceRequestAttachment.findFirst({
        where: {
          id: attachmentId,
          tenantId: actor.tenantId,
          requestId,
          request: parent
            ? { requestedById: actor.userId }
            : { tenantId: actor.tenantId },
        },
        select: { fileAssetId: true },
      });
    if (!attachment) {
      throw new NotFoundException('Service-request attachment not found.');
    }
    return this.fileRegistryService.downloadLinkedFile(actor, {
      assetId: attachment.fileAssetId,
      module: 'service-requests',
      entityId: requestId,
    });
  }

  async listManagerRequests(
    query: ListSchoolServiceRequestsDto,
    actor: AuthContext,
  ) {
    this.assertManager(actor, false);
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where: Prisma.SchoolServiceRequestWhereInput = {
      tenantId: actor.tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.schoolServiceRequest.findMany({
        where,
        include: managerRequestInclude,
        orderBy: [
          { priority: 'desc' },
          { responseDeadline: 'asc' },
          { createdAt: 'asc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.schoolServiceRequest.count({ where }),
    ]);
    return {
      items: items.map((item) => this.toManagerView(item)),
      total,
      page,
      limit,
      hasNextPage: page * limit < total,
    };
  }

  async getManagerRequest(requestId: string, actor: AuthContext) {
    this.assertManager(actor, false);
    const request = await this.prisma.schoolServiceRequest.findFirst({
      where: { id: requestId, tenantId: actor.tenantId },
      include: managerRequestInclude,
    });
    if (!request) {
      throw new NotFoundException('Service request not found.');
    }
    return this.toManagerView(request);
  }

  async triageRequest(
    requestId: string,
    dto: TriageSchoolServiceRequestDto,
    actor: AuthContext,
  ) {
    this.assertManager(actor, true);
    const request = await this.getManagerMutableRequest(requestId, actor);
    const deadline = new Date(dto.responseDeadline);
    if (Number.isNaN(deadline.getTime()) || deadline <= new Date()) {
      throw new BadRequestException(
        'Response deadline must be a future date and time.',
      );
    }
    await this.assertEligibleManager(dto.assignedToUserId, actor);
    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.schoolServiceRequest.updateMany({
        where: {
          id: request.id,
          tenantId: actor.tenantId,
          status: request.status,
        },
        data: {
          assignedToId: dto.assignedToUserId,
          assignedById: actor.userId,
          assignedAt: now,
          priority: dto.priority,
          responseDeadline: deadline,
          status: dto.status,
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Service request state changed. Refresh.');
      }
      await tx.schoolServiceRequestNote.create({
        data: {
          tenantId: actor.tenantId,
          requestId: request.id,
          createdById: actor.userId,
          visibility: SchoolServiceRequestNoteVisibility.INTERNAL,
          body: `Triage: ${dto.reason.trim()}`,
        },
      });
    });
    await this.auditLifecycle(
      request,
      actor,
      'service_request_triaged',
      dto.status,
      dto.reason,
      {
        assignedToId: dto.assignedToUserId,
        priority: dto.priority,
        responseDeadline: deadline.toISOString(),
      },
    );
    return this.getManagerRequest(request.id, actor);
  }

  async addManagerNote(
    requestId: string,
    dto: AddSchoolServiceRequestNoteDto,
    actor: AuthContext,
  ) {
    this.assertManager(actor, true);
    const request = await this.getManagerMutableRequest(requestId, actor, true);
    const note = await this.prisma.schoolServiceRequestNote.create({
      data: {
        tenantId: actor.tenantId,
        requestId: request.id,
        createdById: actor.userId,
        body: dto.body.trim(),
        visibility: dto.visibility,
      },
      select: { id: true },
    });
    await this.auditService.record({
      action: 'service_request_note_added',
      resource: 'school_service_request',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: request.id,
      after: { noteId: note.id, visibility: dto.visibility },
    });
    return this.getManagerRequest(request.id, actor);
  }

  async resolveRequest(
    requestId: string,
    dto: ResolveSchoolServiceRequestDto,
    actor: AuthContext,
  ) {
    this.assertManager(actor, true);
    const request = await this.getManagerMutableRequest(requestId, actor);
    this.assertIndependentResolver(request, actor);
    const now = new Date();
    const result = await this.prisma.schoolServiceRequest.updateMany({
      where: {
        id: request.id,
        tenantId: actor.tenantId,
        status: request.status,
      },
      data: {
        status: SchoolServiceRequestStatus.RESOLVED,
        resolutionSummary: dto.resolutionSummary.trim(),
        resolvedAt: now,
        resolvedById: actor.userId,
      },
    });
    if (result.count !== 1) {
      throw new ConflictException('Service request state changed. Refresh.');
    }
    await this.auditLifecycle(
      request,
      actor,
      'service_request_resolved',
      SchoolServiceRequestStatus.RESOLVED,
      dto.resolutionSummary,
    );
    return this.getManagerRequest(request.id, actor);
  }

  async escalateRequest(
    requestId: string,
    dto: EscalateSchoolServiceRequestDto,
    actor: AuthContext,
  ) {
    this.assertManager(actor, true);
    const request = await this.getManagerMutableRequest(requestId, actor);
    if (
      request.assignedToId &&
      request.assignedToId === dto.assignedToUserId
    ) {
      throw new ConflictException(
        'Escalation must reassign the case to a different manager.',
      );
    }
    await this.assertEligibleManager(dto.assignedToUserId, actor);
    const now = new Date();
    const escalationDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const result = await this.prisma.schoolServiceRequest.updateMany({
      where: {
        id: request.id,
        tenantId: actor.tenantId,
        status: request.status,
      },
      data: {
        priority: SchoolServiceRequestPriority.HIGH,
        escalatedAt: now,
        escalatedById: actor.userId,
        escalationReason: dto.reason.trim(),
        assignedToId: dto.assignedToUserId,
        assignedById: actor.userId,
        assignedAt: now,
        status:
          request.status === SchoolServiceRequestStatus.OPEN
            ? SchoolServiceRequestStatus.ASSIGNED
            : request.status,
        responseDeadline:
          request.responseDeadline < escalationDeadline
            ? request.responseDeadline
            : escalationDeadline,
      },
    });
    if (result.count !== 1) {
      throw new ConflictException('Service request state changed. Refresh.');
    }
    await this.auditLifecycle(
      request,
      actor,
      'service_request_escalated',
      request.status === SchoolServiceRequestStatus.OPEN
        ? SchoolServiceRequestStatus.ASSIGNED
        : request.status,
      dto.reason,
      { assignedToId: dto.assignedToUserId },
    );
    return this.getManagerRequest(request.id, actor);
  }

  private assertIndependentResolver(
    request: {
      requestedById: string;
      assignedToId: string | null;
      type: SchoolServiceRequestType;
    },
    actor: AuthContext,
  ) {
    // P0-11: requester and first assigned responder cannot close the dispute.
    if (request.requestedById === actor.userId) {
      throw new ForbiddenException(
        'Independent review required: you cannot resolve your own service request.',
      );
    }
    if (request.assignedToId && request.assignedToId === actor.userId) {
      throw new ForbiddenException(
        'Independent review required: the assigned responder cannot resolve this case. Escalate to another manager first.',
      );
    }
  }

  private async validateRequestContext(
    studentId: string,
    dto: CreateSchoolServiceRequestDto,
    actor: AuthContext,
  ) {
    await this.requireCategoryCapability(studentId, dto.category, actor);

    if (dto.type === SchoolServiceRequestType.PAYMENT_DISPUTE) {
      await requireGuardianCapability(
        this.prisma,
        actor,
        studentId,
        GuardianCapability.FEES_VIEW,
      );
      if (!dto.invoiceId) {
        throw new BadRequestException(
          'Choose the invoice related to this payment dispute.',
        );
      }
      if (dto.category !== 'FEES_AND_PAYMENTS') {
        throw new BadRequestException(
          'Payment disputes must use the fees and payments category.',
        );
      }
      const invoice = await this.prisma.invoice.findFirst({
        where: {
          id: dto.invoiceId,
          tenantId: actor.tenantId,
          studentId,
        },
        select: { id: true },
      });
      if (!invoice) {
        throw new NotFoundException(
          'Invoice was not found for this linked child.',
        );
      }
      return invoice.id;
    }
    if (dto.invoiceId) {
      throw new BadRequestException(
        'Invoice selection is only available for payment disputes.',
      );
    }
    return null;
  }

  private async requireCategoryCapability(
    studentId: string,
    category: SchoolServiceRequestCategory,
    actor: AuthContext,
  ) {
    // COMPLAINT_OR_CORRECTION_SUBMIT is already required by assertParentStudent.
    // Category-specific capabilities keep P0-11 requester authority honest.
    if (category === SchoolServiceRequestCategory.ATTENDANCE) {
      await requireGuardianCapability(
        this.prisma,
        actor,
        studentId,
        GuardianCapability.ATTENDANCE_VIEW,
      );
      return;
    }
    if (category === SchoolServiceRequestCategory.ACADEMICS) {
      await requireGuardianCapability(
        this.prisma,
        actor,
        studentId,
        GuardianCapability.ACADEMICS_VIEW,
      );
      return;
    }
    if (category === SchoolServiceRequestCategory.FEES_AND_PAYMENTS) {
      await requireGuardianCapability(
        this.prisma,
        actor,
        studentId,
        GuardianCapability.FEES_VIEW,
      );
    }
  }

  private assertParent(actor: AuthContext) {
    if (!isParentOnly(actor)) {
      throw new ForbiddenException(
        'Parent service requests are not available for this account.',
      );
    }
  }

  private async assertParentStudent(studentId: string, actor: AuthContext) {
    this.assertParent(actor);
    await requireGuardianCapability(
      this.prisma,
      actor,
      studentId,
      GuardianCapability.COMPLAINT_OR_CORRECTION_SUBMIT,
    );
  }

  private async getParentOwnedRequest(requestId: string, actor: AuthContext) {
    this.assertParent(actor);
    const request = await this.prisma.schoolServiceRequest.findFirst({
      where: {
        id: requestId,
        tenantId: actor.tenantId,
        requestedById: actor.userId,
      },
    });
    if (!request) {
      throw new NotFoundException('Service request not found.');
    }
    await this.assertParentStudent(request.studentId, actor);
    return request;
  }

  private assertManager(actor: AuthContext, write: boolean) {
    const permission = write
      ? 'service_requests:manage'
      : 'service_requests:read';
    if (
      !actor.roles.includes('platform_super_admin') &&
      !actor.permissions.includes(permission)
    ) {
      throw new ForbiddenException(
        'You do not have permission to manage school service requests.',
      );
    }
  }

  private async assertEligibleManager(userId: string, actor: AuthContext) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        tenantId: actor.tenantId,
        status: 'ACTIVE',
        userRoles: {
          some: {
            tenantId: actor.tenantId,
            role: {
              rolePermissions: {
                some: {
                  permission: {
                    resource: 'service_requests',
                    action: 'manage',
                  },
                },
              },
            },
          },
        },
      },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException(
        'Eligible service-request responder not found in this school.',
      );
    }
  }

  private async getManagerMutableRequest(
    requestId: string,
    actor: AuthContext,
    allowResolved = false,
  ) {
    const request = await this.prisma.schoolServiceRequest.findFirst({
      where: { id: requestId, tenantId: actor.tenantId },
    });
    if (!request) {
      throw new NotFoundException('Service request not found.');
    }
    const allowed = allowResolved
      ? [
          ...ACTIVE_REQUEST_STATUSES,
          SchoolServiceRequestStatus.RESOLVED,
        ].includes(request.status)
      : ACTIVE_REQUEST_STATUSES.includes(request.status);
    if (!allowed) {
      throw new ConflictException(
        'This service request is closed and cannot be changed.',
      );
    }
    return request;
  }

  private toParentView(request: ParentRequestRecord) {
    return {
      id: request.id,
      student: {
        id: request.student.id,
        name: `${request.student.firstNameEn} ${request.student.lastNameEn}`.trim(),
        classSection: [
          request.student.class.name,
          request.student.sectionRef?.name,
        ]
          .filter(Boolean)
          .join(' - '),
      },
      type: request.type,
      category: request.category,
      priority: request.priority,
      subject: request.subject,
      description: request.description,
      status: request.status,
      invoice: request.invoice
        ? {
            id: request.invoice.id,
            invoiceNumber: request.invoice.invoiceNumber,
            status: request.invoice.status,
            totalAmount: Number(request.invoice.totalAmount),
            dueDate: request.invoice.dueDate.toISOString(),
          }
        : null,
      responder: request.assignedTo
        ? { name: safeStaffName(request.assignedTo.staff) }
        : null,
      responseDeadline: request.responseDeadline.toISOString(),
      isOverdue:
        ACTIVE_REQUEST_STATUSES.includes(request.status) &&
        request.responseDeadline.getTime() < Date.now(),
      resolutionSummary: request.resolutionSummary,
      notes: request.notes
        .filter(
          (note) =>
            note.visibility === SchoolServiceRequestNoteVisibility.PARENT,
        )
        .map((note) => ({
          id: note.id,
          body: note.body,
          createdAt: note.createdAt.toISOString(),
          author: safeStaffName(note.createdBy.staff),
        })),
      attachments: request.attachments.map((attachment) => ({
        id: attachment.id,
        fileName: attachment.fileAsset.originalFilename,
        mimeType: attachment.fileAsset.mimeType,
        sizeBytes: Number(attachment.fileAsset.sizeBytes),
        label: attachment.label,
        downloadPath: `/mobile/service-requests/${request.id}/attachments/${attachment.id}`,
        createdAt: attachment.createdAt.toISOString(),
      })),
      actions: {
        cancel: request.status === SchoolServiceRequestStatus.OPEN,
        confirmResolution:
          request.status === SchoolServiceRequestStatus.RESOLVED,
        reopen:
          (request.status === SchoolServiceRequestStatus.RESOLVED ||
            request.status === SchoolServiceRequestStatus.CLOSED) &&
          Boolean(
            (request.closedAt ?? request.resolvedAt) &&
            Date.now() - (request.closedAt ?? request.resolvedAt)!.getTime() <=
              REOPEN_WINDOW_MS,
          ),
        addEvidence:
          request.status !== SchoolServiceRequestStatus.CANCELLED &&
          request.status !== SchoolServiceRequestStatus.CLOSED,
      },
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
    };
  }

  private toManagerView(request: ManagerRequestRecord) {
    const parentView = this.toParentView(request);
    return {
      ...parentView,
      attachments: parentView.attachments.map((attachment) => ({
        ...attachment,
        downloadPath: `/service-requests/${request.id}/attachments/${attachment.id}`,
      })),
      requestedBy: {
        id: request.requestedBy.id,
        name:
          request.requestedBy.guardian?.fullName ??
          safeStaffName(request.requestedBy.staff),
      },
      assignedTo: request.assignedTo
        ? {
            id: request.assignedTo.id,
            name: safeStaffName(request.assignedTo.staff),
          }
        : null,
      internalNotes: request.notes
        .filter(
          (note) =>
            note.visibility === SchoolServiceRequestNoteVisibility.INTERNAL,
        )
        .map((note) => ({
          id: note.id,
          body: note.body,
          createdAt: note.createdAt.toISOString(),
          author: safeStaffName(note.createdBy.staff),
        })),
      escalation: request.escalatedAt
        ? {
            at: request.escalatedAt.toISOString(),
            reason: request.escalationReason,
          }
        : null,
    };
  }

  private async auditLifecycle(
    request: {
      id: string;
      tenantId: string;
      status: SchoolServiceRequestStatus;
    },
    actor: AuthContext,
    action: string,
    status: SchoolServiceRequestStatus,
    reason?: { reason: string } | string,
    extra?: Record<string, unknown>,
  ) {
    await this.auditService.record({
      action,
      resource: 'school_service_request',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: request.id,
      before: { status: request.status },
      after: {
        status,
        reason:
          typeof reason === 'string' ? reason.trim() : reason?.reason.trim(),
        ...extra,
      },
    });
  }
}

const parentRequestInclude = {
  student: {
    select: {
      id: true,
      firstNameEn: true,
      lastNameEn: true,
      class: { select: { name: true } },
      sectionRef: { select: { name: true } },
    },
  },
  invoice: {
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      totalAmount: true,
      dueDate: true,
    },
  },
  assignedTo: {
    select: {
      id: true,
      staff: { select: { firstName: true, lastName: true } },
    },
  },
  notes: {
    where: { visibility: SchoolServiceRequestNoteVisibility.PARENT },
    select: {
      id: true,
      body: true,
      createdAt: true,
      visibility: true,
      createdBy: {
        select: {
          staff: { select: { firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
  attachments: {
    select: {
      id: true,
      label: true,
      createdAt: true,
      fileAsset: {
        select: {
          originalFilename: true,
          mimeType: true,
          sizeBytes: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.SchoolServiceRequestInclude;

const managerRequestInclude = {
  ...parentRequestInclude,
  requestedBy: {
    select: {
      id: true,
      guardian: { select: { fullName: true } },
      staff: { select: { firstName: true, lastName: true } },
    },
  },
  notes: {
    select: {
      id: true,
      body: true,
      createdAt: true,
      visibility: true,
      createdBy: {
        select: {
          staff: { select: { firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.SchoolServiceRequestInclude;

type ParentRequestRecord = Prisma.SchoolServiceRequestGetPayload<{
  include: typeof parentRequestInclude;
}>;
type ManagerRequestRecord = Prisma.SchoolServiceRequestGetPayload<{
  include: typeof managerRequestInclude;
}>;

function safeStaffName(staff: { firstName: string; lastName: string } | null) {
  if (!staff) return 'School team';
  return `${staff.firstName} ${staff.lastName}`.trim() || 'School team';
}

function hasExpectedFileSignature(content: Buffer, mimeType: string) {
  if (mimeType === 'application/pdf') {
    return content.subarray(0, 5).toString('ascii') === '%PDF-';
  }
  if (mimeType === 'image/jpeg') {
    return (
      content.length >= 3 &&
      content[0] === 0xff &&
      content[1] === 0xd8 &&
      content[2] === 0xff
    );
  }
  if (mimeType === 'image/png') {
    return (
      content.length >= 8 &&
      content
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    );
  }
  if (mimeType === 'image/webp') {
    return (
      content.length >= 12 &&
      content.subarray(0, 4).toString('ascii') === 'RIFF' &&
      content.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  return false;
}
