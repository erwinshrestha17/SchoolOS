import { readFileSync } from 'fs';
import { join, resolve } from 'path';

const academicsRoot = resolve(__dirname);
const apiSourceRoot = resolve(academicsRoot, '..');

function readAcademicsFile(fileName: string) {
  return readFileSync(join(academicsRoot, fileName), 'utf8');
}

function readDtoFile(fileName: string) {
  return readFileSync(join(academicsRoot, 'dto', fileName), 'utf8');
}

describe('Phase 2A backend flow contracts', () => {
  it('keeps the Phase 2A controller route surface wired end-to-end', () => {
    const controller = readAcademicsFile('academics.controller.ts');

    expect(controller).toContain("@Get('exam-terms')");
    expect(controller).toContain("@Post('exam-terms')");
    expect(controller).toContain("@Get('assessment-components')");
    expect(controller).toContain("@Post('assessment-components')");
    expect(controller).toContain("@Get('marks')");
    expect(controller).toContain("@Post('marks/bulk-upsert')");
    expect(controller).toContain("@Get('cas-records')");
    expect(controller).toContain("@Post('cas-records/bulk-upsert')");
    expect(controller).toContain("@Get('results/preview/student/:studentId')");
    expect(controller).toContain("@Get('results/preview')");
    expect(controller).toContain("@Post('marks/lock-requests')");
    expect(controller).toContain("@Patch('marks/lock-requests/:id/review')");
    expect(controller).toContain("@Post('report-cards')");
    expect(controller).toContain("@Post('report-cards/batch')");
    expect(controller).toContain("@Get('promotions')");
    expect(controller).toContain("@Post('promotions')");
    expect(controller).toContain("@Post('results/publishing/publish')");
    expect(controller).toContain("@Post('results/publishing/unpublish')");
    expect(controller).toContain("@Post('results/publishing/notify')");
  });

  it('registers all Phase 2A hardened service boundaries in the academics module', () => {
    const moduleSource = readAcademicsFile('academics.module.ts');

    expect(moduleSource).toContain('AcademicsFoundationService');
    expect(moduleSource).toContain('AssessmentComponentsService');
    expect(moduleSource).toContain('CasRecordsService');
    expect(moduleSource).toContain('MarksService');
    expect(moduleSource).toContain('ResultsService');
    expect(moduleSource).toContain('MarkLockWorkflowService');
    expect(moduleSource).toContain('ReportCardsService');
    expect(moduleSource).toContain('PromotionReadinessService');
    expect(moduleSource).toContain('ResultPublishingService');
  });

  it('enforces the lock-before-report-card boundary', () => {
    const markLockService = readAcademicsFile('mark-lock-workflow.service.ts');
    const reportCardsService = readAcademicsFile('report-cards.service.ts');

    expect(markLockService).toContain('ACADEMICS_MARK_LOCK_APPROVED');
    expect(markLockService).toContain('data: { isLocked: true }');
    expect(markLockService).toContain(
      'Cannot lock marks before assessment components are configured',
    );
    expect(reportCardsService).toContain(
      'Report card generation requires locked marks for this exam term',
    );
    expect(reportCardsService).toContain(
      'Report card generation requires all available marks to be locked',
    );
    expect(reportCardsService).toContain(
      'Locked report cards cannot be regenerated without a correction workflow',
    );
  });

  it('prevents incomplete or withheld calculations from becoming report cards', () => {
    const reportCardsService = readAcademicsFile('report-cards.service.ts');

    expect(reportCardsService).toContain(
      "overall.resultStatus === 'INCOMPLETE'",
    );
    expect(reportCardsService).toContain("overall.resultStatus === 'WITHHELD'");
    expect(reportCardsService).toContain('totalObtained');
    expect(reportCardsService).toContain('totalFullMarks');
    expect(reportCardsService).toContain('ACADEMICS_REPORT_CARD_GENERATED');
  });

  it('makes promotion readiness depend on locked report cards instead of raw marks', () => {
    const promotionService = readAcademicsFile(
      'promotion-readiness.service.ts',
    );

    expect(promotionService).toContain('MISSING_REPORT_CARD');
    expect(promotionService).toContain('REPORT_CARD_NOT_LOCKED');
    expect(promotionService).toContain('FAILED_SUBJECTS');
    expect(promotionService).toContain('ACADEMICS_PROMOTION_BLOCKED');
    expect(promotionService).toContain('ACADEMICS_STUDENT_PROMOTED');
    expect(promotionService).toContain('reportCard.findFirst');
    expect(promotionService).not.toContain('markEntry.findMany');
  });

  it('enforces report-card publish before parent notification', () => {
    const publishingService = readAcademicsFile('result-publishing.service.ts');

    expect(publishingService).toContain(
      'Duplicate reportCardIds are not allowed',
    );
    expect(publishingService).toContain('Report card is not locked');
    expect(publishingService).toContain('block_publishing_on_dues');
    expect(publishingService).toContain("card.publishStatus !== 'PUBLISHED'");
    expect(publishingService).toContain('recordDeliveryRecords');
    expect(publishingService).toContain('ConsentType.MESSAGING');
    expect(publishingService).toContain('ACADEMICS_RESULTS_PUBLISHED');
    expect(publishingService).toContain('ACADEMICS_RESULTS_UNPUBLISHED');
    expect(publishingService).toContain('ACADEMICS_RESULTS_NOTIFIED');
  });

  it('keeps Phase 2A DTOs validation-backed for critical write workflows', () => {
    const criticalDtoFiles = [
      'bulk-upsert-marks.dto.ts',
      'bulk-upsert-cas-records.dto.ts',
      'request-mark-lock.dto.ts',
      'review-mark-lock.dto.ts',
      'generate-report-card.dto.ts',
      'batch-generate-report-cards.dto.ts',
      'promote-student.dto.ts',
      'batch-promote.dto.ts',
      'publish-results.dto.ts',
      'unpublish-results.dto.ts',
      'notify-results.dto.ts',
    ];

    for (const fileName of criticalDtoFiles) {
      const source = readDtoFile(fileName);
      expect(source).toMatch(/class-validator|@Is[A-Z]/);
    }
  });

  it('keeps Phase 2A service tests present for the hardened backend chain', () => {
    const expectedSpecs = [
      'marks.service.spec.ts',
      'cas-records.service.spec.ts',
      'results.service.spec.ts',
      'mark-lock-workflow.service.spec.ts',
      'report-cards.service.spec.ts',
      'promotion-readiness.service.spec.ts',
      'result-publishing.service.spec.ts',
    ];

    for (const fileName of expectedSpecs) {
      expect(() => readAcademicsFile(fileName)).not.toThrow();
    }
  });

  it('keeps Phase 2A services inside the Nest modular monolith boundary', () => {
    const forbiddenPatterns = [/axios\./, /fetch\(/, /http:\/\//, /https:\/\//];
    const files = [
      'marks.service.ts',
      'cas-records.service.ts',
      'results.service.ts',
      'mark-lock-workflow.service.ts',
      'report-cards.service.ts',
      'promotion-readiness.service.ts',
      'result-publishing.service.ts',
    ];

    for (const fileName of files) {
      const relativePath = join('academics', fileName);
      const source = readFileSync(join(apiSourceRoot, relativePath), 'utf8');
      for (const pattern of forbiddenPatterns) {
        expect(source).not.toMatch(pattern);
      }
    }
  });
});
