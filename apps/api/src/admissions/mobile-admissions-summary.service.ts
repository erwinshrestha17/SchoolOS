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

    return {
      metrics: {
        waitingForReview: waitingReview.total,
        approvedReadyToAdmit: approved.total,
        documentsPending: documentsPending.total,
        duplicateWarnings: duplicateWarnings.total,
        iemisFollowUp,
      },
      actions: [
        {
          label: 'Admissions needing review',
          count: waitingReview.total,
          route: '/principal/admissions/review',
        },
        {
          label: 'Approved cases ready to admit',
          count: approved.total,
          route: '/principal/admissions/approved',
        },
        {
          label: 'Missing documents',
          count: documentsPending.total,
          route: '/principal/admissions/documents',
        },
        {
          label: 'Duplicate warnings',
          count: duplicateWarnings.total,
          route: '/principal/admissions/duplicates',
        },
      ],
      lastUpdated: new Date().toISOString(),
    };
  }
}
