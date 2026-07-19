import { SchoolSettingsProfileService } from './school-settings-profile.service';

describe('SchoolSettingsProfileService', () => {
  const tenantId = 'tenant-a';
  const userId = 'user-a';

  function buildService() {
    const prisma = {
      tenantSetting: {
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
      $transaction: jest.fn(async (operations: Promise<unknown>[]) =>
        Promise.all(operations),
      ),
    };
    const auditService = { record: jest.fn() };
    return {
      service: new SchoolSettingsProfileService(
        prisma as never,
        auditService as never,
      ),
      prisma,
      auditService,
    };
  }

  it('returns only profile fields persisted for the requested tenant', async () => {
    const { service, prisma } = buildService();
    prisma.tenantSetting.findMany.mockResolvedValue([
      {
        key: 'school_name',
        value: 'Green Valley School',
        updatedAt: new Date('2026-06-20T00:00:00.000Z'),
      },
      {
        key: 'school_email',
        value: 'office@greenvalley.edu.np',
        updatedAt: new Date('2026-06-19T00:00:00.000Z'),
      },
    ]);

    const profile = await service.getProfile(tenantId);

    expect(prisma.tenantSetting.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId }),
      }),
    );
    expect(profile).toMatchObject({
      schoolName: 'Green Valley School',
      schoolEmail: 'office@greenvalley.edu.np',
      schoolPanNumber: null,
      affiliationBoard: null,
      affiliationNumber: null,
    });
  });

  it('returns saved affiliation board and number', async () => {
    const { service, prisma } = buildService();
    prisma.tenantSetting.findMany.mockResolvedValue([
      {
        key: 'affiliation_board',
        value: 'NEB',
        updatedAt: new Date('2026-06-20T00:00:00.000Z'),
      },
      {
        key: 'affiliation_number',
        value: 'AFF-2083-0142',
        updatedAt: new Date('2026-06-20T00:00:00.000Z'),
      },
    ]);

    const profile = await service.getProfile(tenantId);

    expect(profile.affiliationBoard).toBe('NEB');
    expect(profile.affiliationNumber).toBe('AFF-2083-0142');
  });

  it('updates profile fields atomically and audits only changed keys', async () => {
    const { service, prisma, auditService } = buildService();
    prisma.tenantSetting.upsert.mockResolvedValue({});
    prisma.tenantSetting.findMany.mockResolvedValue([
      {
        key: 'school_name',
        value: 'Green Valley School',
        updatedAt: new Date('2026-06-20T00:00:00.000Z'),
      },
      {
        key: 'principal_name',
        value: 'Asha Shrestha',
        updatedAt: new Date('2026-06-20T00:00:00.000Z'),
      },
    ]);

    await service.updateProfile(
      tenantId,
      {
        schoolName: 'Green Valley School',
        principalName: 'Asha Shrestha',
      },
      userId,
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.tenantSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_key: { tenantId, key: 'school_name' } },
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        userId,
        action: 'school_profile_updated',
        after: { changedKeys: ['school_name', 'principal_name'] },
      }),
    );
  });

  it('normalizes Nepal contact values before saving school settings', async () => {
    const { service, prisma } = buildService();
    prisma.tenantSetting.upsert.mockResolvedValue({});
    prisma.tenantSetting.findMany.mockResolvedValue([]);

    await service.updateProfile(
      tenantId,
      {
        principalName: '  आशा   श्रेष्ठ ',
        schoolPhone: '९८५१२३४५६७',
        schoolEmail: ' INFO+OFFICE@SCHOOL.EDU.NP ',
      },
      userId,
    );

    expect(prisma.tenantSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          key: 'school_phone',
          value: '+9779851234567',
        }),
      }),
    );
    expect(prisma.tenantSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          key: 'school_email',
          value: 'info+office@school.edu.np',
        }),
      }),
    );
  });
});
