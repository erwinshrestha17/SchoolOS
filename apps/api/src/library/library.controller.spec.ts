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
    createBook: jest.fn(),
    updateBook: jest.fn(),
    listCopies: jest.fn(),
    createCopy: jest.fn(),
    updateCopy: jest.fn(),
    markCopyStatus: jest.fn(),
    listIssues: jest.fn(),
    issueCopy: jest.fn(),
    returnCopy: jest.fn(),
    listOverdue: jest.fn(),
  };
  const libraryHardeningService = {
    archiveBook: jest.fn(),
    sendOverdueRemindersIdempotent: jest.fn(),
    getIssuedBooksReport: jest.fn(),
    getOverdueBooksReport: jest.fn(),
    getLostDamagedReport: jest.fn(),
    getFineSummary: jest.fn(),
    getBorrowerHistory: jest.fn(),
    exportIssuedBooksCsv: jest.fn(),
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
    };
    const updateDto = { title: 'English Reader Updated' };
    const archiveDto = { reason: 'Outdated edition' };
    libraryService.listBooks.mockReturnValue({ items: [] });
    libraryService.createBook.mockReturnValue({ id: 'book-1' });
    libraryService.updateBook.mockReturnValue({ id: 'book-1' });
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
    expect(libraryService.createBook).toHaveBeenCalledWith(createDto, actor);
    expect(libraryService.updateBook).toHaveBeenCalledWith(
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

  it('delegates copy list/create/update/status workflows with current actor', () => {
    const { controller, libraryService } = createController();
    const createDto = {
      bookId: 'book-1',
      barcode: 'LIB-001',
      shelfLocation: 'A1',
    };
    const updateDto = { shelfLocation: 'B2' };
    const statusDto = { status: 'DAMAGED', reason: 'Water damage' };
    libraryService.listCopies.mockReturnValue({ items: [] });
    libraryService.createCopy.mockReturnValue({ id: 'copy-1' });
    libraryService.updateCopy.mockReturnValue({ id: 'copy-1' });
    libraryService.markCopyStatus.mockReturnValue({ status: 'DAMAGED' });

    expect(
      controller.listCopies(actor, 'book-1', 'AVAILABLE', 'LIB', '1', '50'),
    ).toEqual({ items: [] });
    expect(controller.createCopy(createDto as never, actor)).toEqual({
      id: 'copy-1',
    });
    expect(controller.updateCopy('copy-1', updateDto as never, actor)).toEqual({
      id: 'copy-1',
    });
    expect(
      controller.markCopyStatus('copy-1', statusDto as never, actor),
    ).toEqual({
      status: 'DAMAGED',
    });
    expect(libraryService.listCopies).toHaveBeenCalledWith(actor, {
      bookId: 'book-1',
      status: 'AVAILABLE',
      barcode: 'LIB',
      page: '1',
      limit: '50',
    });
    expect(libraryService.createCopy).toHaveBeenCalledWith(createDto, actor);
    expect(libraryService.updateCopy).toHaveBeenCalledWith(
      'copy-1',
      updateDto,
      actor,
    );
    expect(libraryService.markCopyStatus).toHaveBeenCalledWith(
      'copy-1',
      statusDto,
      actor,
    );
  });

  it('delegates issue and return workflows through transactional service methods', () => {
    const { controller, libraryService } = createController();
    const issueDto = {
      copyId: 'copy-1',
      borrowerStudentId: 'student-1',
      dueAt: '2026-05-20T00:00:00.000Z',
    };
    const returnDto = {
      returnCondition: 'Good',
      fineAmount: 10,
      notes: 'Returned late',
    };
    libraryService.listIssues.mockReturnValue({ items: [] });
    libraryService.issueCopy.mockReturnValue({ id: 'issue-1' });
    libraryService.returnCopy.mockReturnValue({
      id: 'issue-1',
      status: 'RETURNED',
    });

    expect(
      controller.listIssues(actor, 'ISSUED', 'student-1', undefined, '1', '20'),
    ).toEqual({ items: [] });
    expect(controller.issueCopy(issueDto as never, actor)).toEqual({
      id: 'issue-1',
    });
    expect(controller.returnCopy('issue-1', returnDto as never, actor)).toEqual(
      {
        id: 'issue-1',
        status: 'RETURNED',
      },
    );
    expect(libraryService.listIssues).toHaveBeenCalledWith(actor, {
      status: 'ISSUED',
      studentId: 'student-1',
      staffId: undefined,
      page: '1',
      limit: '20',
    });
    expect(libraryService.issueCopy).toHaveBeenCalledWith(issueDto, actor);
    expect(libraryService.returnCopy).toHaveBeenCalledWith(
      'issue-1',
      returnDto,
      actor,
    );
  });

  it('delegates overdue reminder through idempotent hardening service', () => {
    const { controller, libraryService, libraryHardeningService } =
      createController();
    libraryService.listOverdue.mockReturnValue([{ id: 'issue-1' }]);
    libraryHardeningService.sendOverdueRemindersIdempotent.mockReturnValue({
      skipped: false,
      deliveryCount: 1,
    });

    expect(controller.listOverdue(actor, '1', '20')).toEqual([
      { id: 'issue-1' },
    ]);
    expect(controller.sendOverdueReminders(actor)).toEqual({
      skipped: false,
      deliveryCount: 1,
    });
    expect(libraryService.listOverdue).toHaveBeenCalledWith(actor, {
      page: '1',
      limit: '20',
    });
    expect(
      libraryHardeningService.sendOverdueRemindersIdempotent,
    ).toHaveBeenCalledWith(actor);
  });

  it('delegates library reports and CSV export from backend service', () => {
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
    expect(libraryHardeningService.getIssuedBooksReport).toHaveBeenCalledWith(
      actor,
      { page: '1', limit: '25' },
    );
    expect(libraryHardeningService.getBorrowerHistory).toHaveBeenCalledWith(
      actor,
      { studentId: 'student-1', staffId: undefined, page: '1', limit: '25' },
    );
    expect(libraryHardeningService.exportIssuedBooksCsv).toHaveBeenCalledWith(
      actor,
    );
  });
});
