import { SchoolSettingsProfileService } from './school-settings-profile.service';

describe('SchoolSettingsProfileService', () => {
  const tenantId = 'tenant-a';
  const userId = 'user-a';

  function buildService() {
    const tenantSetting = {
      findMany: jest.fn(),
      upsert: jest.fn(),
    };
    const tx = {
      tenantSetting,
      nepalLocalLevel: { findUnique: jest.fn() },
    };
    const prisma = {
      tenantSetting,
      $transaction: jest.fn(
        async (work: (client: typeof tx) => Promise<unknown>) => work(tx),
      ),
    };
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const addressService = {
      getActiveAddress: jest.fn().mockResolvedValue(null),
      upsertAddress: jest.fn().mockResolvedValue({}),
    };
    return {
      service: new SchoolSettingsProfileService(
        prisma as never,
        auditService as never,
        addressService as never,
      ),
      prisma,
      tx,
      auditService,
      addressService,
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

  it('projects a normalized registered-office address without losing the legacy line', async () => {
    const { service, prisma, addressService } = buildService();
    prisma.tenantSetting.findMany.mockResolvedValue([
      {
        key: 'school_address',
        value: 'Bakhundole, Lalitpur, Nepal',
        updatedAt: new Date('2026-06-20T00:00:00.000Z'),
      },
    ]);
    addressService.getActiveAddress.mockResolvedValue({
      localLevelId: 501,
      wardNumber: '4',
      tole: 'Bakhundole',
      streetAddress: 'Main Road',
      landmark: 'Near the ward office',
      updatedAt: new Date('2026-06-21T00:00:00.000Z'),
      localLevel: {
        nameEn: 'Lalitpur Metropolitan City',
        district: {
          nameEn: 'Lalitpur',
          province: { nameEn: 'Bagmati' },
        },
      },
    });

    const profile = await service.getProfile(tenantId);

    expect(profile).toMatchObject({
      schoolAddress: 'Bakhundole, Lalitpur, Nepal',
      localLevelId: 501,
      municipality: 'Lalitpur Metropolitan City',
      district: 'Lalitpur',
      province: 'Bagmati',
      wardNumber: 4,
      tole: 'Bakhundole',
      streetAddress: 'Main Road',
      landmark: 'Near the ward office',
      updatedAt: '2026-06-21T00:00:00.000Z',
    });
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

  it('persists a selected local level and derives its hierarchy server-side', async () => {
    const { service, prisma, tx, auditService, addressService } =
      buildService();
    prisma.tenantSetting.findMany.mockResolvedValue([]);
    tx.nepalLocalLevel.findUnique.mockResolvedValue({
      id: 501,
      nameEn: 'Lalitpur Metropolitan City',
      district: {
        nameEn: 'Lalitpur',
        province: { nameEn: 'Bagmati' },
      },
    });

    await service.updateProfile(
      tenantId,
      {
        schoolAddress: 'Bakhundole, Lalitpur, Nepal',
        localLevelId: 501,
        wardNumber: 4,
        tole: 'Bakhundole',
        streetAddress: 'Main Road',
      },
      userId,
    );

    expect(addressService.upsertAddress).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        tenantId,
        ownerId: tenantId,
        legacyText: 'Bakhundole, Lalitpur, Nepal',
        input: expect.objectContaining({
          localLevelId: 501,
          wardNumber: '4',
          tole: 'Bakhundole',
          streetAddress: 'Main Road',
        }),
      }),
    );
    expect(prisma.tenantSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          key: 'municipality',
          value: 'Lalitpur Metropolitan City',
        }),
      }),
    );
    expect(prisma.tenantSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          key: 'district',
          value: 'Lalitpur',
        }),
      }),
    );
    expect(prisma.tenantSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          key: 'province',
          value: 'Bagmati',
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        after: expect.objectContaining({
          changedKeys: expect.arrayContaining([
            'municipality',
            'district',
            'province',
            'registered_office_address',
          ]),
        }),
      }),
    );
  });

  it('rejects an unknown local level before changing profile settings', async () => {
    const { service, prisma, tx, auditService, addressService } =
      buildService();
    tx.nepalLocalLevel.findUnique.mockResolvedValue(null);

    await expect(
      service.updateProfile(tenantId, { localLevelId: 999999 }, userId),
    ).rejects.toThrow('Select a valid Nepal local level');

    expect(prisma.tenantSetting.upsert).not.toHaveBeenCalled();
    expect(addressService.upsertAddress).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
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

  it('accepts a Nepal landline for the school contact phone', async () => {
    const { service, prisma } = buildService();
    prisma.tenantSetting.upsert.mockResolvedValue({});
    prisma.tenantSetting.findMany.mockResolvedValue([]);

    await service.updateProfile(
      tenantId,
      { schoolPhone: '+977-1-5555555' },
      userId,
    );

    expect(prisma.tenantSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          key: 'school_phone',
          value: '+97715555555',
        }),
      }),
    );
  });
});
