import { Injectable } from '@nestjs/common';
import type { AdmissionDocumentReminderBatchResult } from '@schoolos/core';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { CommunicationsService } from '../communications/communications.service';
import { AdmissionCasesService } from './admission-cases.service';
import type { RequestAdmissionDocumentRemindersDto } from './dto/admission-case.dto';

@Injectable()
export class AdmissionDocumentReminderService {
  constructor(
    private readonly admissionCasesService: AdmissionCasesService,
    private readonly communicationsService: CommunicationsService,
    private readonly auditService: AuditService,
  ) {}

  async requestReminders(
    dto: RequestAdmissionDocumentRemindersDto,
    actor: AuthContext,
  ): Promise<AdmissionDocumentReminderBatchResult> {
    const candidates =
      await this.admissionCasesService.resolveDocumentReminderCandidates(
        dto.admissionCaseIds,
        actor,
      );
    const results: AdmissionDocumentReminderBatchResult['results'] = [];

    for (const candidate of candidates) {
      if (candidate.state === 'SKIPPED') {
        results.push({
          admissionCaseId: candidate.admissionCaseId,
          state: 'SKIPPED',
          reason: candidate.reason,
        });
        continue;
      }

      try {
        const delivery =
          await this.communicationsService.recordAdmissionDocumentReminder({
            actor,
            admissionCaseId: candidate.admissionCaseId,
            applicantName: candidate.applicantName,
            guardianPhone: candidate.guardianPhone,
            sourceUpdatedAt: candidate.sourceUpdatedAt,
            missingDocumentLabels: candidate.missingDocumentLabels,
          });
        results.push({
          admissionCaseId: candidate.admissionCaseId,
          state: delivery.state,
          reason: delivery.reason,
        });
      } catch {
        results.push({
          admissionCaseId: candidate.admissionCaseId,
          state: 'SKIPPED',
          reason: 'DELIVERY_UNAVAILABLE',
        });
      }
    }

    const response: AdmissionDocumentReminderBatchResult = {
      requested: dto.admissionCaseIds.length,
      queued: results.filter((result) => result.state === 'QUEUED').length,
      alreadyQueued: results.filter(
        (result) => result.state === 'ALREADY_QUEUED',
      ).length,
      skipped: results.filter((result) => result.state === 'SKIPPED').length,
      results,
    };

    await this.auditService.record({
      action: 'request_document_reminders',
      resource: 'admission_case',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: {
        requested: response.requested,
        queued: response.queued,
        alreadyQueued: response.alreadyQueued,
        skipped: response.skipped,
        admissionCaseIds: dto.admissionCaseIds,
      },
    });

    return response;
  }
}
