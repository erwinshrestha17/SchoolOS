import type { AuthContext } from '../auth/auth.types';
import { LibraryController } from './library.controller';

const actor: AuthContext = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  email: 'librarian@school.test',
  roles: ['admin'],
  permissions: [],
  authMethod: 'PASSWORD',
};

function createController() {
  const libraryService = {
    listBooks: jest.fn(),
    listCopies: jest.fn(),
    listOverdue: jest.fn(),
    getBorrowedStudents: jest.fn(),
    listFines: jest.fn(),
    createFine: jest.fn(),
    updateFine: jest.fn(),
    getBookHistory: jest.fn(),
    getCopyHistory: jest.fn(),
    resolveQrBorrower: jest.fn(),
  };
  const libraryHardeningService = {
    createBook: jest.fn(),
    updateBook: jest.fn(),
    archiveBook: jest.fn(),
    createCopy: jest.fn(),
    updateCopy: jest.fn(),
    markCopyStatus: jest.fn(),
    archiveCopy: jest.fn(),
    listIssuesScoped: jest.fn(),
    issueCopy: jest.fn(),
    issueCopyByScanner: jest.fn(),
    returnCopy: jest.fn(),
    returnCopyByScanner: jest.fn(),
    resolveCopyByScanCode: jest.fn(),
    createReservation: jest.fn(),
    listReservations: jest.fn(),
    cancelReservation: jest.fn(),
    fulfillReservation: jest.fn(),
    sendOverdueRemindersIdempotent: jest.fn(),
    getIssuedBooksReport: jest.fn(),
    getOverdueBooksReport: jest.fn(),
    getLostDamagedReport: jest.fn(),
    getFineSummary: jest.fn(),
    getBorrowerHistory: jest.fn(),
    exportIssuedBooksCsv: jest.fn(),
    postFineToFeesIdempotent: jest.fn(),
    reconcileFinePayment: jest.fn(),
    getPopularBooksReport: jest.fn(),
    getLibrarySettings: jest.fn(),
    updateLibrarySettings: jest.fn(),
  };

  return {
    controller: new LibraryController(
      libraryService as never,
      libraryHardeningService as never,
    ),
    libraryService,
    libraryHardeningService,
  };
}

