import { Injectable } from '@nestjs/common';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { AdmissionCaseQueuesService } from './admission-case-queues.service';

@Injectable()
export class MobileAdmissionsSummaryService {
  constructor(
    private readonly admissionCaseQueuesService: AdmissionCaseQueuesService,
    private readonly prisma: PrismaService,
  ) {}

  async getPrincipalSummary(actor: AuthContext) {
    const [waitingReview, approved, documentsPending, duplicateWarnings, iemisFollowUp] =
      await Promise.all([
        this.admissionCaseQueuesService.list(actor, {
          queue: 'WAITING_FOR_REVIEW',
          page: 1,
          limit: 1,
        }),
        this.admissionCaseQueuesService.list(actor, {
          queue: 'APPROVED',
          page: 1,
          limit: 1,
        }),
        this.admissionCaseQueuesService.list(actor, {
          queue: 'DOCUMENTS_PENDING',
          page: 1,
          limit: 1,
        }),
        this.admissionCaseQueuesService.list(actor, {
          queue: 'DUPLICATE_WARNINGS',
          page: 1,
          limit: 1,
        }),
        this.prisma.student.count({
          where: {
            tenantId: actor.tenantId,
            lifecycleStatus: 'ACTIVE',
            nationalStudentId: null,
          },
        }),
      ]);

    const items = [
      {
        id: 'waiting-review',
        title: 'Admissions needing review',
        detail: `${waitingReview.total} case${waitingReview.total === 1 ? '' : 's'} awaiting a school decision`,
        status: waitingReview.total > 0 ? 'attention' : 'clear',
        route: '/principal/admissions/review',
      },
      {
        id: 'approved-ready',
        title: 'Approved cases ready to admit',
        detail: `${approved.total} case${approved.total === 1 ? '' : 's'} ready for final admission`,
        status: approved.total > 0 ? 'attention' : 'clear',
        route: '/principal/admissions/approved',
      },
      {
        id: 'documents-pending',
        title: 'Missing documents',
        detail: `${documentsPending.total} admitted student${documentsPending.total === 1 ? '' : 's'} with document follow-up`,
        status: documentsPending.total > 0 ? 'attention' : 'clear',
        route: '/principal/admissions/documents',
      },
      {
        id: 'duplicate-warnings',
        title: 'Duplicate warnings',
        detail: `${duplicateWarnings.total} case${duplicateWarnings.total === 1 ? '' : 's'} need duplicate review`,
        status: duplicateWarnings.total > 0 ? 'attention' : 'clear',
        route: '/principal/admissions/duplicates',
      },
    ];

    return {
      metrics: {
        waitingForReview: waitingReview.total,
        approvedReadyToAdmit: approved.total,
        documentsPending: documentsPending.total,
        duplicateWarnings: duplicateWarnings.total,
        iemisFollowUp,
      },
      items,
      lastUpdated: new Date().toISOString(),
    };
  }
}
