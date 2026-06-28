import { AuthMethod, FileStatus } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { ReportCardPdfService } from './report-card-pdf.service';

describe('ReportCardPdfService logo loading', () => {
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
    const fileRegistryService = {
      getFileMetadata: jest.fn(),
      getProtectedDownload: jest.fn(),
    };

    const service = new ReportCardPdfService(
      {} as never,
      {} as never,
      {} as never,
      fileRegistryService as never,
    );

    return { service, fileRegistryService };
  }

  it('does not load report card logos from non-branding file references', async () => {
    const { service, fileRegistryService } = buildService();
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

    const logo = await (
      service as unknown as {
        loadSchoolLogo(
          logoSetting: string,
          actor: AuthContext,
        ): Promise<unknown>;
      }
    ).loadSchoolLogo('11111111-1111-1111-1111-111111111111', actor);

    expect(logo).toBeNull();
    expect(fileRegistryService.getProtectedDownload).not.toHaveBeenCalled();
  });
});
