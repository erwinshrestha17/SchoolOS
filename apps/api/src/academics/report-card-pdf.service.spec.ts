import { ForbiddenException } from '@nestjs/common';
import { AuthMethod, FileStatus } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { loadSchoolLogoForPdf } from '../common/pdf/school-logo-loader';
import { ReportCardPdfService } from './report-card-pdf.service';

describe('ReportCardPdfService logo loading boundary', () => {
  const actor: AuthContext = {
    tenantId: 'tenant-1',
    tenantSlug: 'green-valley',
    userId: 'user-1',
    email: 'admin@school.test',
    authMethod: AuthMethod.PASSWORD,
    roles: ['admin'],
    permissions: ['academics:read'],
  };

  function buildService() {
    const prisma = {
      tenantSetting: {
        findUnique: jest.fn().mockResolvedValue({
          value: '11111111-1111-1111-1111-111111111111',
        }),
      },
    };
    const fileRegistryService = {
      getFileMetadata: jest.fn(),
      getProtectedDownload: jest.fn(),
    };

    return { prisma, fileRegistryService };
  }

  it('denies report card PDF content during a support override before report lookup', async () => {
    const prisma = {
      reportCard: { findFirst: jest.fn() },
    };
    const service = new ReportCardPdfService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.getReportCardPdf('report-card-1', {
        ...actor,
        isSupportOverride: true,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.reportCard.findFirst).not.toHaveBeenCalled();
  });

  it('does not load report card logos from non-branding file references', async () => {
    const { prisma, fileRegistryService } = buildService();
    fileRegistryService.getFileMetadata.mockResolvedValue({
      id: '11111111-1111-1111-1111-111111111111',
      tenantId: actor.tenantId,
      module: 'students',
      entityId: 'student-1',
      status: FileStatus.UPLOADED,
      originalFilename: 'student-photo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: BigInt(32),
      metadata: { kind: 'STUDENT_PHOTO' },
    });

    const logo = await loadSchoolLogoForPdf(
      prisma as never,
      fileRegistryService as never,
      actor,
    );

    expect(logo).toBeNull();
    expect(fileRegistryService.getProtectedDownload).not.toHaveBeenCalled();
  });
});
