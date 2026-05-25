import { BadRequestException } from '@nestjs/common';
import { basename, extname } from 'node:path';

export type SupportedImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

const IMAGE_SIGNATURES: Record<
  SupportedImageMimeType,
  {
    extensions: string[];
    isValid: (content: Buffer) => boolean;
  }
> = {
  'image/jpeg': {
    extensions: ['.jpg', '.jpeg'],
    isValid: (content) =>
      content.length >= 3 &&
      content[0] === 0xff &&
      content[1] === 0xd8 &&
      content[2] === 0xff,
  },
  'image/png': {
    extensions: ['.png'],
    isValid: (content) =>
      content.length >= 8 &&
      content
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  'image/webp': {
    extensions: ['.webp'],
    isValid: (content) =>
      content.length >= 12 &&
      content.subarray(0, 4).toString('ascii') === 'RIFF' &&
      content.subarray(8, 12).toString('ascii') === 'WEBP',
  },
};

export function validateImageUpload(input: {
  base64Content: string;
  fileName: string;
  mimeType: string;
  maxBytes: number;
  label: string;
}) {
  if (!isSupportedImageMimeType(input.mimeType)) {
    throw new BadRequestException(`Unsupported ${input.label} MIME type`);
  }

  const content = Buffer.from(input.base64Content, 'base64');

  if (content.byteLength === 0) {
    throw new BadRequestException(`${input.label} file is empty`);
  }

  if (content.byteLength > input.maxBytes) {
    throw new BadRequestException(
      `${input.label} must be ${Math.floor(input.maxBytes / 1024 / 1024)}MB or smaller`,
    );
  }

  const safeFileName = normalizeSafeImageFileName(
    input.fileName,
    input.mimeType,
    input.label,
  );

  if (!IMAGE_SIGNATURES[input.mimeType].isValid(content)) {
    throw new BadRequestException(
      `${input.label} content does not match the declared image type`,
    );
  }

  return {
    content,
    safeFileName,
    mimeType: input.mimeType,
    sizeBytes: content.byteLength,
  };
}

function normalizeSafeImageFileName(
  fileName: string,
  mimeType: SupportedImageMimeType,
  label: string,
) {
  const safeBaseName = basename(fileName.replace(/\0/g, '')).trim();
  const extension = extname(safeBaseName).toLowerCase();
  const allowedExtensions = IMAGE_SIGNATURES[mimeType].extensions;

  if (!extension || !allowedExtensions.includes(extension)) {
    throw new BadRequestException(
      `${label} extension must match ${allowedExtensions.join(', ')}`,
    );
  }

  const stem =
    safeBaseName
      .slice(0, -extension.length)
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'image';

  return `${stem}${extension}`;
}

function isSupportedImageMimeType(
  mimeType: string,
): mimeType is SupportedImageMimeType {
  return Object.prototype.hasOwnProperty.call(IMAGE_SIGNATURES, mimeType);
}
