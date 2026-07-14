import { FileStatus } from '@prisma/client';
import sharp from 'sharp';
import { loadSchoolLogoForPdf } from './school-logo-loader';

const actor = {
  tenantId: 'tenant-1',
  userId: 'user-1',
};
const logoFileAssetId = '11111111-1111-1111-1111-111111111111';

describe('loadSchoolLogoForPdf', () => {
  it('loads a configured tenant logo only through protected File Registry access', async () => {
    const logo = await createTestJpeg();
    const prisma = {
      tenantSetting: {
        findUnique: jest.fn().mockResolvedValue({ value: logoFileAssetId }),
      },
    };
    const fileRegistryService = {
      getFileMetadata: jest.fn().mockResolvedValue(buildLogoAsset()),
      getProtectedDownload: jest.fn().mockResolvedValue({ content: logo }),
    };

    await expect(
      loadSchoolLogoForPdf(
        prisma as never,
        fileRegistryService as never,
        actor,
      ),
    ).resolves.toEqual({
      buffer: logo,
      width: 96,
      height: 48,
      format: 'jpeg',
    });
    expect(prisma.tenantSetting.findUnique).toHaveBeenCalledWith({
      where: {
        tenantId_key: {
          tenantId: actor.tenantId,
          key: 'school_logo',
        },
      },
    });
    expect(fileRegistryService.getFileMetadata).toHaveBeenCalledWith(
      actor.tenantId,
      logoFileAssetId,
    );
    expect(fileRegistryService.getProtectedDownload).toHaveBeenCalledWith(
      actor.tenantId,
      logoFileAssetId,
      actor.userId,
    );
  });

  it.each([
    ['missing setting', null, null],
    ['unavailable file', { value: logoFileAssetId }, new Error('archived')],
    ['invalid image', { value: logoFileAssetId }, Buffer.from('not-jpeg')],
  ])('fails safe for a %s', async (_label, setting, downloadResult) => {
    const prisma = {
      tenantSetting: {
        findUnique: jest.fn().mockResolvedValue(setting),
      },
    };
    const fileRegistryService = {
      getFileMetadata: jest.fn().mockResolvedValue(buildLogoAsset()),
      getProtectedDownload: jest.fn().mockImplementation(() => {
        if (downloadResult instanceof Error) {
          throw downloadResult;
        }
        return { content: downloadResult };
      }),
    };

    await expect(
      loadSchoolLogoForPdf(
        prisma as never,
        fileRegistryService as never,
        actor,
      ),
    ).resolves.toBeNull();
  });

  it('rejects a valid image that is not a tenant branding asset', async () => {
    const prisma = {
      tenantSetting: {
        findUnique: jest.fn().mockResolvedValue({ value: logoFileAssetId }),
      },
    };
    const fileRegistryService = {
      getFileMetadata: jest.fn().mockResolvedValue({
        ...buildLogoAsset(),
        module: 'students',
        entityId: 'student-1',
        metadata: { kind: 'STUDENT_PHOTO' },
      }),
      getProtectedDownload: jest.fn(),
    };

    await expect(
      loadSchoolLogoForPdf(
        prisma as never,
        fileRegistryService as never,
        actor,
      ),
    ).resolves.toBeNull();
    expect(fileRegistryService.getProtectedDownload).not.toHaveBeenCalled();
  });
});

function buildLogoAsset() {
  return {
    id: logoFileAssetId,
    tenantId: actor.tenantId,
    module: 'settings',
    entityId: actor.tenantId,
    status: FileStatus.UPLOADED,
    originalFilename: 'school-logo.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: BigInt(512),
    metadata: { kind: 'SCHOOL_LOGO' },
  };
}

function createTestJpeg() {
  return sharp({
    create: {
      width: 96,
      height: 48,
      channels: 3,
      background: { r: 24, g: 84, b: 140 },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
}
