import { SchoolSettingsIntegrationsService } from './school-settings-integrations.service';

const envKeys = [
  'SCHOOLOS_PARENT_PAYMENT_SANDBOX',
  'SCHOOLOS_NOTIFICATION_PROVIDER_MODE',
  'SMS_PROVIDER_MODE',
  'EMAIL_PROVIDER_MODE',
  'PUSH_PROVIDER_MODE',
  'EMAIL_DELIVERY_MODE',
  'NOTIFICATIONS_DISABLED',
  'SMS_PROVIDER_ENABLED',
  'EMAIL_PROVIDER_ENABLED',
  'PUSH_PROVIDER_ENABLED',
];

function buildService() {
  const prisma = {
    providerConfig: {
      findFirst: jest.fn(),
    },
    attendanceSyncSubmission: {
      count: jest.fn(),
      findFirst: jest.fn(),
    },
  };
  return {
    service: new SchoolSettingsIntegrationsService(prisma as never),
    prisma,
  };
}

function clearIntegrationEnv() {
  for (const key of envKeys) {
    delete process.env[key];
  }
}

describe('SchoolSettingsIntegrationsService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    clearIntegrationEnv();
    jest.resetAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses the authenticated tenant for attendance sync status', async () => {
    const { service, prisma } = buildService();
    prisma.providerConfig.findFirst.mockResolvedValue(null);
    prisma.attendanceSyncSubmission.count.mockResolvedValue(1);
    prisma.attendanceSyncSubmission.findFirst.mockResolvedValue({
      serverReceivedAt: new Date('2026-06-26T01:02:03.000Z'),
    });

    const result = await service.getIntegrationsStatus('tenant-a');

    expect(prisma.attendanceSyncSubmission.count).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-a',
        deviceId: { not: null },
      },
    });
    expect(prisma.attendanceSyncSubmission.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-a',
          deviceId: { not: null },
        },
      }),
    );
    expect(
      result.items.find((item) => item.id === 'attendance-devices')?.status,
    ).toBe('configured');
  });

  it('suppresses provider ids, names, endpoints, tokens, and raw config keys', async () => {
    process.env.SCHOOLOS_NOTIFICATION_PROVIDER_MODE = 'configured-provider';
    const { service, prisma } = buildService();
    const provider = (type: string) => ({
      id: `${type.toLowerCase()}-provider-secret-id`,
      type,
      name: `${type} Secret Provider`,
      enabled: true,
      environment: 'TEST',
      validationStatus: 'VALID',
      lastValidatedAt: new Date('2026-06-25T00:00:00.000Z'),
      updatedAt: new Date('2026-06-25T00:00:00.000Z'),
      secretKeys: ['apiToken', 'secretKey'],
      configEncrypted:
        type === 'PAYMENT_GATEWAY'
          ? {
              merchantId: 'merchant-secret-id',
              adapter: 'generic_json_v1',
              intentUrl: 'https://gateway.example.test/intent',
              webhookUrl: 'https://gateway.example.test/callback',
              settlementStatusUrl: 'https://gateway.example.test/settlement',
              apiToken: 'encrypted-api-token',
              secretKey: 'encrypted-secret-key',
            }
          : type === 'FCM'
            ? {
                projectId: 'fcm-project-secret',
                apiToken: 'encrypted-api-token',
              }
            : {
                apiToken: 'encrypted-api-token',
                senderId: 'sender-secret-id',
                fromEmail: 'sender@example.test',
              },
    });

    prisma.providerConfig.findFirst.mockImplementation(
      async ({ where }: { where?: Record<string, unknown> }) => {
        if (where?.type === 'PAYMENT_GATEWAY')
          return provider('PAYMENT_GATEWAY');
        if (where?.type === 'SMS') return provider('SMS');
        if (where?.type === 'EMAIL') return provider('EMAIL');
        if (where?.type === 'FCM') return provider('FCM');
        return null;
      },
    );
    prisma.attendanceSyncSubmission.count.mockResolvedValue(0);
    prisma.attendanceSyncSubmission.findFirst.mockResolvedValue(null);

    const result = await service.getIntegrationsStatus('tenant-a');
    const serialized = JSON.stringify(result);

    for (const unsafe of [
      'provider-secret-id',
      'Secret Provider',
      'merchant-secret-id',
      'gateway.example.test',
      'apiToken',
      'secretKey',
      'sender-secret-id',
      'sender@example.test',
      'fcm-project-secret',
    ]) {
      expect(serialized).not.toContain(unsafe);
    }
    expect(
      result.items.find((item) => item.id === 'payment-gateway')?.status,
    ).toBe('configured');
    expect(
      result.items.find((item) => item.id === 'notification-providers')?.status,
    ).toBe('configured');
  });
});
