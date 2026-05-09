import type { AuthContext } from '../auth/auth.types';
import { M10HardeningController } from './m10-hardening.controller';

const actor: AuthContext = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  email: 'admin@school.test',
  roles: ['admin'],
  permissions: [],
  authMethod: 'PASSWORD',
};

function createController() {
  const m10HardeningService = {
    listNoticesWithReadStatus: jest.fn(),
    getNoticeDetailWithReadStatus: jest.fn(),
    markNoticeRead: jest.fn(),
    resendNoticeFailed: jest.fn(),
    retryDeliveryWithMetadata: jest.fn(),
    createConsentTemplate: jest.fn(),
    listConsentTemplates: jest.fn(),
    updateConsentTemplate: jest.fn(),
    publishConsentTemplate: jest.fn(),
    archiveConsentTemplate: jest.fn(),
    getCommunicationPreference: jest.fn(),
    marketingOptOut: jest.fn(),
    marketingOptIn: jest.fn(),
  };

  return {
    controller: new M10HardeningController(m10HardeningService as never),
    m10HardeningService,
  };
}

describe('M10HardeningController contracts', () => {
  it('delegates notice list/detail/read with read-state service boundary', () => {
    const { controller, m10HardeningService } = createController();
    m10HardeningService.listNoticesWithReadStatus.mockReturnValue([{ id: 'notice-1', isRead: false }]);
    m10HardeningService.getNoticeDetailWithReadStatus.mockReturnValue({ id: 'notice-1', isRead: false });
    m10HardeningService.markNoticeRead.mockReturnValue({ success: true });

    expect(controller.listCommunicationNotices(actor)).toEqual([{ id: 'notice-1', isRead: false }]);
    expect(controller.getCommunicationNotice('notice-1', actor)).toEqual({ id: 'notice-1', isRead: false });
    expect(controller.markNoticeRead('notice-1', actor)).toEqual({ success: true });
    expect(m10HardeningService.listNoticesWithReadStatus).toHaveBeenCalledWith(actor);
    expect(m10HardeningService.getNoticeDetailWithReadStatus).toHaveBeenCalledWith('notice-1', actor);
    expect(m10HardeningService.markNoticeRead).toHaveBeenCalledWith('notice-1', actor);
  });

  it('delegates delivery retry and notice resend-failed with idempotency metadata', () => {
    const { controller, m10HardeningService } = createController();
    const retryDto = { reason: 'Provider timeout' };
    const resendDto = { guardianIds: ['guardian-1'], reason: 'Manual resend' };
    m10HardeningService.retryDeliveryWithMetadata.mockReturnValue({ status: 'SENT' });
    m10HardeningService.resendNoticeFailed.mockReturnValue({ retried: 1 });

    expect(controller.retryDelivery('delivery-1', retryDto, actor)).toEqual({ status: 'SENT' });
    expect(controller.resendFailedNoticeDeliveries('notice-1', resendDto, actor)).toEqual({ retried: 1 });
    expect(m10HardeningService.retryDeliveryWithMetadata).toHaveBeenCalledWith('delivery-1', retryDto, actor);
    expect(m10HardeningService.resendNoticeFailed).toHaveBeenCalledWith('notice-1', resendDto, actor);
  });

  it('delegates consent template lifecycle with versioned template service', () => {
    const { controller, m10HardeningService } = createController();
    const createDto = {
      key: 'photo-consent',
      consentType: 'PHOTO_USAGE',
      version: 'v1',
      title: 'Photo Consent',
      body: 'Allow photo usage',
    };
    const updateDto = { title: 'Updated Photo Consent' };
    m10HardeningService.createConsentTemplate.mockReturnValue({ id: 'template-1' });
    m10HardeningService.listConsentTemplates.mockReturnValue([{ id: 'template-1' }]);
    m10HardeningService.updateConsentTemplate.mockReturnValue({ id: 'template-1' });
    m10HardeningService.publishConsentTemplate.mockReturnValue({ status: 'PUBLISHED' });
    m10HardeningService.archiveConsentTemplate.mockReturnValue({ status: 'ARCHIVED' });

    expect(controller.createConsentTemplate(createDto, actor)).toEqual({ id: 'template-1' });
    expect(controller.listConsentTemplates(actor)).toEqual([{ id: 'template-1' }]);
    expect(controller.listActiveConsentTemplates(actor)).toEqual([{ id: 'template-1' }]);
    expect(controller.updateConsentTemplate('template-1', updateDto, actor)).toEqual({ id: 'template-1' });
    expect(controller.publishConsentTemplate('template-1', actor)).toEqual({ status: 'PUBLISHED' });
    expect(controller.archiveConsentTemplate('template-1', actor)).toEqual({ status: 'ARCHIVED' });
    expect(m10HardeningService.createConsentTemplate).toHaveBeenCalledWith(createDto, actor);
    expect(m10HardeningService.listConsentTemplates).toHaveBeenNthCalledWith(1, actor, false);
    expect(m10HardeningService.listConsentTemplates).toHaveBeenNthCalledWith(2, actor, true);
    expect(m10HardeningService.updateConsentTemplate).toHaveBeenCalledWith('template-1', updateDto, actor);
  });

  it('delegates marketing opt-out and opt-in preferences', () => {
    const { controller, m10HardeningService } = createController();
    const dto = { reason: 'Parent request', source: 'portal' };
    m10HardeningService.getCommunicationPreference.mockReturnValue({ preference: null });
    m10HardeningService.marketingOptOut.mockReturnValue({ id: 'pref-1' });
    m10HardeningService.marketingOptIn.mockReturnValue({ id: 'pref-1' });

    expect(controller.getCommunicationPreference(actor)).toEqual({ preference: null });
    expect(controller.marketingOptOut(dto, actor)).toEqual({ id: 'pref-1' });
    expect(controller.marketingOptIn(dto, actor)).toEqual({ id: 'pref-1' });
    expect(controller.updateCommunicationPreference({ reason: 'opt_in' }, actor)).toEqual({ id: 'pref-1' });
    expect(m10HardeningService.getCommunicationPreference).toHaveBeenCalledWith(actor);
    expect(m10HardeningService.marketingOptOut).toHaveBeenCalledWith(dto, actor);
    expect(m10HardeningService.marketingOptIn).toHaveBeenCalledWith(dto, actor);
  });
});
