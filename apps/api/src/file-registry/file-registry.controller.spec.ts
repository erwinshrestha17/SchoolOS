import { BadRequestException } from '@nestjs/common';
import { FileRegistryController } from './file-registry.controller';

describe('FileRegistryController upload safety', () => {
  let controller: FileRegistryController;
  let fileRegistryService: any;
  let storageService: any;

  const auth = {
    tenantId: 'tenant-1',
    userId: 'user-1',
    permissions: ['homework:create', 'homework:submit'],
  } as any;

  const ext = (...codes: number[]) => String.fromCharCode(...codes);

  beforeEach(() => {
    fileRegistryService = {
      registerFile: jest.fn(),
      getSignedUrl: jest.fn(),
      getFileMetadata: jest.fn(),
      assertFileAccessForAuth: jest.fn(),
      auditAccess: jest.fn(),
      createSignedPreviewUrl: jest.fn(),
      createSignedDownloadUrl: jest.fn(),
    };
    storageService = {
      saveBase64Object: jest.fn(),
      getObjectBuffer: jest.fn(),
    };
    controller = new FileRegistryController(
      fileRegistryService,
      storageService,
    );
  });

  it.each([
    ext(101, 120, 101),
    ext(98, 97, 116),
    ext(99, 109, 100),
    ext(99, 111, 109),
    ext(115, 99, 114),
    ext(106, 115),
    ext(109, 106, 115),
    ext(115, 104),
    ext(112, 115, 49),
    ext(112, 104, 112),
    ext(106, 97, 114),
  ])('rejects blocked executable-style extension', async (extension) => {
    await expect(
      controller.uploadFile(auth, {
        fileName: `blocked-file.${extension}`,
        contentType: 'application/pdf',
        base64Content: Buffer.from('safe-content').toString('base64'),
        module: 'homework',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(storageService.saveBase64Object).not.toHaveBeenCalled();
    expect(fileRegistryService.registerFile).not.toHaveBeenCalled();
  });

  it('rejects unsupported MIME types before storage write', async () => {
    await expect(
      controller.uploadFile(auth, {
        fileName: 'photo.png',
        contentType: 'image/svg+xml',
        base64Content: Buffer.from('safe-content').toString('base64'),
        module: 'homework',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(storageService.saveBase64Object).not.toHaveBeenCalled();
    expect(fileRegistryService.registerFile).not.toHaveBeenCalled();
  });

  it('rejects files above configured upload limit before storage write', async () => {
    const oversized = Buffer.alloc(10 * 1024 * 1024 + 1).toString('base64');

    await expect(
      controller.uploadFile(auth, {
        fileName: 'large.pdf',
        contentType: 'application/pdf',
        base64Content: oversized,
        module: 'homework',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(storageService.saveBase64Object).not.toHaveBeenCalled();
    expect(fileRegistryService.registerFile).not.toHaveBeenCalled();
  });

  it('stores safe uploads under the authenticated tenant and returns protected URL shape', async () => {
    const content = Buffer.from('safe-content').toString('base64');
    storageService.saveBase64Object.mockResolvedValue({
      objectKey: 'tenant-1/homework/report.pdf',
      sizeBytes: 128,
      provider: 'LOCAL',
      bucket: null,
      checksumSha256: 'checksum-1',
    });
    fileRegistryService.registerFile.mockResolvedValue({
      id: 'file-1',
      originalFilename: 'report.pdf',
    });
    fileRegistryService.getSignedUrl.mockResolvedValue(
      'http://localhost:4000/api/v1/files/file-1/preview',
    );

    await expect(
      controller.uploadFile(auth, {
        fileName: 'report.pdf',
        contentType: 'application/pdf',
        base64Content: content,
        module: 'homework',
      }),
    ).resolves.toEqual({
      id: 'file-1',
      fileName: 'report.pdf',
      publicUrl: null,
      protectedUrl: 'http://localhost:4000/api/v1/files/file-1/preview',
    });

    expect(storageService.saveBase64Object).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      prefix: 'homework',
      fileName: 'report.pdf',
      contentType: 'application/pdf',
      base64Content: content,
    });
    expect(fileRegistryService.registerFile).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        uploadedByUserId: 'user-1',
        originalFilename: 'report.pdf',
        objectKey: 'tenant-1/homework/report.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 128,
        provider: 'LOCAL',
        bucket: null,
        checksumSha256: 'checksum-1',
        module: 'homework',
        entityId: undefined,
      }),
    );
  });

  it('allows notice and chat attachment upload modules with matching permissions', async () => {
    const content = Buffer.from('safe-content').toString('base64');
    storageService.saveBase64Object.mockResolvedValue({
      objectKey: 'tenant-1/notices/notice.pdf',
      sizeBytes: 128,
      provider: 'LOCAL',
      bucket: null,
      checksumSha256: 'checksum-1',
    });
    fileRegistryService.registerFile.mockResolvedValue({
      id: 'file-notice',
      originalFilename: 'notice.pdf',
    });
    fileRegistryService.getSignedUrl.mockResolvedValue(
      'http://localhost:4000/api/v1/files/file-notice/preview',
    );

    await expect(
      controller.uploadFile(
        {
          ...auth,
          permissions: ['notices:create', 'notices:read', 'messaging:create'],
        } as any,
        {
          fileName: 'notice.pdf',
          contentType: 'application/pdf',
          base64Content: content,
          module: 'notices',
          entityId: 'notice-1',
        },
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'file-notice',
        publicUrl: null,
      }),
    );

    expect(fileRegistryService.registerFile).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'notices',
        entityId: 'notice-1',
      }),
    );
  });

  it('rejects uploads for unsupported modules', async () => {
    await expect(
      controller.uploadFile(auth, {
        fileName: 'report.pdf',
        contentType: 'application/pdf',
        base64Content: Buffer.from('safe-content').toString('base64'),
        module: 'unknown-module',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(storageService.saveBase64Object).not.toHaveBeenCalled();
    expect(fileRegistryService.registerFile).not.toHaveBeenCalled();
  });

  it('requires a permission that matches the requested upload module', async () => {
    await expect(
      controller.uploadFile(
        { ...auth, permissions: ['homework:submit'] } as any,
        {
          fileName: 'worksheet.pdf',
          contentType: 'application/pdf',
          base64Content: Buffer.from('safe-content').toString('base64'),
          module: 'homework',
        },
      ),
    ).rejects.toThrow('Insufficient permissions for upload module');

    expect(storageService.saveBase64Object).not.toHaveBeenCalled();
    expect(fileRegistryService.registerFile).not.toHaveBeenCalled();
  });

  it('returns signed preview URL responses through the File Registry service', async () => {
    fileRegistryService.createSignedPreviewUrl.mockResolvedValue({
      id: 'file-1',
      fileName: 'report.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 128,
      url: 'https://signed-storage.test/preview',
      expiresAt: new Date('2026-05-26T00:05:00.000Z'),
      expiresInSeconds: 300,
    });

    await expect(controller.getSignedPreview(auth, 'file-1')).resolves.toEqual(
      expect.objectContaining({
        id: 'file-1',
        url: 'https://signed-storage.test/preview',
        expiresInSeconds: 300,
      }),
    );

    expect(fileRegistryService.createSignedPreviewUrl).toHaveBeenCalledWith(
      auth,
      'file-1',
    );
  });

  it('returns signed download URL responses through the File Registry service', async () => {
    fileRegistryService.createSignedDownloadUrl.mockResolvedValue({
      id: 'file-1',
      fileName: 'report.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 128,
      url: 'https://signed-storage.test/download',
      expiresAt: new Date('2026-05-26T00:05:00.000Z'),
      expiresInSeconds: 300,
    });

    await expect(controller.getSignedDownload(auth, 'file-1')).resolves.toEqual(
      expect.objectContaining({
        id: 'file-1',
        url: 'https://signed-storage.test/download',
        expiresInSeconds: 300,
      }),
    );

    expect(fileRegistryService.createSignedDownloadUrl).toHaveBeenCalledWith(
      auth,
      'file-1',
    );
  });
});