describe('LibraryController M8A contracts', () => {
  it('delegates book catalog list/create/update/archive with current actor', () => {
    const { controller, libraryService, libraryHardeningService } =
      createController();
    const createDto = {
      title: 'English Reader',
      author: 'SchoolOS Press',
      isbn: 'ISBN-001',
      subjectCategory: 'English',
      edition: '2nd',
      language: 'English',
    };
    const updateDto = { title: 'English Reader Updated' };
    const archiveDto = { reason: 'Outdated edition' };
    libraryService.listBooks.mockReturnValue({ items: [] });
    libraryHardeningService.createBook.mockReturnValue({ id: 'book-1' });
    libraryHardeningService.updateBook.mockReturnValue({ id: 'book-1' });
    libraryHardeningService.archiveBook.mockReturnValue({ id: 'book-1' });

    expect(controller.listBooks(actor, 'English', '1', '20')).toEqual({
      items: [],
    });
    expect(controller.createBook(createDto as never, actor)).toEqual({
      id: 'book-1',
    });
    expect(controller.updateBook('book-1', updateDto as never, actor)).toEqual({
      id: 'book-1',
    });
    expect(controller.archiveBook('book-1', archiveDto, actor)).toEqual({
      id: 'book-1',
    });
    expect(libraryService.listBooks).toHaveBeenCalledWith(actor, {
      query: 'English',
      page: '1',
      limit: '20',
    });
    expect(libraryHardeningService.createBook).toHaveBeenCalledWith(
      createDto,
      actor,
    );
    expect(libraryHardeningService.updateBook).toHaveBeenCalledWith(
      'book-1',
      updateDto,
      actor,
    );
    expect(libraryHardeningService.archiveBook).toHaveBeenCalledWith(
      'book-1',
      archiveDto,
      actor,
    );
  });

  it('delegates copy metadata, scanner lookup, lifecycle, and archive workflows', () => {
    const { controller, libraryService, libraryHardeningService } =
      createController();
    const createDto = {
      bookId: 'book-1',
      barcode: 'LIB-001',
      qrCode: 'QR-LIB-001',
      shelfLocation: 'A1',
      conditionNote: 'New',
    };
    const updateDto = { shelfLocation: 'B2', conditionNote: 'Good' };
    const statusDto = { status: 'DAMAGED', reason: 'Water damage' };
    libraryService.listCopies.mockReturnValue({ items: [] });
    libraryHardeningService.resolveCopyByScanCode.mockReturnValue({
      id: 'copy-1',
    });
    libraryHardeningService.createCopy.mockReturnValue({ id: 'copy-1' });
    libraryHardeningService.updateCopy.mockReturnValue({ id: 'copy-1' });
    libraryHardeningService.markCopyStatus.mockReturnValue({
      status: 'DAMAGED',
    });
    libraryHardeningService.archiveCopy.mockReturnValue({ status: 'ARCHIVED' });

    expect(
      controller.listCopies(actor, 'book-1', 'AVAILABLE', 'LIB', '1', '50'),
    ).toEqual({ items: [] });
    expect(controller.resolveScannedCopy(actor, 'QR-LIB-001')).toEqual({
      id: 'copy-1',
    });
    expect(controller.createCopy(createDto as never, actor)).toEqual({
      id: 'copy-1',
    });
    expect(controller.updateCopy('copy-1', updateDto as never, actor)).toEqual({
      id: 'copy-1',
    });
    expect(
      controller.markCopyStatus('copy-1', statusDto as never, actor),
    ).toEqual({ status: 'DAMAGED' });
    expect(
      controller.archiveCopy('copy-1', { reason: 'Disposed' }, actor),
    ).toEqual({ status: 'ARCHIVED' });

    expect(libraryHardeningService.resolveCopyByScanCode).toHaveBeenCalledWith(
      actor,
      'QR-LIB-001',
    );
    expect(libraryHardeningService.archiveCopy).toHaveBeenCalledWith(
      'copy-1',
      'Disposed',
      actor,
    );
  });

  it('delegates scoped issue and scanner-first issue/return workflows', () => {
    const { controller, libraryHardeningService } = createController();
    const issueDto = {
      copyId: 'copy-1',
      borrowerStudentId: 'student-1',
    };
    const scannerIssueDto = {
      code: 'QR-LIB-001',
      borrowerStudentId: 'student-1',
    };
    const returnDto = { returnCondition: 'Good', fineAmount: 10 };
    const scannerReturnDto = { code: 'QR-LIB-001', returnCondition: 'Good' };
    libraryHardeningService.listIssuesScoped.mockReturnValue({ items: [] });
    libraryHardeningService.issueCopy.mockReturnValue({ id: 'issue-1' });
    libraryHardeningService.issueCopyByScanner.mockReturnValue({
      id: 'issue-1',
    });
    libraryHardeningService.returnCopy.mockReturnValue({ status: 'RETURNED' });
    libraryHardeningService.returnCopyByScanner.mockReturnValue({
      status: 'RETURNED',
    });

    expect(
      controller.listIssues(actor, 'ISSUED', 'student-1', undefined, '1', '20'),
    ).toEqual({ items: [] });
    expect(controller.listMyIssues(actor, 'ISSUED', '1', '20')).toEqual({
      items: [],
    });
    expect(controller.issueCopy(issueDto as never, actor)).toEqual({
      id: 'issue-1',
    });
    expect(
      controller.issueCopyByScanner(scannerIssueDto as never, actor),
    ).toEqual({
      id: 'issue-1',
    });
    expect(controller.returnCopy('issue-1', returnDto as never, actor)).toEqual(
      {
        status: 'RETURNED',
      },
    );
    expect(
      controller.returnCopyByScanner(scannerReturnDto as never, actor),
    ).toEqual({ status: 'RETURNED' });

    expect(libraryHardeningService.listIssuesScoped).toHaveBeenCalledWith(
      actor,
      {
        status: 'ISSUED',
        studentId: 'student-1',
        staffId: undefined,
        page: '1',
        limit: '20',
      },
    );
    expect(libraryHardeningService.issueCopyByScanner).toHaveBeenCalledWith(
      scannerIssueDto,
      actor,
    );
  });

  it('delegates reservation queue workflows', () => {
    const { controller, libraryHardeningService } = createController();
    const reservationDto = {
      bookId: 'book-1',
      borrowerStudentId: 'student-1',
    };
    const fulfillDto = { copyId: 'copy-1' };
    libraryHardeningService.listReservations.mockReturnValue({ items: [] });
    libraryHardeningService.createReservation.mockReturnValue({
      id: 'reservation-1',
    });
    libraryHardeningService.cancelReservation.mockReturnValue({
      status: 'CANCELLED',
    });
    libraryHardeningService.fulfillReservation.mockReturnValue({
      id: 'issue-1',
    });

    expect(
      controller.listReservations(actor, 'ACTIVE', 'book-1', '1', '10'),
    ).toEqual({ items: [] });
    expect(
      controller.createReservation(actor, reservationDto as never),
    ).toEqual({
      id: 'reservation-1',
    });
    expect(controller.cancelReservation(actor, 'reservation-1')).toEqual({
      status: 'CANCELLED',
    });
    expect(
      controller.fulfillReservation(
        actor,
        'reservation-1',
        fulfillDto as never,
      ),
    ).toEqual({ id: 'issue-1' });

    expect(libraryHardeningService.listReservations).toHaveBeenCalledWith(
      actor,
      {
        status: 'ACTIVE',
        bookId: 'book-1',
        page: '1',
        limit: '10',
      },
    );
    expect(libraryHardeningService.fulfillReservation).toHaveBeenCalledWith(
      'reservation-1',
      fulfillDto,
      actor,
    );
  });

  it('delegates reporting and CSV export from hardening service', () => {
    const { controller, libraryHardeningService } = createController();
    libraryHardeningService.getIssuedBooksReport.mockReturnValue({ items: [] });
    libraryHardeningService.getOverdueBooksReport.mockReturnValue({
      items: [],
    });
    libraryHardeningService.getLostDamagedReport.mockReturnValue({ items: [] });
    libraryHardeningService.getFineSummary.mockReturnValue({
      summary: { totalFine: '0' },
    });
    libraryHardeningService.getBorrowerHistory.mockReturnValue({ items: [] });
    libraryHardeningService.exportIssuedBooksCsv.mockReturnValue(
      'Issue ID,Book Title\nissue-1,English Reader',
    );
    libraryHardeningService.getPopularBooksReport.mockReturnValue({
      items: [],
    });

    expect(controller.getIssuedBooksReport(actor, '1', '25')).toEqual({
      items: [],
    });
    expect(controller.getOverdueBooksReport(actor)).toEqual({ items: [] });
    expect(controller.getLostDamagedReport(actor)).toEqual({ items: [] });
    expect(controller.getFineSummary(actor)).toEqual({
      summary: { totalFine: '0' },
    });
    expect(
      controller.getBorrowerHistory(actor, 'student-1', undefined, '1', '25'),
    ).toEqual({ items: [] });
    expect(controller.exportIssuedBooksCsv(actor)).toBe(
      'Issue ID,Book Title\nissue-1,English Reader',
    );
    expect(controller.getPopularBooksReport(actor, '1', '10')).toEqual({
      items: [],
    });
  });

  it('delegates fine posting idempotency and payment reconciliation', () => {
    const { controller, libraryService, libraryHardeningService } =
      createController();
    libraryService.listFines.mockReturnValue({ items: [] });
    libraryService.createFine.mockReturnValue({ id: 'fine-1' });
    libraryService.updateFine.mockReturnValue({ id: 'fine-1' });
    libraryHardeningService.postFineToFeesIdempotent.mockReturnValue({
      feeInvoiceId: 'invoice-1',
      alreadyPosted: true,
    });
    libraryHardeningService.reconcileFinePayment.mockReturnValue({
      status: 'PAID',
      alreadyReconciled: false,
    });

    expect(controller.listFines(actor, '1', '10')).toEqual({ items: [] });
    expect(
      controller.createFine(actor, { issueId: 'issue-1', amount: 25 }),
    ).toEqual({ id: 'fine-1' });
    expect(
      controller.updateFine(actor, 'fine-1', { notes: 'Corrected' }),
    ).toEqual({
      id: 'fine-1',
    });
    expect(
      controller.postFineToFees(actor, 'fine-1', { reason: 'Approved' }),
    ).toEqual({ feeInvoiceId: 'invoice-1', alreadyPosted: true });
    expect(controller.reconcileFinePayment(actor, 'fine-1')).toEqual({
      status: 'PAID',
      alreadyReconciled: false,
    });

    expect(
      libraryHardeningService.postFineToFeesIdempotent,
    ).toHaveBeenCalledWith(actor, 'fine-1', 'Approved');
    expect(libraryHardeningService.reconcileFinePayment).toHaveBeenCalledWith(
      actor,
      'fine-1',
    );
  });

  it('delegates settings, borrower QR lookup, overdue reminder, and legacy history reads', () => {
    const { controller, libraryService, libraryHardeningService } =
      createController();
    libraryService.listOverdue.mockReturnValue({ items: [] });
    libraryService.getBorrowedStudents.mockReturnValue({ items: [] });
    libraryService.getBookHistory.mockReturnValue({ history: [] });
    libraryService.getCopyHistory.mockReturnValue({ history: [] });
    libraryService.resolveQrBorrower.mockReturnValue({ name: 'Student' });
    libraryHardeningService.sendOverdueRemindersIdempotent.mockReturnValue({
      skipped: false,
      deliveryCount: 1,
    });
    libraryHardeningService.getLibrarySettings.mockReturnValue({
      finePerDay: '10',
    });
    libraryHardeningService.updateLibrarySettings.mockReturnValue({
      finePerDay: '20',
    });

    expect(controller.listOverdue(actor, '1', '20')).toEqual({ items: [] });
    expect(controller.sendOverdueReminders(actor)).toEqual({
      skipped: false,
      deliveryCount: 1,
    });
    expect(controller.getBorrowedStudents(actor, '1', '10')).toEqual({
      items: [],
    });
    expect(controller.getBookHistory(actor, 'book-1')).toEqual({ history: [] });
    expect(controller.getCopyHistory(actor, 'copy-1')).toEqual({ history: [] });
    expect(controller.getSettings(actor)).toEqual({ finePerDay: '10' });
    expect(controller.updateSettings(actor, { finePerDay: 20 })).toEqual({
      finePerDay: '20',
    });
    expect(controller.resolveQrBorrower(actor, 'token')).toEqual({
      name: 'Student',
    });
  });
});
