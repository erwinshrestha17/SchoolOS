import { BadRequestException } from '@nestjs/common';
import { FileStatus } from '@prisma/client';

const ALLOWED_SCHOOL_LOGO_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

interface SchoolLogoFileAsset {
  tenantId: string;
  module: string | null;
  entityId: string | null;
  status: FileStatus;
  mimeType: string;
  metadata: unknown;
}

export function assertSchoolLogoFileAsset(
  asset: SchoolLogoFileAsset,
  tenantId: string,
): void {
  if (
    asset.tenantId !== tenantId ||
    asset.module !== 'settings' ||
    asset.entityId !== tenantId ||
    !hasSchoolLogoMetadata(asset.metadata)
  ) {
    throw new BadRequestException('School logo is not linked to this tenant');
  }

  if (asset.status !== FileStatus.UPLOADED) {
    throw new BadRequestException('School logo file is not available');
  }

  if (!ALLOWED_SCHOOL_LOGO_MIME_TYPES.has(asset.mimeType)) {
    throw new BadRequestException('School logo file type is not supported');
  }
}

function hasSchoolLogoMetadata(value: unknown): value is { kind: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    (value as { kind?: unknown }).kind === 'SCHOOL_LOGO'
  );
}
