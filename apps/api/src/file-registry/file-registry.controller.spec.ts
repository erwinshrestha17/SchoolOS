import { BadRequestException } from '@nestjs/common';
import { FileRegistryController } from './file-registry.controller';

describe('FileRegistryController upload safety', () => {
  let controller: FileRegistryController;
  let fileRegistryService: any;
  let storageService: any;

  const auth = {
    tenantId: 'tenant-1',
    userId: 'user-1',
  } as any;

  const ext = (...codes: number[]) => String.fromCharCode(...codes);

  beforeEach(() => {
    fileRegistryService = {
      registerFile: jest.fn(),
      getSignedUrl: jest.fn(),
    };
    storageService = {
      saveBase64Object: jest.fn(),
    };
    controller = new FileRegistryController(fileRegistryService, storageService);
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
        module: 'homework',
      }),
    );
  });
});
