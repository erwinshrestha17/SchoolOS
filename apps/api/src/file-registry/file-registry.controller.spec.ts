import { BadRequestException } from '@nestjs/common';
import { FileRegistryController } from './file-registry.controller';

describe('FileRegistryController upload validation', () => {
  const fileRegistryService = {
    registerFile: jest.fn(),
    getSignedUrl: jest.fn(),
  };
  const storageService = {
    saveBase64Object: jest.fn(),
  };
  const controller = new FileRegistryController(
    fileRegistryService as never,
    storageService as never,
  );

  const auth = {
    userId: 'user-1',
    tenantId: 'tenant-1',
  } as never;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects dangerous executable extensions before storage writes', async () => {
    await expect(
      controller.uploadFile(auth, {
        fileName: 'homework.exe',
        contentType: 'application/pdf',
        base64Content: Buffer.from('payload').toString('base64'),
        module: 'homework',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(storageService.saveBase64Object).not.toHaveBeenCalled();
  });

  it('returns protected URLs without exposing permanent public URLs', async () => {
    storageService.saveBase64Object.mockResolvedValue({
      objectKey: 'tenant-1/homework/file.pdf',
      sizeBytes: 1024,
    });
    fileRegistryService.registerFile.mockResolvedValue({
      id: 'file-1',
      originalFilename: 'homework.pdf',
    });
    fileRegistryService.getSignedUrl.mockResolvedValue(
      '/api/v1/files/file-1/preview',
    );

    const result = await controller.uploadFile(auth, {
      fileName: 'homework.pdf',
      contentType: 'application/pdf',
      base64Content: Buffer.from('payload').toString('base64'),
      module: 'homework',
    });

    expect(result).toEqual({
      id: 'file-1',
      fileName: 'homework.pdf',
      publicUrl: null,
      protectedUrl: '/api/v1/files/file-1/preview',
    });
  });
});
