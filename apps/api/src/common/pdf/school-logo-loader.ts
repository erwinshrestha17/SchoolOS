import type { FileRegistryService } from '../../file-registry/file-registry.service';
import type { PrismaService } from '../../prisma/prisma.service';
import { assertSchoolLogoFileAsset } from '../files/school-logo-file.policy';
import { getJpegDimensions, type PdfImage } from './simple-pdf';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function loadSchoolLogoForPdf(
  prisma: Pick<PrismaService, 'tenantSetting'>,
  fileRegistryService:
    | Pick<FileRegistryService, 'getFileMetadata' | 'getProtectedDownload'>
    | null
    | undefined,
  actor: { tenantId: string; userId: string | null | undefined },
): Promise<PdfImage | null> {
  if (!fileRegistryService || !actor.userId) {
    return null;
  }

  try {
    const setting = await prisma.tenantSetting.findUnique({
      where: {
        tenantId_key: {
          tenantId: actor.tenantId,
          key: 'school_logo',
        },
      },
    });
    const logoFileAssetId =
      typeof setting?.value === 'string' ? setting.value : null;

    if (!logoFileAssetId || !UUID_PATTERN.test(logoFileAssetId)) {
      return null;
    }

    const asset = await fileRegistryService.getFileMetadata(
      actor.tenantId,
      logoFileAssetId,
    );
    assertSchoolLogoFileAsset(asset, actor.tenantId);

    const { content } = await fileRegistryService.getProtectedDownload(
      actor.tenantId,
      logoFileAssetId,
      actor.userId,
    );
    const dimensions = getJpegDimensions(content);

    return {
      buffer: content,
      width: dimensions.width,
      height: dimensions.height,
      format: 'jpeg',
    };
  } catch {
    return null;
  }
}
